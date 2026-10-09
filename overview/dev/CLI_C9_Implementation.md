# C9 完成报告：在线会话桥与原子编辑

日期：2026-10-09。对应 [下一阶段计划 §6](./CLI_Next_Development_Plan.md#6-c9在线会话桥与原子编辑已完成)；设计见 [C9 技术设计](./CLI_C9_Design.md)。

## 1. 交付范围

**C9 已完成。** 当前 CLI 为 API 1.0.0 / phase C9，权限策略 C9、转换器 C7.1，累计 **19 个命令入口、47 种领域操作**。新增以下 7 个入口，可连接 Windows 桌面当前内存工程：

| 命令 | 行为 |
| --- | --- |
| `session list` | 发现当前用户的桌面实例；报告可连接、失效和不兼容的登记 |
| `session status` | 返回明确实例/会话的版本、路径、dirty、草稿/忙碌、历史及保存限制 |
| `session inspect` | 查询当前未保存内容；`--view project` 返回完整序列化工程 JSON 快照 |
| `session validate` | 校验当前已提交的内存工程 |
| `session preview` | 在隔离候选上执行同一领域计划，返回差异、影响、权限要求和绑定版本的回执 |
| `session apply` | 重新校验候选和前提，一次原子提交；普通批次进入 GUI 同一 Undo 历史 |
| `session save` | 通过原保存队列显式另存新文件，或在获聊天授权后覆盖当前文件 |

除 list 外必须指定 instance 和 session，不猜测窗口。离线命令继续读取磁盘；在线连接失败不自动切换为离线写入。所有新增 assetName 继续由调用方提供。命令、token/回执文件及 requestId 示例见 [Agent 使用说明 §8.11](./CLI_Agent_Usage.md#811-当前桌面会话c9)。

本批实现源码及实际桌面联动，**没有重发 CLI ZIP、桌面目录版或安装器**。现存 C8 包保持原内容；开发使用 `npm run cli:build` 与 `npm run electron:dev`。配套发行和 CLI history 指令属于 C10。

## 2. 主要技术决定

### 共用领域与应用装配

`sessionSchemas.ts` 维护参数、请求、token 与回执契约。`domainCandidate.ts` 和 `projectDiff.ts` 提供浏览器/Node 共用候选执行与差异，继续使用原命令、诊断、权限和校验规则。

`services/onlineSession.ts` 负责 Store、ProjectSession 和编辑屏障的应用装配，保持 automation core 无 UI/Store 依赖。内存候选保留已经验证的执行结果，防止导入器补默认值使 no-op 伪装成内容修改。

### 版本、原子历史与重试

Store 增加单调 contentEpoch，与 instanceId/sessionId/contentHash 共同形成 token。内容编辑、成功 Undo/Redo、保存元数据和外部内容同步推进版本；选中和导航不会制造领域版本。草稿提交后和候选计算后均重新核对前提，再同步 compare-and-dispatch。`COMMIT_AUTOMATION` 复用 manifest、选择协调和历史规则；普通整批只产生一个条目，no-op 保留 redo，永久删除受保护资源仍清空可恢复历史。

apply/save 的 requestId 为毫秒时间戳加 UUID。同会话、同 ID、同请求在 **10 分钟**内复用已登记 Promise/结果；不同内容拒绝，过期拒绝，最多保留 **256** 项有效事务，满额拒绝新请求而不提前丢弃可重试结果。断线后使用同一 ID 核验，不能自动换 ID 重做。重启、重新登记或切换工程使旧身份失效；缓存不提供跨重启持久恢复。

### 人工输入和自动保存

关闭保护与在线编辑共用 `editBarrierDom.ts` 的字段提交适配器。只读返回已提交快照并标记 pendingEdits；写入先处理有效草稿，变化后按 token 冲突要求重读。无效输入、IME、拖动/连线、弹窗和未完成的人工翻译返回 pending/busy，不打断手势。

未声明本次 overwrite 许可的 Agent 修改带受限修订标记，自动保存检查捕获快照和执行时状态；用户偏好保持。GUI 主动保存、明确新路径另存或获许可的覆盖保存，只认可成功写入的内容，不能永久授权未来任务。Undo 后保存旧状态不会偷偷批准后来 Redo 恢复的 Agent 修改。

在线保存使用原 ProjectSession 队列和 C8 所有权。覆盖要求 `--allow-overwrite` 和 expectedDiskHash；新路径排他创建，相对 out 按 CLI 工作目录解析。无路径不打开文件选择器；写盘失败保留内存和 dirty，成功只确认捕获版本，期间新增编辑继续 dirty。

三项最高权限仍分别来自用户在 Agent 聊天中的明确授权；参数只是调用方声明。协议认证、预览回执及已有历史许可均不替代聊天许可，没有新增应用审批弹窗。测试仅使用虚构工程，不构成操作业务工程的授权。

### 本机传输

`platform/node/sessionTransport.ts` 维护 Windows named pipe、当前用户受限登记、双向 HMAC、32 MiB 帧上限、超时及操作白名单。`sessionSecurity.ts` 设置并读回当前 SID 的登记目录/管道 ACL，拒绝 Network SID、重解析点及权限无法验证情况。Electron 校验已登记主框架和页面来源，重载/销毁使旧实例失效。

双实例验收发现并修复两类启动竞态：StrictMode 重登记的旧启动不能覆盖新 generation；并发发布/关闭导致已枚举的临时文件消失时，仅容忍明确 FileNotFound/DirectoryNotFound，实际权限异常仍拒绝。新增文件创建/删除压力回归和 Everyone ACL 反例共同验证，避免把权限失败笼统忽略。

## 3. UX_Flow 对照

| 原流程 | 本批结果 |
| --- | --- |
| §2.1 保存、消息及关闭保护 | 在线保存复用队列和 dirty 确认；后台自动覆盖限制生效；原关闭保存/取消/放弃回归通过 |
| §4 Stage / Puzzle 层级 | 在线领域修改立即反映到真实 Inspector；人工草稿保留，批次可由 GUI 撤销/重做 |
| §5 FSM、§6 演出图 | 继续复用既有领域命令和校验；在线服务不另建图规则；拖动/连线期间有编辑屏障 |
| 既有 Undo/Redo | 普通批次共用历史，no-op 不清 redo，永久删除历史边界保持；CLI 历史命令留在 C10 |

未新增面板、导航、偏好指令或重复弹窗维护入口。原设计文档未修改。

## 4. 验证结果

| 检查 | 结果与证据 |
| --- | --- |
| `npm run check` | **36 文件 / 642 用例通过**；本批新增 33 项（服务 22、DOM 3、真实 CLI/传输 8）；UTF-8 378、格式 287、UI 110，类型/lint/故意错误拦截通过。见 [日志](./evidence/CLI_C9/check.log) |
| 生产构建 | 通过；仍有依赖注释及主 bundle 超过 500 kB 的提示。见 [日志](./evidence/CLI_C9/build.log) |
| 既有 Electron 回归 | **11 项文件会话、7 个关闭场景 / 32 断言、21 项双实例所有权**通过；关闭测试宿主也接入实际在线桥后再次通过。见 [日志](./evidence/CLI_C9/electron.log)、[关闭复验](./evidence/CLI_C9/electron-close-with-bridge.log) |
| C9 双实例真实桌面 + CLI | **33 项检查通过**。两份生产页面、真实 preload/IPC/管道、独立 Node CLI；含读未保存内容、窗口隔离、原子更新、GUI Undo/Redo、后台草稿、弹窗、过期 token、切换/关闭。见 [结果](./evidence/CLI_C9/electron-online.json)、[日志](./evidence/CLI_C9/electron-online.log) |
| 断线与自动保存 | 已发送并签名的 apply 在读响应前断线，随后同 ID 只返回原结果；真实等待 **61 秒**跨过自动保存周期，原文件字节不变且偏好仍启用；缺许可/错误磁盘 hash 拒绝，授权保存成功，下一任务重新受限，新路径另存成功 |
| 实际浏览器回归 | 打开桌面输出的完整工程，检查外部 Asset Name，人工改名、Undo/Redo、Validate；**0 Errors / 0 Warnings**，Console 无 warn/error。见 [记录](./evidence/CLI_C9/browser-verification.json)与 [截图](./evidence/CLI_C9/browser-validation.jpg) |

服务测试另覆盖：多个 Agent 同 token 竞争、候选末步失败、只读会话、外部同步 epoch、无效草稿、永久删除授权/历史边界、queued silent 保存、历史恢复受限内容及写盘期间新增编辑。真实传输测试覆盖错误 HMAC、未知操作、错误密钥、不兼容/陈旧登记、权限反例和并发临时文件清理。

所有测试使用隔离的虚构工程和偏好目录，未编辑用户业务工程。测试窗口、临时浏览器页和 Vite 预览服务已关闭；未复制含会话密钥的登记目录到证据。源码、文档与证据哈希见 [验收快照](./evidence/CLI_C9/manifest.json)。

## 5. 边界与后续

- 首轮在线桥仅验证 Windows；当前用户 ACL/HMAC 与错误认证反例已实测，未用另一真实 Windows 账户登录验证，也不隔离管理员或同用户进程。
- C10 尚需 CLI history list/undo/redo、历史条目元数据和正式 CLI/桌面配套发行。GUI 已可撤销普通 C9 批次。
- 在线不开放整份 JSON 替换；C5 离线备用入口及独立 raw/overwrite/permanent 授权保留。MCP、软件内 AI、远程服务和 UI 控制不在本批范围。
- 回归覆盖上述路径，不能据此保证所有历史功能绝对不受影响；未验证 Unity 玩法、其他操作系统或跨机器部署。
- **未提交推送 Git。** C1/C2 已有提交 `511701b`；既有 C3–C8 与本批 C9 保留在工作区，未改动旧发行包。

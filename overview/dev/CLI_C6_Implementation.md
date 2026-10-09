# CLI C6 完成报告：共同权限与层级/资源删除

完成日期：2026-10-09。**C6 已完成，C7–C10 待实施。** 本批在现有 C1–C5 工作区上实现，未提交或推送 Git；原有 C5 报告、证据与发行包保留。设计依据：[C6 技术设计](./CLI_C6_Design.md)、[下一阶段计划 §3](./CLI_Next_Development_Plan.md#3-c6共同权限策略与层级资源删除)。

## 1. 已交付功能

| 项目 | 实际行为 |
| --- | --- |
| Stage 子树删除 | `stage.delete`；根不可删；存在子 Stage、Puzzle 或局部变量时须 `cascade: true`；清理子树、Puzzle、所属 FSM/状态/迁移与局部资源 |
| Puzzle 删除 | `puzzle.delete` 同时删除所属 FSM；范围外仍存在 FSM 所有者则整批拒绝并返回所有者 |
| 资源永久删除 | `variable.purge`、`event.purge`、`script.purge`；仅接受 Implemented 或 MarkedForDelete；Draft 使用普通 delete |
| 生命周期 | Implemented 普通 delete 仍标删；MarkedForDelete 再次普通 delete 拒绝，不隐式变成 purge；新建仍只允许 Draft |
| 共同最高权限 | raw、overwrite、permanent 三项同级且独立；C6 开放 raw/permanent，overwrite 只登记未实现；实际级联及 raw 删除同样计算永久删除要求 |
| 预览与原子提交 | 完整 `impacts.deletions`、`permanentDeletions`、`requiredCapabilities`；最终引用/候选校验通过才发布新文件；回执绑定 C6 策略和能力集合 |
| GUI 历史 | 共用删除内核与统一 Dialog；普通删除可 Undo/Redo；实际移除受保护资源清空 past/future；修复失效选择、画布及导航 |

当前 `describe` 为 **phase C6 / policyVersion C6 / API 1.0.0 / 10 个命令入口 / 47 种领域 operation**。命名继续全部外部输入，不新增自动资产命名、软件内 AI、MCP 或 UI 控制命令。

## 2. 关键技术决策

- `utils/hierarchyDeletion.ts` 是 GUI/CLI 的唯一删除内核。共用初始 Stage 规范化，保持剩余相对顺序；受影响父级和兄弟项进入 scope 检查与完整差异。共享图、全局资源及原有孤立 FSM 不擅自删除；子树内部共享的 FSM 只删除一次。
- `utils/projectResources.ts` 统一资源枚举与 owner 身份，供 raw 生命周期、权限、历史使用。同 ID 的不同局部 owner 不混淆；变量移动只在两端唯一对应时认定，不猜测歧义身份。
- `contracts/automation/permissions.ts` 统一名称、等级、声明与策略版本，服务按实际源/候选差异推导能力。显式 purge 缺声明时在工程/回执 IO 前拒绝；间接删除在候选完成后、输出前拒绝。raw 永久删除同时要求两项声明，缺失返回 6。
- 预览回执不是授权。用户许可发生在 Agent 聊天中；`--allow-raw-json-write`、`--allow-permanent-delete` 仅是调用方声明，CLI 不认证聊天。已有范围内授权持续有效。开发测试仅使用隔离虚构工程，不推定用户已授权业务工程的高权限操作。
- 复用 `resourceReferences` 与错误基线校验；残留引用须在同一计划显式处理。新增删除引用保护，防止删掉局部变量后悄悄改绑同 ID 祖先；共享图按仍存在的调用上下文识别影响。
- 历史边界按实际资源差异判断，不再只识别单个 Action 的目标，因此 Stage/Puzzle 级联及整个 Node 更新均不能漏过永久删除。UI 提示在共享 Dialog/Message Stack 中呈现，没有新增视觉样式副本。
- 发行脚本原先硬编码 C5，会在能力升级后拒绝打包；现从实际构建读取 phase，输出目录/清单/验证一致，包内指南仍从唯一 Markdown 源复制。

## 3. 对照 UX_Flow

| 原要求 | C6 落地及验证 |
| --- | --- |
| §1.1 资源生命周期 | 普通 delete 保持三态语义，显式 purge 受限；两种受保护状态及三类资源/各 owner 回归通过 |
| §4 Stage 层级与初始项 | 根保护、深层级联、父级及初始项规范化、scope 越界、顺序保留均通过 |
| §5/§6 Puzzle、FSM 与演出 | Puzzle 删除关联 FSM；共享所有者保护；共享图/全局资源保留；不会因名称相同误删 |
| §7.6 确认 | 沿用统一确认框；显示 Stage/Puzzle/FSM 数量；明确普通删除可撤销、永久删除清除历史；实际取消/确认通过 |
| §2.1 消息及导航 | 共享 FSM 拒绝进入消息堆栈；删除后无效画布/选择/导航清理；普通 Undo/Redo 通过 |

CLI 的聊天授权不会转成应用内审批弹窗。GUI 与 CLI 对合法最终删除使用同一领域结果；GUI 仍允许既有未完成编辑，CLI 保持“不新增业务错误”的提交边界。

## 4. 回归结果

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 29 文件 / **517 项测试通过**；UTF-8 344 文件、格式 253 文件、UI owner 110 文件；类型、lint、架构/规范反向探针通过 |
| C6 新增测试 | **50 项**：22 项领域/Store，28 项真实 CLI 子进程；原有 467 项继续通过，C5 永久删除断言按 C6 新权限行为更新 |
| 生产构建 | `npm run build` 通过；保留现有大于 500 kB 的 bundle 提示及 Zod 注释移除提示 |
| Electron 文件/会话 | **11 项通过**；源/会话保持、保存失败等故障注入按预期拒绝 |
| Electron 关闭保护 | **7 场景 / 32 断言通过**；这是实际 Electron 进程回归，不是仅检查 TypeScript |
| 文档与最终脚本 | 10 份 UTF-8 文档、166 个本地链接、13 个章节锚点通过；最终脚本语法、编码、格式、lint 与 git diff 检查通过 |
| 独立 CLI 包 | C6 ZIP 在仓库外中文空格目录、PATH 无全局 Node 环境，真实 `puzzle.cmd` **41 项检查通过** |
| 浏览器 | 真实页面完成下表操作；采集的 console warn/error 为空；3 组 GUI 保存文件经 CLI 校验均 0 error / 0 warning |

CLI/领域用例覆盖：根/级联/空 Stage、深层和局部同 ID、共享 FSM、外部引用及同批修复、隐式祖先改绑、末步失败原子性、完整删除清单、三态生命周期、权限组合及缺声明零输出、原文保留、源 hash/回执篡改/旧版本冲突、幂等重试、普通历史与永久边界、只读 Store 和失败无历史。

首次全量运行中 C6 测试夹具的非初始 Sibling 缺少 unlockTrigger，使合法删除用例被校验拒绝；已修正夹具并重跑完整检查至上述结果，未放宽产品校验。

## 5. 浏览器直接操作与结果对照

浏览器使用本机开发页面，手工点击/快捷键走真实 GUI；仅载入本批虚构文件，未打开用户业务工程。

| 操作 | 实际结果 |
| --- | --- |
| Draft Stage 删除 → Cancel | Room、Deep、两个 Puzzle/FSM 保留 |
| Draft Stage 删除 → 确认 → Undo → Redo | 子树删除、恢复、再次删除均正确；根/Sibling、共享 Intro 图与全局资源保留 |
| 已实现局部变量值先修改，再删除 Room | 确认框明确永久移除 3 个受保护局部资源并清除 Undo/Redo；删除后两种快捷键均不能恢复它们 |
| Puzzle 卡片菜单 Delete → 确认 → Undo → Redo | 仅目标 Puzzle 及其 FSM 删除，子 Stage/其他 Puzzle 保留；可恢复/重做 |
| 共享 FSM 在范围外仍有 Puzzle 所有者 | 不打开删除确认，不改内容；Message Stack 显示明确拒绝原因 |
| 三份 GUI 保存结果与同源 CLI 删除结果比较 | 全部 `project` 字段一致，仅排除 `meta.updatedAt`；包装保存时间与 UI 导航状态不纳入领域对照；源字节哈希不变 |

证据：[GUI/CLI 对照](./evidence/CLI_C6/gui-cli-comparison.json)、[普通 Stage 结果](./evidence/CLI_C6/gui-draft-deleted.png)、[永久删除提示](./evidence/CLI_C6/gui-protected-confirm.png)、[永久删除后](./evidence/CLI_C6/gui-protected-deleted.png)、[Puzzle 结果](./evidence/CLI_C6/gui-puzzle-deleted.png)、[共享 FSM 拒绝](./evidence/CLI_C6/gui-shared-fsm-rejected.png)。

浏览器测试结束后已关闭本次测试页和开发服务器。自动化 UI 驱动中一次未预先监听文件选择器导致测试等待，重载隔离页面并正确监听后继续；该过程未更改源工程。

## 6. 交付位置与边界

- [使用说明](./CLI_Agent_Usage.md)、[覆盖核对](./CLI_Coverage_Audit.md)、[下一阶段状态](./CLI_Next_Development_Plan.md)、[统一包内指南](./CLI_Distribution_Guide.md)已同步。
- [证据清单](./evidence/CLI_C6/manifest.json)记录源码/文档/证据 SHA-256；原始 CLI 计划/回执/结果、GUI 输出与 Electron JSON 均在同目录。
- 独立包：`release/cli/C6/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip`；SHA-256：`4560249dc01e91d8ec38fb2b74eb666f260697b7f112a9c8c08bd1e5af1a6cef`。该包为本批兼容回归产物，验证见 [41 项检查](./evidence/CLI_C6/package-verification.json)；旧 C5 包未覆盖。
- C6 仍只写新目标，不覆盖源文件、不修改已打开的 GUI 会话，不提供 CLI Undo/Redo。C7 转换、C8 覆盖与所有权、C9 在线、C10 历史继续按计划实施。
- C5 旧回执须重新预览。当前 GUI 安装包未重打；GUI 新删除行为需运行本次源码构建。没有进行 Unity 玩法、安装/升级或跨机器验证，不能据此保证所有未覆盖场景绝无回归。
- Git 保持工作区改动：C1/C2 已在 `511701b`，C3–C6 尚未另行提交/推送。

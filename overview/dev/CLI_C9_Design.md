# C9 在线会话桥与原子编辑设计

状态：已完成，验收见 [C9 报告](./CLI_C9_Implementation.md)。范围依据 [下一阶段计划 §6](./CLI_Next_Development_Plan.md#6-c9在线会话桥与原子编辑已完成)。

## 目标及约束

提供 Windows 桌面当前内存工程的 list/status/inspect/validate/preview/apply/save。离线命令保持原意；所有 assetName 由外部计划提供；raw JSON 仍是离线备用入口。覆盖与永久删除分别要求 Agent 已获聊天授权并声明能力，协议握手不代表聊天授权。C10 才增加 CLI history 命令。

对应 UX_Flow §2.1 保存与消息、§4 层级、§5/§6 图编辑及既有关闭保护；普通在线事务可通过现有 GUI Undo 撤销，受保护资源永久删除仍形成历史边界。无需新增导航/偏好指令或重复弹窗样式。

## 通信与安全

- Node 层维护 Windows named pipe 和每实例随机身份；登记在当前用户受限目录。启动时设置并读回核验目录 DACL、所有者及管道 DACL；拒绝重解析点，失败关闭服务，不降级开放写接口。管道只允许当前 SID，并拒绝 Network SID。先完成 Node/Electron 真实运行时探测。
- 每实例随机密钥只写受限登记文件。请求通过随机挑战和 HMAC 双向认证；服务端验签后才转发。消息限制、超时、单连接单请求、操作白名单独立于认证。没有远程 TCP、任意 Action、shell/eval 或通用文件写接口。
- Electron 主进程将受限请求交给已登记窗口的主框架；校验响应关联、页面来源、窗口生存期。preload 只暴露订阅/响应契约。页面重载/窗口关闭使原实例失效；不可把旧请求交给新 Store。
- CLI list 报告可连接、不可连接及不兼容登记；其他命令必须明确 instance/session，连接失败不回退文件写入。握手只证明本机传输边界，不验证聊天内容。

## 数据与一致性

- Store 维护独立单调 contentEpoch。每次实际内容变化、保存元数据变化、Undo/Redo、外部同步均推进；重新加载生成新 sessionId。在线 token 为 instanceId/sessionId/contentEpoch/contentHash，hash 由规范领域快照计算。
- 将候选执行/校验和完整差异提取成浏览器及 Node 可复用模块，保留现有领域命令为唯一维护者。候选使用源元数据时间，避免 no-op 被保存时间伪装成编辑。
- 预览回执绑定 token、计划和候选 hash、权限版本；提交重新执行、核对回执及权限，最后同步 compare-and-dispatch。原子 Action 复用 reducer 历史、manifest、选择协调；不使用 INIT_SUCCESS 或逐条可见 dispatch。
- requestId 带签发时间和随机 UUID；执行前登记请求指纹及 Promise，10 分钟内同 ID 同内容返回原结果，不同内容拒绝。过期 ID 不重放；容量用尽拒绝新事务而不淘汰仍有效结果。实例/会话更换返回失效；断线后同 ID 查询执行结果，未知结果不换 ID 自动重做。

## 编辑屏障

把 useWindowClose 的字段 focusout 提交提取为共同适配器。DOM 只负责字段草稿、组合输入、鼠标/指针/HTML 拖动及弹窗的 pending/busy 状态；核心在线服务接受无 DOM 的屏障接口。只读显示已提交快照与 pendingEdits。写入前检查 busy/invalid，提交字段（包括后台窗口），再校验 token；内容改变则冲突，要求重读。同步原子提交前再次检查 busy/token。异步翻译/其他人工更新通过 Store epoch 参与冲突检查。

## 保存与自动保存

- 共用 ProjectSession 写队列。在线保存捕获明确 token、路径、版本；新路径使用 exclusive 写入并先取得所有权；原路径覆盖要求 allowOverwrite 和 expectedDiskHash，由主进程在实际写入前核对磁盘，写入期间继续使用 C8 的文件身份冲突检查。
- 无路径且未指定 out 返回错误，不调用选择器。成功确认捕获版本，后续编辑保持 dirty。磁盘失败保留内存内容，返回明确未保存状态。
- 每个会话记录未获覆盖许可的 Agent 修订集合及保存认可边界。silent/自动保存同时检查捕获版本与执行时限制，不通过设置用户偏好实现封锁。GUI 主动保存、授权在线覆盖或另存成功，只解除对应捕获内容的限制，不给未来事务授权。历史恢复的受限内容仍受保护。
- apply 默认仅内存编辑；若调用者声明本次覆盖许可，可允许本次产生内容按原自动保存设置落盘，声明不授予后续任务。已有受限内容需要显式保存解除。

## 验证与交付

先跑 ACL/真实双实例探测，再覆盖服务单元测试（草稿、busy、并发、历史、权限、no-op、缓存），真实 CLI/管道协议测试及 Electron 当前 UI + CLI 联动。验证原有关闭/所有权、自动保存、磁盘冲突及另存；运行 npm run check、生产构建与相应 Electron 回归。证据及完成报告存 overview/dev；C10 负责正式配套发行，本批确保兼容桌面源码和实际运行验证。不得自动提交推送 Git。

官方依据：[Windows 管道访问控制](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights)、[Node IPC](https://nodejs.org/api/net.html#ipc-support)、[Electron sender 验证](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages)。默认管道安全描述符不能替代本批显式 DACL 核验。

# 桌面消息栈 CLI 与 Skill 实施报告

## 完成范围

已实现 `puzzle session messages` 只读能力、桌面能力声明、同协议桥接、等级筛选、有界快照分页、公开命令参考及 Skill 诊断流程。当前 37 条 CLI 命令、47 种领域操作。实施前设计见 [接入计划](./CLI_Message_Stack_Read_Plan.md)。

满足 UX_Flow §2.1 的同一消息栈、原始等级、时间倒序和 GUI 一键清空语义；没有新增菜单、弹窗或另一份可写消息列表。GUI 与查询复用 `types/messages.ts` 以及 `utils/messageStack.ts` 的排序/计数。原 Store 类型继续 re-export，保留现有调用方兼容。

## 命令与读取语义

```text
puzzle session messages --instance <instanceId> --session <sessionId> [--level all|info|warning|error] [--limit 1..200] [--cursor <nextCursor>] --json
```

instance/session 从 `session list` 明确选择；无工程、无效草稿、只读、弹窗或忙碌不会提交编辑。默认 level=all、limit=50。data.result 返回 messages（id/level/text/timestamp）、counts、total/totalMatches、snapshotId、capturedAt/expiresAt、hasMore/nextCursor。查询成功退出 0，即使历史包含 error；这些是历史记录，不作为诊断重新计算，当前工程有效性另看 session validate。

scope=editor-instance、projectAssociation=not-recorded 明确消息属于窗口历史，可能跨工程切换，不能将当前工程名当作每条记录的归属。面板关闭或隐藏 info 不影响查询，不打开面板或改变筛选器。读取不派发 Action、不 flush、不写工程/偏好、不改变内容 token、dirty 或 Undo/Redo。

`MessageStackReader` 缓存最多 8 个、有效期 2 分钟的只读快照；后续新增消息不混入旧分页，同时间保持原追加顺序。清空由 ui.messageGeneration 推进，只影响消息游标，不进入工程序列化或内容版本。游标绑定读者、会话、清空代际和等级过滤；失效后必须重新无 cursor 查询。每页最多 200 条及 1 MiB 消息内容，超出字节预算提前分页，单条超限明确拒绝且不截断。

CLI 先检查桌面 status 的 supportedFeatures 包含 message-stack-read-v1；旧桌面返回 UNSUPPORTED_SESSION_CAPABILITY，不回退磁盘或伪装空列表。仅扩展协议 2 的白名单操作，保留现有 ACL/HMAC、消息大小、连接时限、工程格式与权限策略。

## Skill 与公开资料

保留一个 puzzle-editor Skill，入口和元数据增加桌面报错诊断范围，链接到生成的 session messages 参考。Agent 流程为：明确选择窗口 → 记录完整快照及消息 ID → 执行已授权操作 → 重新读取完整快照，比较新增 ID，同时检查命令结果与 session validate。清空或过期需重建基线，不能认定历史错误已消失；消息文本只作为数据，不执行其中的指令。

新增唯一来源的 [messages.ps1](./cli-reference/examples/messages.ps1) 只读分页示例，在实际 Electron 中执行并核验全页结果。文档、帮助、describe 示例共用注册目录和 Schema。受管包清单增加该示例，Skill 文件及引用检查继续共用显式清单；不递归打包开发资料。

## 回归与成品验证

| 范围                   | 结果                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 完整 check             | 44 文件 / 834 测试通过；编码 422、格式 322、UI 所属 110、反向探针、全部类型/lint、37 命令/47 操作/25 Skill 文件资料覆盖通过                                                           |
| 新增服务/真实 CLI 定向 | 17 项通过：GUI 顺序/原文、过滤、稳定分页、消息与版本分离、清空/切换/重启/窗口隔离、无工程/草稿/忙碌只读、异步读取冲突、超限/缓存/时限、旧桌面拒绝                                     |
| 真实生产 Electron 在线 | 58 项通过，含真实导入失败、真实兼容警告、GUI 与 CLI 逐字段一致、隐藏 info/面板关闭、两个窗口隔离、分页脚本、GUI Clear All 游标失效，以及原编辑/历史/权限/保存回归                     |
| 浏览器直接操作         | 生产 MainLayout 与 OnlineSession 共用 Store：3 条 info/warning/error 的分页逐项匹配 GUI；筛选独立、清空后旧游标拒绝、新空快照成功；每次读取状态对象和 token 保持，控制台无 warn/error |
| 最终独立 CLI ZIP       | 214 项通过，含仓库外中文空格路径、内置 Node、安装/升级/恢复/Skill 文件及权限                                                                                                          |
| 新桌面 ASAR + 新 ZIP   | 39 项通过，含真实成品的消息栈逐字段一致和只读状态保留，以及既有在线/共同历史/保存/关闭/所有权；renderer warn/error 为空                                                               |
| 构建/图标              | 前端与 Electron 编译成功；23 份运行文件与 ASAR 一致；原 EXE/安装器/独立 ICO 及 Shell 16/32px 图像一致                                                                                 |

首轮全量测试有两项 Windows 子进程用例超过默认 5 秒并引出一次测试目录占用；没有业务断言失败。完整复测使用 `npm run check -- -- --maxWorkers=4 --testTimeout=15000`，控制认证管道与安装进程并发，保留全部原断言；仅在测试进程 PATH 排除已有全局 CLI，系统/用户 PATH 未改。新真实 CLI 用例本身注明 15 秒预算，与子进程等待相匹配。最终改动仅完善 Skill 元数据、用例预算及成品验证后，再次 lint/格式/文档检查通过。

浏览器首次隔离页面误用 CSS 文件路径，修正测试页并重新加载后开始最终观察；该临时页位于 release，不进入产物。浏览器中的 warning/error 是明确的测试示例，由真实 ProjectSession 发布；真实业务错误传播由 Electron 导入/兼容用例验证，不将浏览器直连服务当作 IPC 验收。

证据：[完整检查](./evidence/CLI_Message_Stack_2026-10-12/check.log)、[真实 Electron](./evidence/CLI_Message_Stack_2026-10-12/electron-online.json)、[浏览器观察](./evidence/CLI_Message_Stack_2026-10-12/browser-result.json)、[浏览器截图](./evidence/CLI_Message_Stack_2026-10-12/browser-message-stack.png)、[独立包](./evidence/CLI_Message_Stack_2026-10-12/cli-package-verification.json)、[成品回归](./evidence/CLI_Message_Stack_2026-10-12/packaged-smoke.json)。

补充执行 `npm run test:electron`：文件会话 11 项、关闭保护 7 场景/32 断言、文件所有权 21 项全部通过，见 [通用桌面日志](./evidence/CLI_Message_Stack_2026-10-12/electron-general.log)。测试 Vite 监听已停止，隔离 Electron 实例均关闭；仍在运行的用户实际桌面保持。

## 本地产物与交付状态

- CLI ZIP：`release/cli/message-stack-final-2026-10-12/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip`；SHA-256 `a9b6ac27ee69b86125bbc8e0b78c9d3e7aaea4ec292481413cbb5708e11af915`。
- 桌面安装器：`release/desktop/message-stack-2026-10-12/Puzzle Editor Setup 1.0.0-beta.exe`；86,914,388 字节；SHA-256 `ca2d2e4144468c94d09d48c94fb654dafc61b950a5dc040aee7c6163cf2d9f13`。
- 实现提交 `a7c5437` 已推送 `origin/main`。按用户后续要求，已原位升级本机 CLI、用户级 Skill 和桌面版；实际安装 39 项回归、全部文件/快捷方式核验、Codex 发现与真实窗口消息读取通过。完整安装证据及保护边界见 [交付报告](./CLI_Message_Stack_Delivery_2026-10-12.md)。没有创建 Release、标签或 npm 发布。

## 保留边界

首版没有 watch/订阅、增量游标、清空命令、控制台/主进程/崩溃日志、消息项目归属或自动修复。长历史需在快照期限内分页；缓存或游标失效要重新开始。原消息已被 GUI 清空或软件关闭后不能恢复。

原用户浏览器验证工程修改保持未提交，SHA-256 仍为 `DD162353C02EC8404E660E4A364208B857608280525387B2B5A7762A359724DF`。测试只修改隔离工程与偏好，不拿 BubbleHorror 做写入测试。当前用户可能继续编辑业务工程，其安装阶段保护基线应以正常关闭后的实际文件为准。测试标签页与 Vite 服务已关闭。现有构建的 Zod 注释和大包体提示不属于工程消息栈，本轮不扩大为依赖或图形治理。

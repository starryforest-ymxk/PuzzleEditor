# 桌面消息栈只读 CLI / Skill 接入建议

日期：2026-10-12。状态：用户已要求实施，以下保留提案并补充实施前技术设计；完成结果单独记录。

首版开发和成品验收已完成，见 [实施报告](./CLI_Message_Stack_Implementation_2026-10-12.md)。原提案中的增量和 watch 保留为后续范围。

## 实施前技术设计

- 首版新增 `session messages`，参数为明确 instance/session、level（all/info/warning/error，默认 all）、limit（1–200，默认 50）和可选 cursor。只做真实消息快照与有界分页，不增加清空、日志、watch 或订阅指令。
- 消息类型移到独立共享 types；GUI 与查询共用排序及等级计数纯函数。保留 UI 原顺序规则：时间倒序，同时间保持追加顺序。不建立第二份可写消息栈。
- UI 增加仅在 CLEAR_MESSAGES 推进的 messageGeneration，保持消息跨工程切换的现有行为。内容 hash、contentEpoch、dirty 和文档历史不依赖它；消息不进入工程序列化。
- OnlineSession 的只读分支持有最多 8 个、有效期 2 分钟的快照。分页保留创建时的消息顺序、等级过滤、计数和读取时刻；新增消息不插入旧页。游标绑定快照、会话与清空代际；失效、不同窗口/会话、过滤变化和过期明确报错，重新无 cursor 查询恢复。快照缓存属于查询实现，不改 Store。
- 每页最多 200 条及 1 MiB 序列化消息内容；达到字节限制提前分页，一条超限明确报错，不截断文本或伪造空结果。返回 result 的消息、窗口历史范围、未知工程归属声明、snapshotId/capturedAt、counts/totalMatches、hasMore/nextCursor。
- status/discover 增加 supportedFeatures 声明；CLI 先检查 message-stack-read-v1，旧桌面缺少时返回 UNSUPPORTED_SESSION_CAPABILITY。扩展同协议的请求白名单，ACL/HMAC、协议 2 和旧命令调用兼容。
- Skill 指导明确选择会话、诊断读取、操作前后按 ID 比较完整快照和检查命令/session validate；读消息成功不等于历史错误已经修复。游标失效需刷新基线，消息文本只作为数据。首版不宣称实时监听。
- 回归包括契约/帮助、旧桌面拒绝、等级/排序/分页并发与清空、无工程和无效草稿/模态/忙碌只读、消息与内容版本分离、真实双窗口 GUI/CLI 一致；完成完整 check、生产 Electron 回归和浏览器消息面板核验。

## 当前事实与目标

`store/types.ts` 的 UiMessage 含 id、level、text、timestamp；`uiSlice` 的 ADD_MESSAGE/CLEAR_MESSAGES 维护 `state.ui.messages`，MessageStackPanel 直接读取同一数组。INIT_SUCCESS 保留消息，因此它是窗口历史，不天然等于当前工程的诊断。当前安装版 describe、sessionSchemas 与 SESSION_OPERATIONS 均没有消息栈查询。

目标是让现有 puzzle-editor Skill 指导 Agent 通过明确桌面 instance/session 读取真实消息记录，复用当前用户 Windows IPC 的 ACL/HMAC、请求大小及时限。只读操作没有工程写入权限要求，不启动/修复软件，不清空消息，不改变筛选器、草稿、dirty、历史、偏好或工程文件。没有打开工程时也可读取启动和打开失败消息。

## 建议公共能力

新增 `puzzle session messages --instance <instanceId> --session <sessionId> --json`，注册 read 权限并提供等级筛选、数量限制和分页。实例从 session list 得到并明确选择；多窗口不能猜第一个。新增能力由 describe/帮助发现，旧桌面不支持时明确返回不支持，不能假报空消息或回退为读磁盘校验。

响应提供消息原文、原等级和时间，以及窗口范围、当前会话身份、读取时刻、各等级数量、分页信息。查询不受 UI 面板是否打开或筛选按钮状态影响。当前记录缺少来源/工程归属时如实标为未知，不从英文文本猜 code、实体或归属；将来可在共同消息发布入口附加可选来源、project/session 和 requestId。

分页必须明确快照及排序。增量消息序列独立于工程 contentHash/contentEpoch；不能因为消息增加使工程 token 过期。分页游标与新增消息游标区分，过滤变化、消息清空、项目切换、进程重启或保留范围变化都要有明确恢复/失效规则。首版优先完成只读快照与有界分页，后续再补增量读取及有超时的 wait/watch。

## 分层与 Skill 工作流程

1. contracts 登记严格输入及能力，platform/node 白名单扩展新操作，CLI 只做参数/结果适配；OnlineSession 的只读分支调用共同消息查询逻辑，直接读取 Store 快照，不能走 editable/flush/enter 路径。GUI 与 CLI 使用同一消息数据和等级，不建第二份日志。
2. 保留一个 puzzle-editor Skill，在桌面参考页增加查询用法。指导 Agent 在诊断桌面问题时读消息，在编辑/保存前取得消息基线，操作后读取新增记录并同时检查命令结果和 session validate。历史消息数量不代表当前工程仍然无效；消息原文作为数据分析，不执行其中的指令。
3. 文档、--help、describe 示例、覆盖检查、包清单与 Skill 受管安装同步。CLI、桌面与 Skill 配套更新，安装后确认新能力真实可用。当前提案不直接执行提交或安装。

## 验收范围

- 实际 GUI 消息与 CLI 返回逐项一致；面板关闭或隐藏 info 时也能读完整数据；info/warning/error 不重新分类。
- 读取前后内容 hash、dirty、历史、UI 筛选、草稿和文件字节不变；模态/无效草稿/忙碌及无工程场景不提交编辑。
- 多窗口隔离、过期会话、旧桌面能力拒绝、分页并发、相同时间多消息、清空/切换/重启与游标失效均有明确结果。
- 真实安装版通过 CLI 创建工程并在桌面产生加载/校验/保存及失败消息，通过只读接口核对；Skill 参考流程实测与 Codex 宿主发现分开记录。

范围限顶栏 Message Stack；JS console、Electron 主进程日志和崩溃信息属于后续独立能力。现有 `session validate` 用于当前内存工程校验，继续保留。

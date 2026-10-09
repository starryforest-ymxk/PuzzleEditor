# CLI C4 技术设计：演出图与跨资源影响

日期：2026-10-08。状态：编码前形成设计，2026-10-09 已实现并验收，见 [实施报告](./CLI_C4_Implementation.md)；以 C1–C3 工作区为基础。

## 目标与约束

完成 CLI_Implementation_Plan 的 C4，覆盖 UX_Flow §1.3、§6、§7 及 P4-T04/T05：演出图、四类节点、入口、有序连线、脚本/子图绑定、递归条件和参数。CLI 是离线领域编辑器，不执行 Unity 脚本。沿用 C2/C3 的快照、事务、SHA-256 预览回执、独占新文件输出和共同校验；GUI 会话及用户源文件不被修改。

所有新 assetName 必须由外部传入；当前 PresentationGraph / PresentationNode 模型没有 assetName，不增造字段。原始 JSON 写入仍属 C5，普通领域命令不接受任意 JSON Patch、Action 或整个 nodes/graphs 替换。

## 公开契约

- `presentation.create/update/delete/setStart`：创建只接受名称、描述、顺序；更新同样限制元数据。入口单独设置，同图节点必须存在。删除采用 restrict，先显式解除所有绑定。
- `presentationNode.create/update/delete`：必须提供 graph；创建必须提供名称、类型和 position。只更新声明的字段，null 清除可选绑定/条件/duration。类型相关字段必须匹配，变更类型不隐式丢弃旧绑定、条件或边。
- `presentationEdge.connect/disconnect/redirect/update`：必须提供 graph、from 和 slot。Branch 的 slot 固定为 `true` / `false`；普通节点为 `next`；Parallel 为非负索引（connect 插入、disconnect 删除、redirect 原位替换）。不接受 nextIds 整组覆盖。
- 断开 True 保留空字符串槽位，False 保持索引 1。普通节点最多一条出边，Branch 最多两个固定槽；Parallel 保留调用方指定顺序。允许环，与现有模型一致并输出共同校验警告；同一源节点重复目标沿用 GUI 限制拒绝，避免端点键视觉属性无法区分的歧义。
- redirect 更改同一槽位的目标；换源可显式 disconnect/connect。边样式只开放 fromSide/toSide，可 null 清除；修改/改接保留未指定样式。
- 删除节点有入/出边时要求 `deleteEdges: true`；删除入口且仍有其他节点时要求 `replacementStart`，最后一个节点删除后入口 null；绝不自动选入口。
- `scope.presentations` 可列已有图 ID 或本计划新图 alias。图权限不会从 Stage/Puzzle 的绑定继承；创建新图需 scope.project 或显式新图 alias。编辑共享图的影响在预览中展示，调用者自身修改仍需其权限。
- alias 预分配图/节点 ID，节点 allocation 携带 graphId，防止不同图相同局部 ID 或跨图 alias 混用。保留 C3 创建依赖排序和固定分配。

## 共享领域实现

1. `utils/presentation.ts` 保留规范化并增加图/节点工厂，GUI 与 CLI 复用默认值。
2. 新纯函数模块负责有序连线修改、视觉属性迁移/清除、节点删除；Slice 和 GUI 命令也通过该模块，修复 filter 导致 Branch True/False 移位以及改接丢失边样式的问题。无需新 UI、路由或样式 owner。
3. `store/commands/automation/presentation.ts` 负责契约到领域操作转换、归属/权限/前置检查，使用隔离 CommandContext 和原有 presentation Slice；失败提供稳定 code 和 operationIndex。
4. 共同调用上下文工具从 Stage enter/exit 和每个 Puzzle 的 FSM Transition 开始，通过子图绑定传播。按“根绑定 + 图”去重，环与菱形调用收敛；每条直接绑定完整保留，调用链只提供一条代表路径以避免指数枚举。
5. 资源引用索引以领域字段为白名单，包含条件树、脚本参数、事件触发/派发、监听器及生命周期；不扫描常量 JSON 内容。GUI 引用列表、黑板计数与 CLI 引用查询共用所有者解析，局部变量按真实调用上下文与祖先遮蔽解析，孤立图局部引用标为未解析而不冒充任意作用域资源。
6. 共同校验复用调用上下文；演出节点递归条件、临时参数来源类型逐个上下文验证，脚本类别/生命周期目标继续使用已有规则。诊断带图及节点归属，避免同名/同局部 ID 混淆。现有错误基线机制保留。
7. preview/apply 返回演出图影响摘要（编辑图、直接引用和传播后的 Stage/Puzzle 调用者，变更前后均列出）；inspect presentation 返回调用上下文，references 返回精确归属及归一化路径。

## 验证与验收

真实 CLI 子进程覆盖：四类节点/子图/前向 alias；两级共享图；Branch True 删除/改接和 False 保留；Parallel 顺序；入口及删除保护；跨图/权限/缺失资源；类别、递归条件与参数类型拒绝；partial update 保留坐标、绑定及样式；事务原子性、回执、源文件不变；GUI/CLI 导出数据一致。

补充真正 Store 的画布命令/撤销重做回归和明确预期的资源引用计数，避免以同一个索引生成测试期望。运行 npm run check、前端 build、Electron session/close 回归。使用 CLI 生成图文件在真实浏览器打开，检查 Branch/Parallel/子图，修改并保存/导出，再由 CLI 校验和比较。证据保存在 overview/dev/evidence/CLI_C4，历史 C3 证据不改写。

## 已知边界

浏览器验收补充设计：CLI 支持的普通 Constant 参数（含 JSON 对象）在原 Inspector 被显示为未选变量。复用现有 `ui-control`，按 source.type 展示只读常量值；不把任意 JSON 自动转为 Temporary/string 或改写参数。现有 Variable/Temporary 编辑流程保持原有语义，普通常量可通过领域参数命令修改。

模型没有边实体 ID，边视觉属性以 from→to 为键；本批不扩展项目格式。脚本清单没有运行时参数签名，校验可保证参数名、来源、作用域、Temporary 类型，不能证明实际 Unity 脚本实现接受任意参数。允许图内部循环；子图递归调用要给出明确诊断并避免分析递归不终止。MCP、在线 GUI 协作与 C5 原始 JSON 高权限写入不属于本批。

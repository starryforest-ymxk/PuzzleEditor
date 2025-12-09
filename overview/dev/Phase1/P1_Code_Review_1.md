# P1_Code_Review：阶段一代码审查报告

## 范围与依据
- 依据：`Project_Overview.md`、`UX_Flow.md`、`Task_Breakdown.md` 阶段一目标与交互规范。
- 覆盖：当前代码架构（types/store/api/components/utils/hooks）与 Mock 数据，聚焦阶段一要求的模型/引用/生命周期/作用域/基础交互。

## 总体结论
- 优点：领域模型与 ID/引用规则已在 `types/*` 基本落地（P1-T01/T02），FSM 与 Presentation 画布骨架已可显示/基础操作，Undo/Redo 框架存在。
- 不足：黑板/脚本/事件尚未接入全局 Store 与 API，作用域与软删除仅落到节点局部变量，条件/参数/触发器的统一表达与 UI 未闭环；部分实现与定义不一致导致数据丢失或不合法。阶段一“统一数据结构与交互规范”的目标尚未达成，需要补齐数据管线与关键校验。

## 主要问题与风险
- 高 | **黑板/脚本数据未入全局数据管线**：`store/types.ts:29-76` 的 `project` 缺失 blackboard 与脚本清单；`api/types.ts:20-35` 的 ProjectData 仅含 stage/node/fsm/presentation，未对齐 `types/project.ts` 的 `ProjectData`/`ExportManifest`。Mock API `loadProject` 也无 blackboard/scrips 版本信息，导致黑板变量/事件/脚本无法加载、保存，后续作用域解析和软删除校验无从谈起。
- 高 | **节点局部变量创建缺失关键字段，软删除/作用域失效**：`components/Inspector/BlackboardEditor.tsx:31-40` 新增变量仅携带 `id/name/type/defaultValue/isGlobal`，缺少 `key/state/scope` 等必需字段，与 `nodeParamsReducer` 中的软删除/作用域规范不匹配，易生成非法数据且无法执行 Draft→Implemented→MarkedForDelete 流程。
- 高 | **作用域可见性逻辑未实现全量数据**：`utils/variableScope.ts:47-72` 全局变量返回空占位，Stage Local/Node Local 之外的可见性与 Temporary 管理缺失；黑板资源未入 Store 时也无法分组/过滤，后续条件构造、参数绑定都会失效。
- 高 | **Presentation 参数绑定实现与类型不一致**：`PresentationNodeInspector.tsx:31-105` 将 `parameters` 当作自由键值对象并在 Wait 节点写入 `parameters.duration`，而 `types/common.ts`/`types/presentation.ts` 期望 `ParameterBinding[]`、Wait 类型使用顶层 `duration`。`utils/presentation.ts:11-24` 在 normalize 时会丢弃/覆盖这些字段，导致参数丢失且无法与导出模型对齐。
- 中 | **软删除/生命周期仅覆盖节点局部变量**：`utils/resourceLifecycle.ts` + `nodeParamsReducer` 只处理 Node Local，未扩展到 Stage Local / Global 变量、脚本、事件，UI 也无 MarkedForDelete 标识或“应用删除”流程，阶段一 P1-T03 未闭环。
- 中 | **条件/触发器/参数修改 UI 未与模型对齐**：`components/Inspector/ConditionEditor.tsx` 使用自由输入，未接入变量/脚本选择器与作用域校验；参数修改器 UI 缺失；`TransitionInspector` 的触发器列表未标记/过滤 MarkedForDelete 事件，仍为文本输入。P1-T05/T06 要求的统一抽象尚未落地。
- 中 | **黑板视图缺失**：当前仅在节点 Inspector 内通过 `BlackboardEditor` 管理局部变量，无全局“Variables/Scripts/Events”只读/编辑视图、筛选与引用查询，无法满足 P1 阶段“定义源头”与软删除入口。
- 低 | **入口文件与资源引用问题**：`index.html:16` 引用不存在的 `/index.css` 且重复引入 `index.tsx` 两次；部分源码缺少中文注释且存在乱码注释（如 `types/puzzleNode.ts`），不符合项目语言规范。

## 结论与建议
- 立即补齐数据模型管线：让 `ProjectData`/Store/API/Mock 保持与 `types/project.ts` 一致（含 blackboard 与 scripts manifest），加载/保存时携带资源状态与版本。
- 统一变量创建/编辑：`BlackboardEditor` 与 reducer 中强制填充 `key/state/scope`，复用 `withScope`/软删除工具，并在 UI 显示状态标记。
- 修正 Presentation 参数与类型：改用 `ParameterBinding[]`，Wait 使用顶层 `duration`，ScriptCall 参数遵循 ValueSource（Constant/VariableRef+scope），更新 normalize/Inspector 读写。
- 落地条件/触发器/参数修改 UI：接入变量/事件/脚本选择器并校验作用域、MarkedForDelete 状态；实现参数修改器面板。
- 补全黑板视图与引用查询：提供全局 Variables/Scripts/Events 列表、筛选与软删除操作入口，为后续阶段的编辑/校验打基础。
- 清理入口与注释：修正 `index.html` 资源引用，逐步补充核心逻辑的中文注释与乱码修复。

# Phase3 设计与实施计划（P3-T01 ~ P3-T09）
> 版本：1.0.0 | 更新时间：2025-12-11  
> 范围：阶段三「核心编辑功能（PuzzleNode 内部复杂逻辑）」全量任务的目标重述、UX 流程要点提炼、技术方案与风控。

---

## 1. 任务目标与约束（依据 Task_Breakdown）
- **总体目标**：在已完成只读浏览的基础上，优先让策划可完整编辑单个 PuzzleNode 的内部状态机与事件逻辑，覆盖局部变量、状态/转移编辑、触发器、条件、参数修改、演出绑定等核心链路。
- **任务清单**：
  - P3-T01：PuzzleNode 局部变量的增删改，校验唯一性与引用检查。
  - P3-T02：状态节点的增删改、重命名、初始状态设置、拖拽布局（含撤销重做）。
  - P3-T03：状态生命周期脚本绑定与事件监听配置（引用黑板资源，暂不新建）。
  - P3-T04：Transition 连接的创建/删除及基础属性编辑。
  - P3-T05：触发器编辑（Always/OnEvent/CustomScript，多条记录）。
  - P3-T06：条件构造器编辑（变量条件、自定义脚本、And/Or 嵌套，作用域过滤与类型校验）。
  - P3-T07：参数修改器配置（目标作用域、操作类型、值来源常量/变量）。
  - P3-T08：演出绑定与参数传递（Transition/State，脚本/子图，支持临时参数）。
  - P3-T09：画布编辑体验补全 & 基础校验（初始状态提示、软删引用标记、撤销重做正确性）。
- **约束**：
  - 仅前端，严格遵循现有 types/store 架构与 Slice 拆分；不直接调用 API 以外的数据入口。
  - 软删除规则、ID/Key 规则、作用域规则必须与 `Domain_Model.md`/`Architecture_Guide.md` 保持一致。
  - 所有 UI 文字与文档输出使用中文；关键代码需中文注释解释意图。
  - 文档更新位置：`overview/dev/Phase3/`；核心设计应先行落地后再编码。

---

## 2. 相关 UX_Flow 要点提炼（与阶段三任务直接相关）
- **FSM 画布交互**：无限画布，Space/中键/Alt 平移，Ctrl+滚轮缩放；右键菜单 Add State、Link、Delete；Shift+拖创建连线；Ctrl+拖虚线切断连线；节点/连线可多选、拖拽、Delete 删除；Set Initial。
- **Inspector - State**：可编辑名称/描述、设初始状态按钮、生命周期脚本绑定、事件监听列表。
- **Inspector - Transition**：可编辑名称/描述/From/To/优先级；触发器列表（Always/OnEvent/CustomScript）；条件构造器；演出绑定；参数修改器。
- **局部参数管理**：点击 FSM 画布空白选中 PuzzleNode 本体，在 Inspector 管理 Node Local Variables，作用域仅当前节点及子演出图。
- **演出绑定**：可绑定 Performance Script 或 Presentation Graph，脚本模式显示参数传递（脚本参数 + 临时参数创建）；Graph 模式可跳转编辑。
- **软删除与警示**：引用已标记删除的资源需提示（红标），但不阻塞编辑；应用删除需二次确认。

---

## 3. 技术设计
### 3.1 数据结构与类型
- 复用 `types/` 现有定义（VariableDefinition/State/Transition/ConditionExpression/ParameterModifier/PresentationBinding/TriggerConfig 等），必要时仅在类型文件补充缺失字段的可选性或注释，不修改既有语义。
- 作用域与引用：
  - 变量引用统一携带 `variableScope`（Global/StageLocal/NodeLocal/Temporary）+ `variableId`。
  - 脚本/事件引用使用 `id`，展示时通过 manifest 映射名称；引用已软删时带警示标记。
  - 演出绑定 `presentation` 字段沿用 `{ type: 'Script'|'Graph', scriptId/graphId, parameters[] }`。

### 3.2 状态管理（store）
- **Slice 覆盖**：
  - `fsmSlice`: 负责 State/Transition 的 CRUD、布局更新、初始状态设置、触发器/条件/参数修改器/演出绑定的存取；集成撤销重做快照。
  - `nodeParamsSlice`（或现有节点相关 slice）：管理 PuzzleNode Local Variables 的增删改、唯一性校验与引用检查入口。
  - `ui`：记录画布交互态（多选、连线模式、切割模式提示）与轻量校验提示。
- **Action 设计**：
  - State：`ADD_STATE`, `UPDATE_STATE_META`, `DELETE_STATE`, `SET_INITIAL_STATE`, `MOVE_STATE`.
  - Transition：`ADD_TRANSITION`, `UPDATE_TRANSITION_META`, `DELETE_TRANSITION`, `UPDATE_TRANSITION_TRIGGER`, `UPDATE_TRANSITION_CONDITION`, `UPDATE_TRANSITION_PRESENTATION`, `UPDATE_TRANSITION_MODIFIERS`.
  - Node Var：`ADD_NODE_VAR`, `UPDATE_NODE_VAR`, `REMOVE_NODE_VAR`，附带校验结果（warning/error）写入 message stack。
- **校验策略**（轻量实时，不阻塞编辑）：
  - Node Local 变量名唯一（同节点）。
  - Transition 至少有触发器或强制执行逻辑，否则标记 warning。
  - FSM 缺少初始状态时，在画布边缘/Inspector 提示。
  - 引用软删资源时标记 warning（使用 utils/resourceLifecycle）。

### 3.3 组件与 UI 设计
- **Canvas 层**（`components/Canvas/StateMachineCanvas.tsx` + hooks）：
  - 扩展交互：Shift+拖建连、Ctrl+线切、右键菜单新增/删除/Set Initial、节点/连线多选与拖拽。
  - 显示层：节点标题区显示名称+初始箭头；连线上小标签展示触发器摘要（Always/OnEvent xN/Script）；软删引用红警标。
  - 空白点击 -> 选中 PuzzleNode 本体，右侧切换到 Node Inspector（局部变量）。
- **Inspector**：
  - **PuzzleNode 层**：局部变量列表（表格式：名称/类型/默认值/状态/引用计数），新增/编辑/删除，删除时做引用检查提示。
  - **State Inspector**：名称/描述输入，初始状态按钮，生命周期脚本选择器（过滤软删），事件监听列表（事件选择器 + Action 配置）。
  - **Transition Inspector**：基础信息（From/To/优先级/描述），触发器编辑器（多条，类型切换显示对应字段），条件构造器（嵌套 And/Or + 变量/脚本节点，作用域筛选），演出绑定编辑器，参数修改器列表（目标作用域/变量/操作/值来源选择器）。
  - 选择器类统一复用资源选择组件，带软删红标，空态 placeholder。
- **弹窗/确认**：
  - 删除 Node Local 变量时若被引用 -> 弹警示（不可阻塞删除？按 UX 仅提示即可，阻塞逻辑可留到校验阶段）。
  - 软删除「应用删除」沿用全局弹窗组件（若已有）。

### 3.4 交互与快捷键
- 遵循 `Interaction_Guide.md`：
  - Pan/Zoom、右键菜单、Shift 拖线、Ctrl 切割、Delete 删除、ESC 取消选中、Ctrl+Z/Y 撤销重做。
  - Inspector 编辑输入框即时更新到 store（节流/防抖视情况而定）。
  - 多选拖拽时批量更新位置。

### 3.5 路由与导航
- 维持现有导航：双击 PuzzleNode 卡片进入 FSM 视图；面包屑/左侧树同步；进入演出子图时记忆返回位置（已在 Phase2 修复）。
- Transition Inspector 中的演出绑定「编辑子图」按钮跳转到 Presentation 编辑器，并缓存返回位置（State 不支持演出绑定）。

### 3.6 错误处理与消息堆栈
- 所有阻塞/重要异常（如创建 Transition 时缺少目标/源）通过 `ADD_MESSAGE` 推送到 message stack。
- 轻量警告（无初始状态、无触发器、软删引用）以 UI 标记 + 可选 message stack warning。
- 删除变量/状态/连线触发引用检查时，将引用摘要写入 warning message，便于追踪。

### 3.7 测试与验证（手动为主）
- 画布交互：建/删/拖/多选/切割/Set Initial/撤销重做。
- Inspector 编辑：状态名/描述/脚本绑定/事件监听；Transition 触发器/条件/演出/参数修改器增删改。
- 局部变量：重名校验、类型修改、删除时引用提示；作用域过滤在条件构造器与参数修改器中正确生效。
- 警告提示：无初始状态提示；无触发器 warning；软删引用红标。
- 导航：从 Inspector 跳转到演出子图再返回保持上下文。

---

## 4. 里程碑与执行顺序
1) P3-T01：Node Local 变量管理（含校验/提示），奠定引用过滤基础。  
2) P3-T02：State CRUD + 布局 + 初始状态 + 撤销重做。  
3) P3-T04 + P3-T05：Transition 基础 + 触发器编辑。  
4) P3-T06：条件构造器集成（复用 utils/variableScope + conditionBuilder）。  
5) P3-T07：参数修改器配置。  
6) P3-T08：演出绑定与参数传递（仅 Transition Inspector）。
7) P3-T03：State 事件监听 & 生命周期脚本绑定（需资源选择器完善）。  
8) P3-T09：体验补全与轻量校验、软删警示、测试回归。  

---

## 5. 风险与缓解
- **类型耦合**：新字段应与 `types/*` 同步，避免 UI 与 store 不一致。缓解：先改类型，再更新 reducer/组件，TypeScript 报错兜底。
- **撤销重做膨胀**：画布操作频繁导致快照大。缓解：合并批量拖拽操作；必要时对布局更新做节流。
- **条件/参数选择器复杂度**：作用域过滤/类型匹配易错。缓解：集中封装变量选择器，复用 `utils/variableScope.collectVisibleVariables`，对类型不匹配给出即时错误提示。
- **软删引用提示漏报**：需在渲染层和 Inspector 都检测。缓解：封装 `isMarkedForDelete` 标记渲染，结合 message stack 记录。 

---

## 6. 后续文档与跟进
- 每个子任务完成后在本文件追加实现摘要与测试记录，必要时拆分子文档（如 Condition Builder 详设、Parameter Modifier 详设）。
- 若实现中发现 UX_Flow 与可行性冲突，需在文档中说明变更并对齐新的交互方案。

---

## 7. P3-T01 实施记录
- **功能落地**：在 Node Inspector 提供完整的 Node Local Variables 管理，支持新增/重命名/改类型/默认值/删除，删除时检测 FSM/演出子图等引用位并推送 warning 消息。双击下钻 FSM 后默认选中 PuzzleNode 本体，便于先配置局部变量。
- **技术方案**：
  1) 新增 `utils/variableReferences.ts` 计算 NodeLocal 变量引用（条件、参数修改器、演出绑定、EventListener 等）；
  2) 重写 `BlackboardEditor`：名称唯一校验、类型切换带默认值重置、删除引用提示、自定义确认弹窗（遵循 UI_Style_Guide）、message stack 提示，布尔值使用下拉选择；
  3) `StateMachineCanvas` 进入时默认 SELECT PuzzleNode，符合“下钻默认选中”要求；
  4) 开启全局可编辑（`ui.readOnly=false`），解除阶段二的只读限制以便阶段三开发。
- **UI 调整**：为 Inspector 全局表单行 (`.prop-row`) 引入自适应网格布局，新增 `inspector-inline-row` 用于并列输入控件（名称/类型/按钮同列），在缩窄右侧面板时自动收缩控件宽度而非简单换行；变量新增行已应用该布局。
- **手动测试**：
  - 各类型新增/重命名/删除，重名会阻止并提示；
  - 在 Transition 条件/参数修改器中绑定 NodeLocal 变量，再在 Inspector 删除该变量时有引用提示与 warning 消息；
  - 双击 Stage 概览进入 FSM 时，侧栏默认选中 PuzzleNode；
  - 取消只读后，ADD/UPDATE_NODE_PARAM 可正常触发撤销/重做快照。
- **已知限制/后续**：
  - 变量首写约束仍需在条件构造器/参数编辑器里补齐作用域过滤与即时提示；
  - 软删 `MarkedForDelete` 的 UI 标记尚未全局覆盖，计划在 P3-T09 或阶段四统一处理。

## 8. P3-T02 实施记录
- **功能落地**：状态节点增删改体验补全；首个新增状态自动设为初始状态；状态 Inspector 支持名称/描述编辑、初始状态按钮；保持画布拖拽、删除连线同步更新初始状态与选中。
- **布局优化**：为 Inspector 行新增 `inspector-row` 通用样式，Stage/Node/State/Transition 等 Inspector 的脚本选择、表单输入行改用自适应布局，随右侧面板宽度收缩控件而非简单换行；新建变量行保持单行紧凑布局。
- **UI 语言**：本轮新增/改动的 UI 文本已统一切换为英文（变量删除弹窗、Canvas 右键菜单、画布信息覆盖层、默认状态名称等），避免中文残留；**后续所有新文案必须保持英文**，若需本地化需另开任务。
- **交互提示**：修复 Ctrl 切线模式的光标/线条对齐问题；Info Overlay 显示 Cut/Link/Pan 模式状态；新增底部可折叠的快捷键提示面板（短按按钮切换），指引新手用户。
- **手动验证**：
  - 画布右键新增状态后，若无初始状态则自动设为初始；可拖拽、重命名、删除状态，删除后相关连线同步移除；
  - Inspector 窄宽度下各输入行收缩但不折行，可用性提升。
- **待办/风险**：
  - 触发器/条件/参数等复杂编辑器仍需后续统一应用自适应行样式（P3-T03~T07推进时补齐）；
  - 默认名称/优先级等可考虑再做本地化与校验提示。

## 9. P3-T03 实施记录
- **功能落地**：
  - State Inspector 增加 OnEnter / OnExit 脚本绑定，复用 Lifecycle/State 脚本筛选，支持清除。
  - 事件监听编辑器完善：默认新增监听为 InvokeScript（调用状态生命周期 OnEventInvoke），支持切换 ModifyParameter 并通过 ParameterModifierEditor 编辑目标变量/作用域/操作/值来源；软删除资源保留红色提示。
- **技术要点**：
  - `EventAction.InvokeScript` 允许省略 scriptId 以匹配“调用当前生命周期脚本”语义，保留兼容字段。
  - `ResourceSelect` 支持传入样式/类名以适配紧凑布局；参数修改器/值来源编辑器沿用统一资源选择器与软删告警。
- **手动测试**：
  - 状态绑定/清除 Lifecycle、OnEnter、OnExit 脚本；软删脚本选中时展示警示。
  - 新增监听后切换为 ModifyParameter，编辑目标变量与来源，保存并撤销/重做；InvokeScript 动作说明文案显示正确。
- **已知限制/后续**：
  - 监听器未做必填校验（空事件/变量仍可保存），计划在 P3-T09 统一校验与警告；
  - 未实现“跳转到定义”入口，待阶段四统一打通跨视图导航。

> 更新：生命周期脚本不再区分 OnEnter/OnExit，统一使用单个 lifecycleScript 入口；此前 OnEnter/OnExit 选择器已移除，旧数据字段保留兼容但 UI 不再暴露。
## 10. P3-T03 UI 补充：事件监听/参数修改器
- 抽离 VariableSelector 组件，集成变量下拉、类型/作用域筛选、搜索，保持单行与 UI_Style_Guide 的硬质风格。
- 整平事件监听器、参数修改器下拉高度，选项使用边框+文字色区分类型/作用域，沿用本地变量编辑的配色习惯。
- 控件宽度动态收缩防止换行，lifecycle script 选择与 Clear 按钮高度对齐，消除过高下拉造成的不一致。

## 11. P3-T04 画布连线基础编辑补充
- 画布 Shift/右键创建连线时拦截同向重复边（同一 from->to 仅保留一条），仍允许自环；新增连线自动选中便于 Inspector 编辑。
- 新连线默认名称按当前数量递增（Transition N），优先级设为现有最大值+1，保持有序可编辑。

## 12. P3-T06 条件构造器补充
- ConditionEditor 依赖可见变量列表自动过滤软删，并在变量选择时同步作用域，选项展示 scope/type。
- 布尔/字符串/枚举仅允许 ==/!= 操作符，数值允许全套比较，减少类型不匹配；缺失变量或软删变量给出警示。

## 13. P3-T01 组件拆分：LocalVariableEditor（Node/Stage 通用）
- **目标**：将 BlackboardEditor/NodeLocalVariableEditor 合并为通用 LocalVariableEditor，未来无论 PuzzleNode 还是 Stage 的局部变量都能复用，减少耦合与重复实现。
- **技术实现**：LocalVariableEditor 支持 ownerType="node"|"stage"，Node 场景默认派发 ADD/UPDATE/DELETE_NODE_PARAM，Stage/其他场景可通过回调自定义；保留名称校验、类型切换重置默认值、引用确认、失焦校验等逻辑。旧文件保留为别名以兼容存量引用。
- **集成点**：NodeInspector 改用 LocalVariableEditor；StageInspector 以只读模式复用同一组件以统一展示样式。
- **手动验证**：在 FSM 画布空白选中 PuzzleNode 后，验证新增/重命名/切换类型/删除变量与引用提示行为，表现与拆分前一致；Stage Inspector 仅展示不可编辑列表。

## 14. P3-T08 UI 微调：演出绑定临时参数双下拉并排
- **目标**：遵循 UX_Flow 6.3「参数传递」中的并行控件排布，确保临时参数的 `Type` 与 `Value Source Type` 下拉在 Inspector 窄宽度下仍保持同一行、各占 50% 宽度且不强制最小宽度。
- **实现**：在 `PresentationBindingEditor` 的临时参数卡片中，移除固定宽度与换行；改为 `flex: 1 1 50% + minWidth: 0` 的并列布局，并为下拉控件增加 `overflow: hidden + textOverflow: ellipsis + whiteSpace: nowrap` 以隐藏超长文案。
- **验证**：在 Inspector 缩窄宽度场景下，两个下拉控件保持单行并排、随容器收缩；选项文字超出时被截断，不再出现折行或溢出遮挡。

## 15. P3-T08 UI 微调补充：参数区域文案全局 nowrap
- **目标**：参数传递区域的标题、提示、小标签与按钮文本全部禁用换行，溢出以隐藏/省略号处理，防止窄侧栏出现多行挤压。
- **实现**：引入通用 `noWrapText` 样式（whiteSpace: nowrap + overflow hidden + textOverflow ellipsis），应用于参数区域的标题、提示文案、标签与按钮，确保控件内外文字统一单行呈现。
- **验证**：缩窄 Inspector 后，Parameters 标题、提示文案、各字段标签与删除/新增按钮文本均保持单行显示，超长文本被截断不换行。

## 16. P3-T08 UI 微调补充：参数行自适应与按钮等分
- **目标**：
  1) Target Param Name 输入框随 Inspector 变窄可收缩；
  2) VariableSelector 占位文案不再换行；
  3) Add Parameter / Temporary Parameter 按钮宽度自适应且等分父容器。
- **实现**：
  - 为 Target Param Name 输入所在行与输入框添加 `minWidth: 0`，释放收缩空间；
  - VariableSelector 占位符添加 nowrap+ellipsis；
  - 按钮容器改为 `flexWrap: nowrap`，按钮设定 `flex: 1 1 50%`、`minWidth: 0` 并居中对齐，保证等宽并随父容器收缩。
- **验证**：在窄侧栏下，Target Param Name 行与按钮行不再溢出/换行，两个按钮等宽分布；Select variable 占位符单行截断。

## 17. P3 UI 微调：Add 类按钮样式统一
- **问题**：`+ Add Parameter Modifier`、`+ Add Parameter`、`+ Add Listener`、`+ Add Trigger` 按钮存在边框/字体/hover 状态不一致，影响 Inspector 区域一致性。
- **调整**：新增 `.btn-add-ghost` 虚线边框按钮样式（统一字体、padding、hover 反馈与禁用态），并将上述四个按钮替换为该样式，保留各自布局（宽度/间距/高度）以兼容现有栅格。
- **验证**：
  - Transition Inspector、Event Listeners、Trigger Editor、Presentation Binding 中的新增按钮均呈虚线边框、11px 字重 500 文本；
  - Hover 时背景/边框高亮一致；
  - ReadOnly/disabled 时透明度下降且不可点击。

## 18. P3-T09 实施记录：画布校验与错误标记
- **功能落地**：
  - 在 FSM 画布上实现局部即时校验，当节点/连线引用已删除资源时显示红色错误标记。
  - 在 Info Overlay（画布左上角）显示无初始状态警告。
  - State 节点引用已删除脚本/变量/事件时，显示红色边框和警告图标（⚠）。
  - Transition 连线引用已删除资源时，连线和标签变为红色并显示警告图标。
  - 鼠标悬停在错误节点/连线上时，tooltip 显示具体错误信息。
- **技术实现**：
  - 新增 `utils/fsmValidation.ts` 校验工具，提供 `checkStateValidation`、`checkTransitionValidation`、`validateStateMachine` 函数。
  - 校验涵盖：生命周期脚本、事件监听器、触发器、条件表达式、参数修改器、演出绑定中的资源引用。
  - 修改 `StateNode.tsx` 添加 `hasError`、`errorTooltip` 属性，错误时显示红色边框和警告图标。
  - 修改 `ConnectionLine.tsx` 添加错误状态下的红色连线和标签样式。
  - 修改 `TempConnectionLine.tsx` 添加 `arrow-error` 箭头标记定义。
  - 修改 `CanvasOverlays.tsx` 的 `CanvasInfoOverlay` 添加无初始状态警告显示。
  - 在 `StateMachineCanvas.tsx` 中使用 `useMemo` 计算并缓存校验结果，传递给节点和连线组件。
- **校验规则**：
  - 检测 `MarkedForDelete` 状态的脚本、事件、变量引用。
  - 支持 Global、StageLocal、NodeLocal 作用域的变量引用检查。
  - 递归检查条件表达式中的 And/Or/Not/Comparison/ScriptRef/VariableRef。
- **手动测试**（待用户验证）：
  - 进入 FSM 画布，在 Blackboard 将某脚本标记为 `MarkedForDelete`，观察引用该脚本的状态/连线是否显示红色警告。
  - 检查无初始状态时 Info Overlay 是否显示警告。
  - 验证 tooltip 显示具体错误信息。
- **已知限制/后续**：
  - 演出图（PresentationGraph）暂无软删除状态，相关引用暂不校验。
  - 当前为被动校验，未来可考虑在导出时进行阻断性校验。

## 19. P3-T01 补充：局部变量软删二段确认
- **背景**：Implemented 状态的局部变量第一次删除应仅软删除、锁定编辑，二次确认后才物理移除，避免误删生产变量。
- **方案**：LocalVariableEditor 引入三态删除模式：`soft-delete`（Implemented → MarkedForDelete）、`hard-delete`（MarkedForDelete → 物理移除）、`delete`（Draft/其他直接删除）。MarkedForDelete 变量在列表中置灰，所有表单控件禁用，但保留右上角删除按钮以便应用删除。
- **交互**：
  - 首次删除 Implemented 变量弹窗提示“Mark For Delete”，确认后变为 MarkedForDelete 并锁定；
  - 已 MarkedForDelete 再次删除弹窗“Apply Delete (Irreversible)”，明确不可撤销，确认后彻底移除；
  - 无引用的 Implemented 变量可直接删除，自动进入 MarkedForDelete 并锁定；有引用时仍需确认；
  - 引用预览仍显示前 5 条，消息堆栈分别推送 warning/info。
- **手动测试**：
  1) 对 Implemented 变量执行首次删除 -> 状态变 MarkedForDelete、输入/选择控件禁用、卡片置灰；
  2) 再次点击删除 -> 弹出不可撤销提示并确认，变量从列表移除；
  3) Draft 变量无引用时仍可直接删除，带引用时弹一次确认。

## 20. P3-T09 UI 清理：画布样式外置
- **变更**：将 FSM/Presentation 画布的上下文菜单项 `.ctx-item` 与连线手柄 `.handle` 样式从组件内联 `<style>` 移入全局 `styles.css`，避免重复定义并保持主题一致。
- **影响面**：`StateMachineCanvas`、`StateMachineCanvas.generated`、`PresentationCanvas` 移除内联样式块；全局样式沿用现有橙色强调配色，无功能行为变更。
- **测试**：手动打开 FSM 画布右键菜单与拖拽连线手柄，外观与交互与改前一致（hover 态颜色与透明度仍正确）。

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
  - P3-T06：条件构造器编辑（变量条件、自定义脚本、AND/OR 嵌套，作用域过滤与类型校验）。
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
  - **State Inspector**：名称/描述输入，初始状态按钮，OnEnter/OnExit 脚本选择器（过滤软删），事件监听列表（事件选择器 + Action 配置）。
  - **Transition Inspector**：基础信息（From/To/优先级/描述），触发器编辑器（多条，类型切换显示对应字段），条件构造器（嵌套 AND/OR + 变量/脚本节点，作用域筛选），演出绑定编辑器，参数修改器列表（目标作用域/变量/操作/值来源选择器）。
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
- Transition/State Inspector 中的演出绑定「编辑子图」按钮跳转到 Presentation 编辑器，并缓存返回位置。

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
6) P3-T08：演出绑定与参数传递（Transition/State Inspector）。  
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

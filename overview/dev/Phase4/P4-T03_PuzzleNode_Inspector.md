# P4-T03 PuzzleNode Inspector 编辑设计

## 任务目标与约束
- 开放 PuzzleNode Inspector 的基础编辑能力：支持删除节点（多节点场景弹窗确认）、编辑 Name 与 Description。
- 复用已有生命周期脚本绑定、事件监听、参数修改配置的编辑能力，保持 UI 文案为英文。
- 删除操作复用已实现的确认弹窗组件，遵循“多节点时提示，单节点可直接删除”规则。
- 重要代码保留中文注释；遵循现有 Inspector UI 样式，读写受 `readOnly` 控制。

## 相关 UX Flow 摘要
- 参考 UX_Flow 4.4（PuzzleNode 选中 Inspector）：Header 展示类型标签与名称，Basic Info 展示 ID/Type/Description；Lifecycle Script 下拉选择；Event Listeners 列表；Local Variables 管理。
- 单击节点卡片后 Inspector 更新，所有显示文案使用英文。

## 技术设计
- **数据来源与动作**：
  - 使用 `project.nodes[nodeId]` 作为单体数据源，更新通过 `UPDATE_NODE` action（`name`、`description`、`lifecycleScriptId`、`eventListeners` 等）。
  - 删除节点派发 `DELETE_PUZZLE_NODE`，Reducer 已负责清理关联 FSM 以及 UI 选择态回退。
- **可见变量收集**：沿用 `collectVisibleVariables` 计算 Scope（Stage + Node），过滤掉 `MarkedForDelete`。
- **UI/交互**：
  1) **Header + Delete**：使用与 Stage Inspector 相同的 header 样式及 `Trash2` 图标按钮；`readOnly` 时隐藏删除按钮。
     - 统计当前 Stage 下的 PuzzleNode 数量（`getStageNodeIds`），数量 > 1 时点击删除弹出 ConfirmDialog，显示节点名与 Stage 名提示；数量 = 1 时直接删除。
  2) **Basic Info**：
     - ID 只读、Type 只读；Name/Description 使用 `search-input` 样式输入控件，可编辑，`readOnly` 时降级为纯文本。
  3) **Lifecycle Script**：保留 ResourceSelect，保持 warn-on-marked-delete 逻辑，可清空。
  4) **Event Listeners**：沿用 `EventListenersEditor`，指向 `UPDATE_NODE` 结果。
  5) **Local Variables**：继续使用 `LocalVariableEditor`，读写能力由 `readOnly` 控制。
- **文案与可用性**：弹窗、占位符等全部使用英文；删除确认列出 stage 内节点数量提示不可撤销。

## 测试用例（计划）
1) 编辑 Name/Description：输入后切换选中再返回，文本保持更新。
2) 删除仅有单个节点的 Stage：点击删除直接移除节点并回退选择到所属 Stage。
3) Stage 下存在多个节点：点击删除弹窗出现，确认后节点与 FSM 被移除，取消不会修改数据。
4) Lifecycle Script 选择/清空：选择一项后状态更新，清空按钮正常；标记删除的脚本显示警告。
5) readOnly 模式：输入框、删除按钮不可操作，Event/Variable 区域禁用。

## 实施状态
- 已按方案更新 NodeInspector：开放 Name/Description 编辑，添加删除按钮与多节点确认弹窗，沿用生命周期脚本/事件监听/局部变量编辑能力并统一 Inspector 样式。
- 移除 PuzzleNode Type 字段：数据与 Inspector Basic Info 均不再展示/使用。
- Nodes 面板右键删除弹窗补充 Reference Preview（Stage 名称、同级节点计数），与 Inspector 删除行为保持一致。
- 测试：本地未运行浏览器验证，需在实际页面中手动验证“删除确认”“字段编辑”“readOnly”禁用等场景。
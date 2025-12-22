# 黑板局部变量拖拽排序修复设计（2025-12-23）

## 1. 任务定位与需求重述
- **对应任务**：P4-T01 黑板资源全功能编辑（变量/脚本/事件）。
- **问题背景**：黑板 Variables 页签中，Stage/Node 的局部变量卡片支持拖拽排序，但当前拖拽后新顺序与用户释放位置不一致。
- **约束**：仅允许同一作用域（同一 Stage 或同一 Node）内重排；UI 必须保持英文；遵循 UX_Flow 的分组展示与只读模式。

## 2. 相关 UX 流程要点（来自 `overview/UX_Flow.md`）
- Variables 标签页分组展示：`Global Variables`、`Local Variables`（Stage Local / Node Local）。
- 局部变量卡片展示 Scope、类型、默认值、State，支持点击/双击跳转。
- 列表交互遵循列表拖拽排序规范：拖拽时只影响同列表内顺序，不应污染其他分组。

## 3. 问题分析
- 现有 `DraggableCard` 在 `onDragOver`/`onDragEnter` 时未校验拖拽源的 `dragType`，只要存在 `application/json` 类型就会调用回调。
- Blackboard 局部变量使用 `dragType` 编码了作用域（如 `local-var-Stage-<id>`），但因缺少校验，当拖拽跨过其他分组卡片时，`hoverIndex` 会被外部列表覆盖，导致最终排序位置偏移。

## 4. 技术方案
- **拖拽事件过滤**：在 `DraggableCard` 的 `onDragOver`/`onDragEnter`/`onDrop` 中解析 `dataTransfer`，仅当 `dragType` 与当前卡片的 `dragType` 完全一致时才设置 `isDragOver` 并触发外部回调；否则直接返回并保持 dropEffect 为 `none`。
- **状态管理**：继续复用 `BlackboardPanel` 的全局 `dragStateRef`，但只有同类型事件才能更新 `hoverIndex`，避免跨分组污染。
- **兼容性**：保持 `dragType` 写入 `dataTransfer` 的格式 `{ dragType, id, index }` 不变，其他使用 `DraggableCard` 的列表（全局变量、事件、脚本、图等）同样受益于类型过滤，避免跨类别排序偏移。

## 5. 风险与测试计划
- **风险**：解析 `dataTransfer` 失败时应静默降级，避免抛异常阻断拖拽；确保禁用拖拽时仍可正常点击。
- **测试用例（手动）**：
  1. 同一 Stage 的局部变量上下拖动，松手后顺序与视觉一致。
  2. 拖动 Stage 变量经过 Node 区域但在 Stage 区域松手，最终顺序仍按 Stage 目标位置排列。
  3. 全局变量/事件/脚本拖拽排序仍然正常，不会被其他分组干扰。

## 6. 实现与验证记录
- **实现**：在 `components/Blackboard/DraggableCard.tsx` 中增加拖拽数据解析与 `dragType` 过滤，只有同类型卡片才更新 hover 状态和排序索引，避免跨分组污染 `hoverIndex`。
- **验证**：
  - 代码层面检查：跨分组拖拽时 `dropEffect` 被置为 `none`，不会再触发局部变量排序回调。
  - 尚未进行真实浏览器手动拖拽演示，后续需在 UI 中回归上述 3 条用例。

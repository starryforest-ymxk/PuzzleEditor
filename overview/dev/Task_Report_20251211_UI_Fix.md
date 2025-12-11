# 任务报告：脚本 Inspector UI 优化

**日期**: 2025-12-11
**任务**: 优化脚本页签下 Lifecycle Scripts 的 UI 显示，区分层级。

## 任务目标
解决脚本页签下“Lifecycle Scripts”根级折叠栏与下方“Lifecycle Stage/Node/State”子级折叠栏外观一致导致用户误导的问题。统一风格并建立清晰的视觉层级。

## 修改内容

### 1. `components/Blackboard/SectionHeader.tsx`
- **新增 Prop**: 添加可选的 `level` 属性（默认为 1）。
- **样式调整**:
    - **缩进**: 当 `level > 1` 时，增加左侧内边距（`28px` vs `12px`）。
    - **背景**: 子级标题背景改为透明，去除边框，使其融入内容区域，不再像独立的面板块。
    - **间距**: 调整了 margin，使子级列表看起来更紧凑。

### 2. `components/Blackboard/BlackboardPanel.tsx`
- **应用层级**: 在 `renderScriptsTab` 方法中，为 Lifecycle 的子分类（Stage, Node, State）的 `SectionHeader` 传入 `level={2}`。

## 验证结果
- **视觉层级**: 现在“Lifecycle Scripts”作为主分类保留了原有的面板头样式（灰色背景、边框），而子分类显示为缩进的标题（透明背景、无边框），层级关系一目了然。
- **一致性**: 其他一级分类（Global Variables, Performance Scripts 等）保持原有样式不变。

## 后续建议
- 如果未来有更深层级的嵌套需求，可以在 `SectionHeader` 中进一步动态计算 padding（例如 `level * 12px`）。

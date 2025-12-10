# 面包屑后退历史优化

## 背景
- 需求：后退按钮应回到“上一个显示的页面”（历史栈），而不是简单的层级父级；即使在 Demo Puzzle Project 根级别也不隐藏按钮。

## 实现
- `store/ui` 增加 `navStack`（stageId/nodeId/graphId），`NAVIGATE_TO` 在上下文变化时将当前上下文压栈。
- 新增 `NAVIGATE_BACK` Action：弹出历史栈顶并导航到对应上下文，清理选择与多选。
- `Breadcrumb` 的后退按钮改为触发 `NAVIGATE_BACK`，并在根级仍显示（若栈为空则禁用）。

## 测试建议
- 在 Stage/Node/演出图间跳转后点击后退，确认返回到上一访问的视图（而非单纯父级）。
- 在根级（项目级）也可点击后退返回上一视图；无历史时按钮呈禁用态且保持显示。

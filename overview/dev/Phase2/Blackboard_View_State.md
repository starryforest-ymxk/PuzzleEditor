# 黑板视图状态记忆修复记录

## 背景
- 切换 Editor → Blackboard → Editor 时编辑器能保留上次位置，但 Blackboard → Editor → Blackboard 后黑板回到初始页签，缺少跨视图记忆。

## 修改
- 在 `store/ui` 中新增 `blackboardView` 状态（activeTab/filter/expandedSections），并提供 `SET_BLACKBOARD_VIEW` action 持久化。
- `components/Blackboard/BlackboardPanel.tsx` 初始化本地状态时读取全局记忆，切换页签、搜索或折叠分组时同步写回全局，确保跨视图切换后仍保持上次视图。
- 补充导航清理：`NAVIGATE_TO` 在 Stage/Node 导航时自动清空 `currentGraphId`，`StageExplorer` 与 `NodeList` 显式传入 `graphId: null`，避免黑板中打开演出图后切回 Stage 时画布仍停留在旧演出图。
- 演出图返回记忆：`NAVIGATE_TO` 进入演出图时缓存当前 stage/node 上下文；`Breadcrumb` 在演出图视图显示“Presentation · 名称”，点击返回或末级的返回按钮时回到缓存的编辑器位置。
- 面包屑命名对齐：演出图面包屑仅显示项目名/演出图名，不再带 “Presentation · ” 前缀，与状态机显示保持一致。

## 测试建议
- 切换到黑板视图，调整为 Scripts 页签、输入搜索词、折叠某分组。
- 切换回编辑器，再切回黑板，确认页签/搜索/折叠状态保持。

# P2 阶段代码审查 - 第二轮（2025-12-10）

## 一、审查目标

对照 `Task_Breakdown.md` 阶段二核心目标："在没有任何编辑能力的前提下，先让策划「可以打开一个工程，完整地浏览所有数据结构和关系」"，审查当前代码的 **UI 表现完整性** 和 **架构设计合理性**。

---

## 二、第一轮审查问题修复情况

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| 1 | LOAD 按钮绕过归一化与导航 | ✅ 已修复 | `Header.tsx` 现在调用 `normalizeProjectForStore()` 并派发 `NAVIGATE_TO` 导航到根 Stage |
| 2 | 面包屑 Root 点击导致空画布 | ✅ 已修复 | `Breadcrumb.tsx` 的 `handleNavigate()` 现在正确导航到 `rootStageId` |
| 3 | Node 面包屑不可点击 | ✅ 已修复 | 现在支持 NODE 和 GRAPH 类型的导航 |
| 4 | Blackboard 筛选维度缺失 | ✅ 已修复 | `BlackboardPanel.tsx` 新增 `stateFilter` 和 `varTypeFilter` 下拉筛选器 |
| 5 | Stage 展开状态污染数据 | ✅ 已修复 | 展开状态现存储于 `ui.stageExpanded`，与 `project.stageTree` 分离 |
| 6 | 错误消息未展示 | ✅ 已修复 | `Header.tsx` 新增 Messages 下拉面板，显示 `ui.messages` |
| 7 | 初始 Stage 标记依赖顺序 | ✅ 已修复 | `StageExplorer.tsx` 现在优先读取 `stage.isInitial` 字段 |

---

## 三、阶段二核心目标达成度评估

### 3.1 工程加载与内存模型构建 [P2-T01] ✅

- `store/context.tsx` 的 `loadProjectData()` 统一处理 API 加载与归一化
- `Header.tsx` 本地导入同样使用 `normalizeProjectForStore()` 保证一致性
- 版本兼容/字段补全在 `utils/projectNormalizer.ts` 中处理

### 3.2 顶层导航框架与路由 [P2-T02] ✅

- 三栏布局（Explorer / Canvas / Inspector）结构完整
- 路由逻辑：`Canvas.tsx` 按 `graphId > nodeId > stageId` 优先级切换视图
- 面包屑同步更新，支持返回（`navStack` + `NAVIGATE_BACK`）

### 3.3 阶段树只读视图 [P2-T03] ✅

- `StageExplorer.tsx` 递归渲染完整阶段树
- 支持展开/折叠、当前选中高亮、初始阶段标记
- 点击树节点触发 `NAVIGATE_TO` 切换画布

### 3.4 Stage 内容概览只读视图 [P2-T04] ✅

- `StageOverview.tsx` 以卡片形式展示子 Stage 和 PuzzleNode
- 单击卡片更新 Inspector；双击 PuzzleNode 进入 FSM 编辑器
- 点击空白区域选中当前 Stage

### 3.5 Blackboard 只读视图 [P2-T05] ✅

- `BlackboardPanel.tsx` 实现四页签：Variables / Scripts / Events / Graphs
- 支持名称/Key 搜索、状态筛选、类型筛选
- 点击条目在 Inspector 中展示详情
- 双击演出图/状态机可跳转编辑器

### 3.6 PuzzleNode FSM 画布只读视图 [P2-T06] ✅

- `StateMachineCanvas.tsx` 实现无限画布，支持平移（Space/中键/Alt+左键）和缩放
- 渲染所有 State 节点和 Transition 连线
- 支持 `readOnly` 属性抑制编辑操作
- 点击节点/连线在 Inspector 显示详情

### 3.7 演出子图只读视图 [P2-T07] ✅

- `PresentationCanvas.tsx` 渲染演出图节点和连线
- Blackboard Graphs 页签列出所有演出图和状态机
- Inspector 显示节点/图的完整属性

### 3.8 基础保存与导出 [P2-T08] ✅

- `Header.tsx` 的 `handleExport()` 序列化完整项目结构
- 导出包含 `manifestVersion`、`exportedAt`、完整 `project` 对象
- 加载→导出的数据一致性得到保证

---

## 四、架构与设计问题

### 4.1 状态管理架构

#### 4.1.1 Reducer 文件过大（中等优先级）✅ 已修复

**问题**：`store/reducer.ts` 已达 507 行，随着功能增加将难以维护。

**现状**：虽然已提取 `fsmSlice.ts`、`presentationSlice.ts`、`nodeParamsSlice.ts`，但主 reducer 仍包含大量 Action 处理。

**修复状态**：✅ 已完成（2025-12-10）

**修复说明**：
- 新增 4 个 Slice 文件，将业务逻辑按功能域拆分：
  - `blackboardSlice.ts` - 变量、事件、脚本的 CRUD 操作
  - `navigationSlice.ts` - 视图切换、导航跳转、返回
  - `uiSlice.ts` - 选择、面板尺寸、黑板视图、消息
  - `projectSlice.ts` - Stage 树、Node 基础更新
- 主 `reducer.ts` 从 507 行减少到约 200 行
- 主 reducer 仅保留：初始化逻辑 + Undo/Redo 包装 + Slice 分发
- 最终目录结构：
  ```
  store/slices/
    ├── fsmSlice.ts (已有)
    ├── presentationSlice.ts (已有)
    ├── nodeParamsSlice.ts (已有)
    ├── blackboardSlice.ts (新增)
    ├── navigationSlice.ts (新增)
    ├── uiSlice.ts (新增)
    └── projectSlice.ts (新增)
  ```

#### 4.1.2 Action 类型定义冗长（低优先级）

**问题**：`store/types.ts` 的 `Action` 联合类型有 40+ 个变体，阅读和维护成本高。

**建议**：
- 按功能域拆分 Action 类型到对应 Slice 文件
- 在 `types.ts` 中使用 `type Action = FsmAction | StageAction | ...` 聚合

### 4.2 组件设计

#### 4.2.1 Inspector.tsx 过大（高优先级）✅ 已修复

**问题**：`Inspector.tsx` 达到 692 行，包含 9 种选中类型（STAGE/NODE/STATE/TRANSITION/FSM/GRAPH/VARIABLE/SCRIPT/EVENT）的完整渲染逻辑。

**影响**：
- 难以阅读和维护
- 任何选中类型变化都需重新解析整个文件
- 违反单一职责原则

**修复状态**：✅ 已完成（2025-12-10）

**修复说明**：
- 主 `Inspector.tsx` 已重构为约 110 行的纯路由分发组件
- 所有 9 种选中类型的渲染逻辑已委托给独立的子检查器组件
- 最终目录结构：
  ```
  Inspector/
    ├── Inspector.tsx (路由组件，约 110 行)
    ├── StageInspector.tsx (226 行)
    ├── NodeInspector.tsx (114 行)
    ├── StateInspector.tsx
    ├── TransitionInspector.tsx
    ├── PresentationNodeInspector.tsx
    ├── FsmInspector.tsx (117 行)
    ├── GraphInspector.tsx (77 行)
    ├── VariableInspector.tsx (116 行)
    ├── ScriptInspector.tsx (82 行)
    └── EventInspector.tsx (57 行)
  ```

#### 4.2.2 StateMachineCanvas.tsx 过大（中等优先级）✅ 已修复

**问题**：`StateMachineCanvas.tsx` 达到 645 行，包含：画布导航、节点拖拽、连线创建、框选、切线模式、上下文菜单等大量逻辑。

**修复状态**：✅ 已完成（2025-12-10）

**修复说明**：
- 主 `StateMachineCanvas.tsx` 从 645 行减少到 586 行
- 将 UI 渲染逻辑拆分到独立组件：
  - `CanvasContextMenu.tsx` - 右键菜单组件（136 行）
  - `CanvasOverlays.tsx` - 覆盖层组件集合（171 行）
    - `CanvasInfoOverlay` - 左上角信息提示
    - `BoxSelectOverlay` - 框选区域视觉反馈
    - `SnapPointsLayer` - 吸附点提示层
    - `CuttingLineOverlay` - 切线视觉反馈
  - `TempConnectionLine.tsx` - 临时连线和箭头标记（67 行）
    - `TempConnectionLine` - 临时连线预览
    - `ConnectionArrowMarkers` - SVG 箭头定义
- 最终目录结构：
  ```
  Canvas/Elements/
    ├── StateNode.tsx (已有)
    ├── ConnectionLine.tsx (已有)
    ├── CanvasContextMenu.tsx (新增)
    ├── CanvasOverlays.tsx (新增)
    └── TempConnectionLine.tsx (新增)
  ```

#### 4.2.3 BlackboardPanel.tsx 过大（中等优先级）✅ 已修复

**问题**：`BlackboardPanel.tsx` 达到 633 行，包含四个页签的所有渲染逻辑和多种卡片样式。

**修复状态**：✅ 已完成（2025-12-10）

**修复说明**：
- 主 `BlackboardPanel.tsx` 从 633 行减少到约 270 行
- 提取了 8 个独立的子组件：
  - `StateBadge.tsx` - 资源状态徽章组件
  - `SectionHeader.tsx` - 可折叠分区头部组件
  - `VariableCard.tsx` - 全局变量卡片组件
  - `LocalVariableCard.tsx` - 局部变量卡片组件（带作用域信息）
  - `ScriptCard.tsx` - 脚本卡片组件
  - `EventCard.tsx` - 事件卡片组件
  - `GraphCard.tsx` - 演出图卡片组件
  - `FsmCard.tsx` - 状态机卡片组件
- 最终目录结构：
  ```
  Blackboard/
    ├── BlackboardPanel.tsx (主面板，约 270 行)
    ├── StateBadge.tsx (状态徽章)
    ├── SectionHeader.tsx (可折叠分区头)
    ├── VariableCard.tsx (全局变量卡片)
    ├── LocalVariableCard.tsx (局部变量卡片)
    ├── ScriptCard.tsx (脚本卡片)
    ├── EventCard.tsx (事件卡片)
    ├── GraphCard.tsx (演出图卡片)
    └── FsmCard.tsx (状态机卡片)
  ```

### 4.3 类型系统

#### 4.3.1 类型定义分散（低优先级）✅ 已修复

**问题**：部分类型（如 `LocalVarWithScope`）在组件内部定义，影响复用。

**修复状态**：✅ 已完成（2025-12-10）

**修复说明**：
- `LocalVarWithScope` 类型已从 `LocalVariableCard.tsx` 移至 `types/blackboard.ts`
- 相关组件已更新导入路径

#### 4.3.2 可选字段处理不一致

**问题**：部分代码使用 `stage.localVariables || {}`，部分使用可选链 `stage.localVariables?.xxx`，存在潜在一致性问题。

**建议**：统一使用可选链或明确在归一化阶段保证字段存在。

### 4.4 样式与 UI

#### 4.4.1 内联样式过多（低优先级）✅ 已修复

**问题**：大量组件使用内联 `style={{...}}`，导致：
- 样式难以复用
- 无法利用 CSS 变量的完整能力
- 代码膨胀

**修复状态**：✅ 已完成（2025-12-10）

**修复说明**：
- 在 `styles.css` 中添加了 20+ 个常用样式类：
  - 网格布局：`.card-grid`、`.card-grid--with-margin`
  - 分区标题：`.section-title`
  - 卡片元素：`.card-header`、`.card-name`、`.card-key`、`.card-description`、`.card-type-value-row`
  - 作用域徽章：`.scope-badge`
  - 表单控件：`.search-input`、`.filter-select`
  - Blackboard 布局：`.blackboard-container`、`.blackboard-header`、`.blackboard-tabs`、`.blackboard-search`、`.blackboard-filters`、`.blackboard-content`
  - Inspector 布局：`.inspector-header`、`.inspector-section`、`.inspector-section--readonly`
  - 局部变量列表：`.local-var-list`、`.local-var-item`
- 已重构组件：
  - `BlackboardPanel.tsx` - 将网格布局、搜索框、筛选器样式替换为 CSS 类
  - `VariableCard.tsx` / `LocalVariableCard.tsx` - 将卡片元素样式替换为 CSS 类
  - `StageInspector.tsx` - 将分区标题、Inspector 头部、局部变量列表样式替换为 CSS 类

#### 4.4.2 缺少响应式适配

**问题**：面板尺寸固定为像素值，在小屏幕上可能无法正常使用。

**建议**：
- 设定最小宽度约束
- 考虑添加面板折叠功能

### 4.5 性能考量

#### 4.5.1 大数据渲染优化缺失（可延后至阶段五）

**问题**：当前 Blackboard 卡片列表、FSM 节点列表均使用简单 `.map()` 渲染，当数据量大时可能产生性能问题。

**现状**：阶段二为只读浏览，数据量通常可控。

**建议**（可延后至阶段五）：
- 对大列表实施虚拟滚动（如 `react-window`）
- 对画布节点实施视口裁剪

### 4.6 代码质量

#### 4.6.1 重复代码（可延后至阶段五）

**问题**：`renderVariableCard`、`renderLocalVariableCard`、`renderScriptCard` 等存在大量相似结构。

**建议**：抽取通用 `ResourceCard` 组件，通过 props 控制差异部分。

#### 4.6.2 中文/英文混用 ✅ 已修复

**问题**：部分 UI 文案使用英文（如 "No description."），部分使用中文（如状态筛选器的"状态: All"）。

**修复状态**：✅ 已完成（2025-12-10）

**修复说明**：
- 统一使用英文 UI 文案
- 已翻译组件：
  - `BlackboardPanel.tsx` - 搜索、筛选器、分区标题、空状态提示
  - `Inspector.tsx` - 路由组件中的空状态提示
  - `StageInspector.tsx` - 分区标题、标签、占位符等
  - `NodeInspector.tsx` - 分区标题、标签等
  - `VariableInspector.tsx` - 分区标题、标签、作用域描述等
  - `FsmInspector.tsx` - 分区标题、标签、空状态提示等
  - `GraphInspector.tsx` - 分区标题、标签、空状态提示等
  - `ScriptInspector.tsx` - 分区标题、标签、类别名称等
  - `EventInspector.tsx` - 分区标题、标签等
  - `Header.tsx` - 导入成功/失败消息


---

## 五、总结与建议

### 5.1 阶段二目标达成情况

| 任务 | 状态 | 说明 |
|------|------|------|
| P2-T01 项目加载与内存模型 | ✅ 完成 | 归一化流程完整 |
| P2-T02 顶层导航框架 | ✅ 完成 | 三栏布局 + 路由切换 + 面包屑 |
| P2-T03 阶段树只读视图 | ✅ 完成 | 递归渲染 + 展开折叠 + 初始标记 |
| P2-T04 Stage 内容概览 | ✅ 完成 | 卡片展示 + 单击/双击交互 |
| P2-T05 Blackboard 只读视图 | ✅ 完成 | 四页签 + 搜索 + 筛选 |
| P2-T06 FSM 画布只读视图 | ✅ 完成 | 无限画布 + 节点/连线渲染 |
| P2-T07 演出子图只读视图 | ✅ 完成 | 图列表 + 画布渲染 |
| P2-T08 基础保存与导出 | ✅ 完成 | JSON 序列化 |

**结论**：阶段二核心目标已全部达成，策划可以打开工程并完整浏览所有数据结构和关系。

### 5.2 架构改进建议优先级

| 优先级 | 问题 | 影响 | 状态 |
|--------|------|------|------|
| 高 | Inspector.tsx 过大 | 维护困难 | ✅ 已修复 |
| 中 | Reducer 过大 | 扩展困难 | ✅ 已修复 |
| 中 | StateMachineCanvas 过大 | 维护困难 | ✅ 已修复 |
| 中 | BlackboardPanel 过大 | 维护困难 | ✅ 已修复 |
| 低 | 内联样式过多 | 样式复用差 | ✅ 已修复 |
| 低 | 类型定义分散 | 复用性差 | ✅ 已修复 |

### 5.3 后续建议

1. ~~**进入阶段三前**：优先拆分 `Inspector.tsx`，为编辑功能开发打好基础~~ ✅ 已完成
2. ~~**阶段三期间**：随编辑功能开发逐步拆分 Canvas 组件~~ ✅ StateMachineCanvas 已拆分
3. ~~**阶段四期间**：完成 Reducer 的 Slice 化改造~~ ✅ 已提前完成
4. ~~**阶段五（体验优化）**：拆分 BlackboardPanel~~ ✅ 已提前完成
5. ~~**阶段五（体验优化）**：统一 UI 语言、添加虚拟滚动、减少内联样式~~ ✅ 内联样式已大幅减少

---

## 六、测试说明

本次为静态代码审查，未执行自动化测试或完整的手动流程验证。审查基于代码阅读和第一轮审查结果的对比分析。

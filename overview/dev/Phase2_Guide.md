# 阶段二开发指南（Phase 2 Development Guide）

> 本文档指导阶段二（核心浏览与只读展示）的开发工作，基于阶段一搭建的基础架构。
>
> **目标**: 在没有任何编辑能力的前提下，先让策划「可以打开一个工程，完整地浏览所有数据结构和关系」。

---

## 1. 阶段二任务概览

| 任务 | 描述 | 优先级 | 依赖 |
|------|------|--------|------|
| P2-T01 | 项目加载与内存模型构建 | 高 | - |
| P2-T02 | 顶层导航框架与路由 | 高 | P2-T01 |
| P2-T03 | 阶段树只读视图 | 高 | P2-T02 |
| P2-T04 | Stage 内容概览只读视图 | 中 | P2-T03 |
| P2-T05 | Blackboard 只读视图 | 中 | P2-T01 |
| P2-T06 | PuzzleNode FSM 画布只读视图 | 中 | P2-T04 |
| P2-T07 | 演出子图只读视图 | 低 | P2-T06 |
| P2-T08 | 基础保存与导出（无校验） | 低 | P2-T01 |

---

## 2. 开发前置条件

### 2.1 已完成的基础设施

阶段一已提供以下基础设施，可直接使用：

| 模块 | 状态 | 说明 |
|------|------|------|
| `types/*` | ✅ | 完整的领域模型定义 |
| `store/types.ts` | ✅ | EditorState, Action 类型 |
| `store/reducer.ts` | ✅ | 主 Reducer + Undo/Redo |
| `store/context.tsx` | ✅ | Context + loadProjectData |
| `api/mockService.ts` | ✅ | Mock 数据加载 |
| `hooks/useCanvasNavigation.ts` | ✅ | 画布平移 |
| `hooks/useGraphInteraction.ts` | ✅ | 图形交互 |
| `components/Canvas/StateMachineCanvas.tsx` | ✅ | FSM 画布（可复用） |

### 2.2 现有 UI 结构

当前 `components/Layout/MainLayout.tsx` 结构：

```
┌─────────────────────────────────────────────────────────┐
│                      TopBar                              │
├─────────┬───────────────────────────────┬───────────────┤
│ Explorer│        Main Content           │   Inspector   │
│  (Tree) │     (概览/画布/黑板)          │   (属性面板)  │
└─────────┴───────────────────────────────┴───────────────┘
```

---

## 3. 各任务实现指南

### P2-T01 项目加载与内存模型构建

**目标**: 完善项目加载流程，确保数据完整注入 Store

**现状**: `loadProjectData` 已实现基础加载

**待完善**:
1. 添加版本兼容性处理（旧字段缺省填默认值）
2. 添加加载错误处理和 UI 反馈
3. 添加加载进度指示

**参考代码位置**:
- `store/context.tsx` - `loadProjectData`
- `api/mockService.ts` - `loadProject`

---

### P2-T02 顶层导航框架与路由

**目标**: 实现视图切换和面包屑导航

**实现要点**:

1. **路由状态设计**（在 `store/types.ts` 扩展）:
```typescript
interface NavigationState {
  view: 'EDITOR' | 'BLACKBOARD';
  breadcrumb: BreadcrumbItem[];
  currentStageId: StageId | null;
  currentNodeId: PuzzleNodeId | null;
}
```

2. **面包屑组件**（新建 `components/Layout/Breadcrumb.tsx`）:
   - 显示当前位置：`Root > Stage > PuzzleNode`
   - 支持点击跳转
   - 包含"返回上级"按钮

3. **视图切换**:
   - TopBar 中添加 `Editor | Blackboard` 切换按钮
   - 根据 `view` 状态渲染对应内容

---

### P2-T03 阶段树只读视图

**目标**: 完善阶段树浏览功能

**现状**: `StageExplorer.tsx` 已实现基础树形展示

**待完善**:
1. 标记初始 Stage（蓝色 `▶` 图标）
2. 优化选中高亮样式
3. 同步面包屑更新
4. 添加搜索/筛选功能（可选）

---

### P2-T04 Stage 内容概览只读视图

**目标**: 显示 Stage 下的子 Stage 和 PuzzleNode 卡片列表

**实现要点**:

1. **卡片组件**（新建 `components/Explorer/ContentCard.tsx`）:
```typescript
interface ContentCardProps {
  type: 'STAGE' | 'PUZZLE_NODE';
  id: string;
  name: string;
  description?: string;
  isInitial?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}
```

2. **交互逻辑**:
   - 单击 Stage 卡片 → Inspector 显示 Stage 属性
   - 单击 Node 卡片 → Inspector 显示 PuzzleNode 属性
   - 双击 Node 卡片 → 进入 FSM 画布视图
   - 点击空白 → Inspector 显示当前 Stage 属性

---

### P2-T05 Blackboard 只读视图

**目标**: 实现全局黑板管理视图（只读）

**实现要点**:

1. **页签结构**（新建 `components/Blackboard/BlackboardView.tsx`）:
   - Variables 页签：全局变量列表
   - Scripts 页签：脚本定义列表（按分类分组）
   - Events 页签：事件定义列表

2. **列表项显示**:
   - 名称、Key、类型、状态（Draft/Implemented/Deleted）
   - 状态颜色：Draft(灰)、Implemented(绿)、MarkedForDelete(红)

3. **筛选功能**:
   - 按名称搜索
   - 按状态筛选
   - 按类型筛选（Scripts 页签）

---

### P2-T06 PuzzleNode FSM 画布只读视图

**目标**: 在只读模式下展示 FSM 结构

**现状**: `StateMachineCanvas.tsx` 已实现完整交互

**待完善**:
1. 添加只读模式 prop，禁用编辑操作
2. 保留平移/缩放功能
3. 点击节点/连线仍能在 Inspector 显示详情

---

### P2-T07 演出子图只读视图

**目标**: 展示 PresentationGraph 结构

**现状**: `PresentationCanvas.tsx` 已存在基础实现

**待完善**:
1. 完善节点渲染（ScriptCall/Wait/Branch/Parallel）
2. 添加只读模式
3. 实现从其他位置跳转到演出图

---

### P2-T08 基础保存与导出（无校验）

**目标**: 实现最基础的保存和导出功能

**实现要点**:

1. **保存功能**:
```typescript
// store/context.tsx
export const saveProjectData = async (dispatch: Dispatch<Action>, state: EditorState) => {
  const exportManifest: ExportManifest = {
    manifestVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    project: state.project
  };
  await apiService.saveProject(exportManifest);
};
```

2. **导出功能**:
   - 生成 JSON 文件下载
   - 验证"加载→无修改→导出"结果一致性

---

## 4. 开发顺序建议

```
P2-T01 (项目加载)
    │
    ├──→ P2-T02 (导航路由)
    │        │
    │        ├──→ P2-T03 (阶段树)
    │        │        │
    │        │        └──→ P2-T04 (内容概览)
    │        │                │
    │        │                └──→ P2-T06 (FSM只读)
    │        │                        │
    │        │                        └──→ P2-T07 (演出只读)
    │        │
    │        └──→ P2-T05 (黑板视图)
    │
    └──→ P2-T08 (保存导出)
```

---

## 5. 验收标准

完成阶段二后，应能够：

- [x] 加载 Mock 项目数据到 Store
- [ ] 通过面包屑在不同层级间导航
- [ ] 在阶段树中选择 Stage 并查看内容概览
- [ ] 查看 PuzzleNode 的 FSM 画布（只读）
- [ ] 查看全局黑板中的变量/脚本/事件列表
- [ ] 将当前项目保存/导出为 JSON

---

## 6. 相关文档

- [领域模型](./Domain_Model.md) - 数据结构定义
- [架构指南](./Architecture_Guide.md) - 项目架构和规范
- [UX 流程](../UX_Flow.md) - 用户交互设计
- [任务拆解](../Task_Breakdown.md) - 完整任务列表

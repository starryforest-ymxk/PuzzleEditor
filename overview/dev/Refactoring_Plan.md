# 代码复用重构计划

> **创建时间**: 2026-02-19  
> **范围**: 已完成 P0 级统一删除重构后，对剩余重复逻辑的全面整合  
> **目标**: 消除约 1,150+ 行重复代码，提升可维护性

---

## 目录

- [已完成的重构（P0 级）](#已完成的重构p0-级)
- [待重构项总览](#待重构项总览)
- [实施步骤](#实施步骤)
  - [Step 1：底层工具函数](#step-1底层工具函数无-ui-依赖风险最低)
  - [Step 2：Inspector 名称编辑 Hook](#step-2inspector-名称编辑-hook最大收益项)
  - [Step 3：引用列表 UI 组件](#step-3引用列表-ui-组件h2h3-合并)
  - [Step 4：Restore/Delete 操作整合](#step-4restoredelete-操作整合h6h7)
  - [Step 5：导航辅助函数](#step-5navigate_to--select_object-整合m2可选)
  - [Step 6：Validation 层重复整合](#step-6validation-层重复整合m4m5m6)
- [关键设计决策](#关键设计决策)
- [验证方式](#验证方式)
- [实施进度](#实施进度)

---

## 已完成的重构（P0 级）

| 编号 | 内容 | 新增/修改文件 | 状态 |
|------|------|-------------|------|
| P0-1 | 统一删除逻辑到 `useDeleteHandler` | `hooks/useDeleteHandler.ts` | ✅ 完成 |
| P0-2 | 统一确认对话框到 `GlobalConfirmDialog` | `components/Layout/GlobalConfirmDialog.tsx` | ✅ 完成 |
| P1-1 | 提取 `navigateToReference` 工具函数 | `utils/referenceNavigation.ts` | ✅ 完成 |
| P1-2 | 合并重复 `ConfirmDialog` 组件 | 删除 `condition/ConfirmDialog.tsx` | ✅ 完成 |
| P2-1 | 合并键盘快捷键 Hook | 删除 `hooks/useKeyboardShortcuts.ts` | ✅ 完成 |
| P2-2 | 提取 `filterActiveResources` / `filterActiveOrSelected` | `utils/resourceFilters.ts` | ✅ 完成 |

---

## 待重构项总览

### HIGH 优先级（H1-H7）

| 编号 | 重复模式 | 涉及文件数 | 每处行数 | 总重复量 | 计划步骤 |
|------|---------|-----------|---------|---------|---------|
| H1 | Name/AssetName 本地编辑 + 失焦校验 + 自动翻译样板 | 7 | 40-65 | ~374 行 | Step 2 |
| H2 | References Section JSX 渲染模板 | 4 | 42-48 | ~183 行 | Step 3 |
| H3 | `handleReferenceClick` useCallback 包装器 | 5 | 3-4 | ~18 行 | Step 3（合并入 H2） |
| H4 | `pushMessage` 内联定义（ADD_MESSAGE dispatch） | 4 | 5 | ~20 行 | Step 1a |
| H5 | `eventOptions`/`scriptOptions` ResourceOption 构建 | 5 | 10-25 | ~85 行 | Step 1d |
| H6 | Restore + Delete 按钮条件渲染 JSX | 3 | 32 | ~96 行 | Step 4b |
| H7 | `handleRestore` 恢复逻辑 | 4 | 5-10 | ~28 行 | Step 4a |

### MEDIUM 优先级（M1-M6）

| 编号 | 重复模式 | 涉及文件数 | 总重复量 | 计划步骤 |
|------|---------|-----------|---------|---------|
| M1 | `Object.values(nodes).find(n => n.stateMachineId === fsmId)` 查找 | 5 文件 8 处 | ~12 行 | Step 1c |
| M2 | NAVIGATE_TO + SELECT_OBJECT 双重 dispatch | 6 | ~44 行 | Step 5 |
| M3 | `ProjectLike` 接口在 4 个 validation 文件中重复定义 | 4 | ~28 行 | Step 1b |
| M4 | 条件表达式脚本引用检查（fsmValidation vs presentationValidation） | 2 | ~70 行 | Step 6a |
| M5 | 引用追踪文件的项目遍历骨架（Stage→Node→FSM→Graph） | 3 | ~180 行 | Step 6b（评估） |
| M6 | `owningNode` + `visibleVars` 计算模式 | 2 | ~13 行 | Step 6c |

---

## 实施步骤

### Step 1：底层工具函数（无 UI 依赖，风险最低）

#### 1a. H4 — 提取 `usePushMessage` Hook

- **新建**: `hooks/usePushMessage.ts`
- **签名**: `function usePushMessage(): (level: MessageLevel, text: string) => void`
- **实现要点**:
  - 内部调用 `useEditorDispatch()`
  - ID 格式采用更健壮的 `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  - 返回 `useCallback` 包裹的函数
- **替换位置**（4 处内联 `pushMessage`）:
  - `components/Inspector/VariableInspector.tsx` L186-L190
  - `components/Inspector/ScriptInspector.tsx` L86-L90
  - `components/Inspector/EventInspector.tsx` L106-L110
  - `components/Inspector/LocalVariableEditor.tsx` L119-L123
- **附带重构**: `useDeleteHandler.ts` 和 `useProjectActions.ts` 中的私有 `pushMessage` 也改为调用此共享 Hook

#### 1b. M3 — 统一 `ProjectLike` 接口

- **修改**: `utils/validation/types.ts`（新增导出）
- **统一定义**（取最大并集，所有字段在所有调用点都满足，因为传入的都是完整 project 对象）:
  ```typescript
  export interface ProjectLike {
      nodes: Record<string, PuzzleNode>;
      stateMachines?: Record<string, StateMachine>;
      presentationGraphs?: Record<string, PresentationGraph>;
      stageTree: { stages: Record<string, StageNode> };
  }
  ```
- **替换位置**（4 处各自定义的 `ProjectLike`）:
  - `utils/validation/scriptReferences.ts` L14-L21
  - `utils/validation/eventReferences.ts` L13-L20
  - `utils/validation/globalVariableReferences.ts` L14-L22
  - `utils/validation/presentationGraphReferences.ts` L13-L19
- **差异处理**: `eventReferences` 和 `presentationGraphReferences` 原本没有 `presentationGraphs?`，但该字段是可选的，增加不影响

#### 1c. M1 — 提取 `findNodeByFsmId` 工具函数

- **修改**: `utils/puzzleNodeUtils.ts`（追加函数）
- **签名**: `function findNodeByFsmId(nodes: Record<string, PuzzleNode>, fsmId: string): PuzzleNode | undefined`
- **替换位置**（5 文件共 8 处）:
  - `components/Inspector/StateInspector.tsx` L93
  - `components/Inspector/TransitionInspector.tsx` L44
  - `components/Inspector/FsmInspector.tsx` L27
  - `components/Blackboard/BlackboardPanel.tsx` L321
  - `utils/validation/rules/validateStructure.ts` L89, L102, L182, L199（4 处）

#### 1d. H5 — 提取 `ResourceOption` 构建工具函数集

- **新建**: `utils/resourceOptions.ts`
- **导出函数**:
  ```typescript
  // 从 blackboard.events 构建事件选项列表
  getEventOptions(project): ResourceOption[]
  
  // 全部脚本选项
  getScriptOptions(project): ResourceOption[]
  
  // 按 category 和可选 lifecycleType 过滤脚本选项
  getScriptOptionsByCategory(
      project, 
      category: string, 
      lifecycleType?: string
  ): ResourceOption[]
  
  // 从 presentationGraphs 构建演出图选项，可选排除指定 ID
  getGraphOptions(project, excludeGraphId?: string): ResourceOption[]
  ```
- **复用类型**: `ResourceOption` 从 `components/Inspector/ResourceSelect.tsx` 已有定义（考虑移到 `types/` 下或从 ResourceSelect 导入）
- **替换位置**（5 文件）:
  - `components/Inspector/NodeInspector.tsx` L42-L57
  - `components/Inspector/StageInspector.tsx` L55-L76
  - `components/Inspector/StateInspector.tsx` L100-L125
  - `components/Inspector/TransitionInspector.tsx` L60-L85
  - `components/Inspector/PresentationNodeInspector.tsx` L92-L103
- **注意事项**:
  - Node/Stage 未用 `useMemo` 包裹，State/Transition/PresentationNode 用了 → 提取后由调用方决定是否 `useMemo`
  - `lifecycleScriptOptions` 的 `lifecycleType` 因上下文而异：Node 传 `'Node'`，Stage 传 `'Stage'`，State 传 `'State'`
  - `graphOptions` 中 `state` 始终硬编码 `'Draft'`（因为 `PresentationGraph` 本身没有 `state` 字段）

---

### Step 2：Inspector 名称编辑 Hook（最大收益项）

#### H1 — 提取 `useInspectorNameFields` Hook

- **新建**: `hooks/useInspectorNameFields.ts`
- **签名设计**:
  ```typescript
  interface UseInspectorNameFieldsOptions {
      entity: { name: string; assetName?: string };
      onUpdate: (updates: Record<string, any>) => void;
      allowEmptyName?: boolean;  // Node/Stage 为 true（允许空名），其他为 false（默认）
  }
  
  interface UseInspectorNameFieldsReturn {
      localName: string;
      setLocalName: (v: string) => void;
      localAssetName: string;
      setLocalAssetName: (v: string) => void;
      handleNameBlur: () => Promise<void>;
      handleAssetNameBlur: () => void;
      triggerAutoTranslate: (name: string) => Promise<void>;
  }
  
  function useInspectorNameFields(options: UseInspectorNameFieldsOptions): UseInspectorNameFieldsReturn
  ```
- **内部实现**:
  - `useState` 管理 `localName` / `localAssetName`
  - `useEffect` 同步外部实体变更到本地状态
  - 调用 `useAutoTranslateAssetName` Hook
  - `handleNameBlur`: 根据 `allowEmptyName` 决定是否回退空值
  - `handleAssetNameBlur`: 调用 `isValidAssetName` 校验
- **替换位置**（7 文件，消除约 374 行）:

  | 文件 | 当前行范围 | `allowEmptyName` | `onUpdate` 适配方式 |
  |------|-----------|-----------------|-------------------|
  | NodeInspector.tsx | L35-L97 | `true` | `updateNode({ name: v })` |
  | ScriptInspector.tsx | L78-L128 | `false` | `handleUpdate({ name: v })` |
  | EventInspector.tsx | L57-L99 | `false` | `handleUpdate({ name: v })` |
  | VariableInspector.tsx | L152-L220 | `false` | `handleUpdate({ name: v })` |
  | StageInspector.tsx | L52-L128 | `true` | `updateStage({ name: v })` |
  | StateInspector.tsx | L42-L77 | `false`* | 需包装: `(updates) => handleChange(Object.keys(updates)[0], Object.values(updates)[0])` |
  | LocalVariableCard.tsx | L90-L127 | `false` | 需包装: `(updates) => onUpdate(Object.keys(updates)[0], Object.values(updates)[0])` |

  *StateInspector 的 handleNameBlur 也不检查空值，但考虑统一行为设为 false

- **不包含**: `localDescription` / `localValue`（仅 VariableInspector/ScriptInspector/EventInspector 有，留在原处）

---

### Step 3：引用列表 UI 组件（H2+H3 合并）

#### H2+H3 — 提取 `ReferenceListSection` 组件

- **新建**: `components/Inspector/ReferenceListSection.tsx`
- **Props 设计**:
  ```typescript
  interface ReferenceListSectionProps {
      references: VariableReferenceInfo[];  // 通用引用信息类型
      emptyMessage?: string;               // 默认 "No references found in this project."
      style?: React.CSSProperties;         // 外层 section 样式覆盖
  }
  ```
- **内部实现**:
  - 组件自行调用 `useEditorDispatch()` + `useEditorState()` 获取 `project.nodes`
  - 内化 `handleReferenceClick`：调用 `navigateToReference(dispatch, project.nodes, navContext)`
  - 渲染现有 CSS class：`inspector-section`、`inspector-reference-item`、`inspector-reference-item--clickable`、`inspector-reference-placeholder`
  - 引用项显示 `ExternalLink` 图标（可点击项）
- **替换位置**（4 文件中的 References Section JSX + 5 文件中的 handleReferenceClick 回调）:

  | 文件 | JSX 替换行范围 | handleReferenceClick 移除行 |
  |------|--------------|--------------------------|
  | ScriptInspector.tsx | L326-L362 (~36行) | L163-L165 |
  | EventInspector.tsx | L293-L335 (~42行) | L155-L157 |
  | VariableInspector.tsx | L549-L597 (~48行) | L178-L181 |
  | PresentationGraphInspector.tsx | L198-L245 (~47行) | L79-L82 |
  | LocalVariableEditor.tsx | 无 JSX 替换 | L110-L112（如果不再被使用则移除） |

- **特殊处理**:
  - VariableInspector: Stage 局部变量时传入 `emptyMessage="Reference tracking for Stage local variables is not yet supported."`
  - LocalVariableEditor 中引用导航不通过列表组件，保持直接调用 `navigateToReference`

---

### Step 4：Restore/Delete 操作整合（H6+H7）

#### 4a. H7 — 在 `useDeleteHandler` 中添加 `restoreResource` 方法

- **修改**: `hooks/useDeleteHandler.ts`
- **新增方法签名**:
  ```typescript
  restoreResource(
      resourceType: 'SCRIPT' | 'EVENT' | 'GLOBAL_VARIABLE',
      resourceId: string,
      resourceName: string
  ): void
  ```
- **实现要点**:
  - 根据 `resourceType` 映射 dispatch action type:
    - `'SCRIPT'` → `UPDATE_SCRIPT`
    - `'EVENT'` → `UPDATE_EVENT`
    - `'GLOBAL_VARIABLE'` → `UPDATE_GLOBAL_VARIABLE`
  - 统一 dispatch `{ state: 'Implemented' }`
  - 调用 `pushMessage('info', \`Restored ${typeLabel} "${resourceName}" to Implemented state.\`)`
  - 此时依赖 Step 1a 提取的 `usePushMessage`
- **替换位置**（3 处 `handleRestore`）:
  - `components/Inspector/ScriptInspector.tsx` L150-L154
  - `components/Inspector/EventInspector.tsx` L135-L139
  - `components/Inspector/VariableInspector.tsx` L232-L236
- **排除**: LocalVariableEditor 的恢复逻辑不同（通过 `UPDATE_NODE_PARAM`），不纳入

#### 4b. H6 — 提取 `ResourceActionButtons` 组件

- **新建**: `components/Inspector/ResourceActionButtons.tsx`
- **Props 设计**:
  ```typescript
  interface ResourceActionButtonsProps {
      isMarkedForDelete: boolean;
      onDelete: () => void;
      onRestore: () => void;
      resourceLabel: string;  // "script" / "event" / "variable"，用于 button title
  }
  ```
- **渲染逻辑**:
  - `isMarkedForDelete === true`: 渲染 Restore 按钮（`RotateCcw` 图标 + `btn-xs-restore`）+ Delete 按钮（`Trash2` 图标 + `btn-xs-delete`）
  - `isMarkedForDelete === false`: 渲染单个 Delete 图标按钮（`Trash2` + `btn-icon btn-icon--danger`）
- **替换位置**（3 文件条件渲染 JSX，消除 ~96 行）:
  - `components/Inspector/ScriptInspector.tsx` L187-L212
  - `components/Inspector/EventInspector.tsx` L167-L198
  - `components/Inspector/VariableInspector.tsx` L366-L403

---

### Step 5：NAVIGATE_TO + SELECT_OBJECT 整合（M2，可选）

- **修改**: `utils/referenceNavigation.ts`
- **新增低级辅助函数**:
  ```typescript
  export function navigateAndSelect(
      dispatch: (action: Action) => void,
      navigatePayload: {
          stageId?: string | null;
          nodeId?: string | null;
          graphId?: string | null;
      },
      selectPayload?: {
          type: string;
          id: string;
          contextId?: string;
      }
  ): void
  ```
- **重构**: 现有 `navigateToReference` 内部改为调用 `navigateAndSelect`
- **可选替换位置**（仅明确一致的场景）:

  | 文件 | 出现次数 | 可替换？ | 说明 |
  |------|---------|---------|------|
  | Breadcrumb.tsx | 4 处 | 部分 | ROOT 是特殊 case（不选中），其余 3 处可替换 |
  | StageExplorer.tsx | 2 处 | ✅ | STAGE 选中 |
  | NodeExplorer.tsx | 2 处 | ✅ | NODE 选中 |
  | StageOverview.tsx | 6 处 | 部分 | 双击导航 + 右键导航可替换 |
  | BlackboardPanel.tsx | 3 处 | 部分 | `handleOpenFsm` 只导航不选中，不适用 |
  | ValidationPanel.tsx | 2 处 | ✅ | 按 objectType 导航 |

- **风险**: 中等 — 各组件导航语义不完全相同，建议先提取函数但谨慎替换

---

### Step 6：Validation 层重复整合（M4+M5+M6）

#### 6a. M4 — 提取公共条件表达式脚本引用检查函数

- **新建或修改**: `utils/validation/conditionChecker.ts`（或放入现有的 `utils/conditionBuilder.ts`）
- **提取来源**:
  - `utils/validation/fsmValidation.ts` 的 `checkConditionExpression` (~35 行)
  - `utils/validation/presentationValidation.ts` 的 `checkConditionScriptRefs` (~35 行)
- **统一签名**:
  ```typescript
  function checkConditionScriptReferences(
      condition: ConditionExpression | undefined,
      scriptRecords: Record<string, ScriptDefinition>,
      addIssue: (scriptId: string, scriptName: string) => void
  ): void
  ```
- **差异处理**: 两处的 issue 类型不同（`FsmValidationIssue` vs `ValidationIssue`），通过 `addIssue` 回调抽象差异，调用方各自构建自己的 issue 对象
- **影响**: 消除 ~35 行重复

#### 6b. M5 — 引用追踪遍历骨架（评估项，建议暂缓）

- **涉及文件**:
  - `utils/validation/scriptReferences.ts` `findScriptReferences` 遍历骨架
  - `utils/validation/eventReferences.ts` `findEventReferences` 遍历骨架
  - `utils/validation/globalVariableReferences.ts` `findGlobalVariableReferences` 遍历骨架
- **潜在方案**: 提取通用遍历器 `walkProjectEntities(project, visitors)`:
  ```typescript
  interface ProjectWalkVisitors {
      onStage?: (stage: StageNode) => void;
      onNode?: (node: PuzzleNode) => void;
      onState?: (state: FsmState, fsmId: string, nodeId: string) => void;
      onTransition?: (trans: FsmTransition, fsmId: string, nodeId: string) => void;
      onGraphNode?: (gNode: PresentationNode, graphId: string) => void;
  }
  ```
- **评估**: 
  - ✅ 可消除 ~180 行重复遍历代码
  - ⚠️ 各追踪器的检查逻辑差异较大，visitor 内部仍需各自实现
  - ⚠️ 抽象遍历器会增加间接层，降低单个文件的可读性
  - **建议**: 暂缓实施，仅在新增第 4 种资源引用追踪时再考虑提取

#### 6c. M6 — 提取 `useFsmVisibleVariables` Hook

- **新建**: 可放入 `hooks/` 或作为 `utils/variableScope.ts` 的辅助
- **签名**:
  ```typescript
  function useFsmVisibleVariables(fsmId: string): {
      owningNode: PuzzleNode | undefined;
      visibleVars: VariableDefinition[];
  }
  ```
- **实现要点**:
  - 内部调用 `findNodeByFsmId`（依赖 Step 1c）
  - 内部调用 `collectVisibleVariables(state, owningNode?.stageId, owningNode?.id)`
  - 内部调用 `filterActiveResources(vars.all)`（依赖已有的 `resourceFilters`）
- **替换位置**（2 文件）:
  - `components/Inspector/TransitionInspector.tsx` L43-L51
  - `components/Inspector/StateInspector.tsx` L93-L97
- **影响**: 每文件减少约 5-8 行，更重要的是确保一致性

---

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| `pushMessage` ID 格式 | `msg-${Date.now()}-${random}` | 更健壮，防止快速连续操作的 ID 冲突 |
| `useInspectorNameFields` 的 `onUpdate` 签名 | `(updates: Record<string, any>) => void` | 兼容 partial 对象（大多数 Inspector）和 field+value（State/LocalVariable 调用方包装） |
| `ReferenceListSection` 是否内化 dispatch | ✅ 是 | 消除所有消费方的 `handleReferenceClick` 样板，组件自包含 |
| `restoreResource` 归属 | 放在 `useDeleteHandler` | 删除和恢复是对称操作，放在一起更内聚 |
| M5 遍历骨架是否提取 | ❌ 暂缓 | 各追踪器逻辑差异大，抽象收益低于复杂度成本；等 4+ 种追踪器时再提取 |
| M2 替换范围 | 保守替换 | 各组件导航语义不完全相同（有的只导航不选中），仅替换明确一致的场景 |
| `ResourceOption` 类型定义位置 | 保留在 `ResourceSelect.tsx` 中导出 | 已被多文件使用，无需移动 |

---

## 验证方式

每完成一个 Step 后：

1. **编译检查**: `npx tsc --noEmit` 确认零编译错误
2. **功能验证**: 浏览器中验证受影响的 Inspector 面板：
   - 名称编辑：输入 → 失焦 → 自动保存 + 自动翻译
   - AssetName 校验：非法值失焦回退
   - 引用列表：点击引用项跳转到正确目标
   - 删除/恢复按钮：MarkedForDelete 状态显示 Restore + Delete，正常状态显示 Delete 图标
   - 资源选项下拉：正确筛选 category/lifecycleType
3. **Undo/Redo 测试**: 确认历史管理不受影响
4. **控制台检查**: 无 React 警告或运行时错误

---

## 实施进度

| Step | 内容 | 涉及项 | 预计减少行数 | 状态 |
|------|------|--------|------------|------|
| Step 1a | `usePushMessage` Hook | H4 | ~20 行 | ✅ 完成 |
| Step 1b | 统一 `ProjectLike` 接口 | M3 | ~28 行 | ✅ 完成 |
| Step 1c | `findNodeByFsmId` 工具函数 | M1 | ~12 行 | ✅ 完成 |
| Step 1d | `ResourceOption` 构建函数集 | H5 | ~85 行 | ✅ 完成 |
| Step 2 | `useInspectorNameFields` Hook | H1 | ~374 行 | ✅ 完成 |
| Step 3 | `ReferenceListSection` 组件 | H2+H3 | ~200 行 | ✅ 完成 |
| Step 4a | `restoreResource` 方法 | H7 | ~28 行 | ✅ 完成 |
| Step 4b | `ResourceActionButtons` 组件 | H6 | ~96 行 | ✅ 完成 |
| Step 5 | `navigateAndSelect` 辅助函数 | M2 | ~44 行 | ✅ 完成（保守替换 12 处低风险场景） |
| Step 6a | 条件表达式脚本引用检查 | M4 | ~35 行 | ✅ 完成 |
| Step 6b | 引用追踪遍历骨架 | M5 | ~180 行 | ⏸️ 暂缓 |
| Step 6c | `useFsmVisibleVariables` Hook | M6 | ~13 行 | ✅ 完成 |
| **合计** | | **H1-H7, M1-M6** | **~1,115 行** | **11/12 完成（M5 暂缓）** |

### 新增文件清单

| 文件路径 | Step | 用途 |
|----------|------|------|
| `hooks/usePushMessage.ts` | 1a | 共享消息推送 Hook |
| `utils/resourceOptions.ts` | 1d | ResourceOption 构建工具函数集 |
| `hooks/useInspectorNameFields.ts` | 2 | Inspector 名称/资产名编辑统一 Hook |
| `components/Inspector/ReferenceListSection.tsx` | 3 | 引用列表 UI 组件 |
| `components/Inspector/ResourceActionButtons.tsx` | 4b | Restore/Delete 按钮组件 |
| `utils/validation/conditionChecker.ts` | 6a | 条件表达式脚本引用公共检查函数 |
| `hooks/useFsmVisibleVariables.ts` | 6c | FSM 可见变量 Hook |

### 修改文件清单（按 Step）

- **Step 1a**: 6 个 Inspector/Hook 文件引入 `usePushMessage`
- **Step 1b**: `utils/validation/types.ts` + 4 个引用追踪文件
- **Step 1c**: `utils/puzzleNodeUtils.ts` + 5 个消费方文件
- **Step 1d**: 5 个 Inspector 文件
- **Step 2**: 6 个 Inspector 文件
- **Step 3**: ScriptInspector / EventInspector / VariableInspector / PresentationGraphInspector
- **Step 4a**: `hooks/useDeleteHandler.ts` + ScriptInspector / EventInspector / VariableInspector
- **Step 4b**: ScriptInspector / EventInspector / VariableInspector
- **Step 5**: `utils/referenceNavigation.ts` + Breadcrumb / NodeExplorer / StageExplorer / StageOverview / BlackboardPanel
- **Step 6a**: `utils/validation/fsmValidation.ts` + `utils/validation/presentationValidation.ts`
- **Step 6c**: `components/Inspector/TransitionInspector.tsx` + `components/Inspector/StateInspector.tsx`

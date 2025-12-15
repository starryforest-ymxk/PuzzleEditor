# Stage Tree Drag & Drop Refactor Plan（Stages 面板）

> 目标：在**不改变当前 UX 行为**（尤其是“底部空白区离散档位层级指示线”）的前提下，把现有拖拽逻辑从“状态/DOM/副作用耦合”的实现，重构为**可测试、可扩展、互斥清晰**的拖拽预览与落点应用架构。
>
> 约束：
> - UI 文案继续保持英文（项目全局规则）。
> - 不新增额外 UX（不加新面板/新交互/新动画）。

---

## 1. 当前实现快照（基于现有代码）

### 1.1 节点行（row）
- 在某个 Stage 行上拖拽（二态）：`between | inside`（between 用 `edge=top/bottom` 表达插入在目标前/后）。
- 视觉反馈：依赖 `styles.css` 中 `.tree-node.drop-target-between` 与 `.tree-node.drop-target-inside`。
- Drop：
  - `inside`：`MOVE_STAGE` 到目标 id 下，并 `SET_STAGE_EXPANDED`。
  - `before/after`：同父用 `REORDER_STAGE`，跨父用 `MOVE_STAGE(newParentId=parentId, insertIndex=...)`。

### 1.2 底部空白区（empty area）
- 空白区只显示“离散档位层级指示线”：基于最后一个可见节点的祖先链候选父级（`Root -> ... -> parent(lastVisible)`）。
- 档位选择：按空白区内的相对 Y 值离散吸附；**越靠下越浅**；`bandHeight` 约 8~12px。
- Drop：追加到 `targetParentId.childrenIds` 末尾；如果同父，则用 `REORDER_STAGE` 避免 `MOVE_STAGE` 被 reducer 判定为 no-op。

---

## 2. 主要痛点（为什么值得重构）

1. **拖拽预览状态可组合出“非法组合”**
   - 当前 `DragState` 同时有 `dropTargetId`、`dropPosition`、`dropIndicator`，理论上可以出现：
     - `dropTargetId === 'EMPTY_AREA'` 但 `dropPosition !== null`
     - `dropTargetId === stageId` 但 `dropIndicator !== null`
   - 这些组合虽然大多由代码规避，但类型层面无法约束，后续改动容易引入“同时出现两条线”等回归。

2. **“节点行三态”和“空白区档位线”属于两个预览系统，缺少统一的互斥模型**
   - 视觉是两套（CSS 伪元素 vs 组件内联 div），状态也是两套。

3. **计算逻辑与副作用（dispatch）混在一起，难测试**
   - 例如 `handleDrop/handleEmptyAreaDrop` 内联了大量 index 计算、合法性检查、dispatch。

4. **性能与可控性风险**
   - `onDragOver` 会高频触发，目前每次都可能 `setDragState`；空白区还会做 `querySelectorAll`（虽已限定容器），但依旧属于频繁 DOM 查询。

5. **样式耦合与重复**
   - `styles.css` 存在两段几乎重复的 `.tree-node.drop-target-*`（早期/后期规则叠加）。重构时应收敛，避免未来改一处漏一处。

---

## 3. 重构目标（不改 UX，改结构）

### 3.1 明确一个“拖拽会话状态机”（并强制二态化）
用**判别联合类型**保证互斥：

- `DragSession`: { draggingId, ... }
- `DropPreview`（三选一）：
  1. `null`（无预览）
  2. `row`（在某个行上）
  3. `empty`（在底部空白区）

示例（伪类型）：
- `DropPreview =
  | { kind: 'row'; targetId: StageId; intent: 'inside' | 'between'; edge?: 'top' | 'bottom'; } 
  | { kind: 'empty'; targetParentId: StageId; level: number; leftPx: number; mode: 'full-width' | 'indented'; }
  | null`

> 注意：节点行交互在本计划中**必须**收敛为二态：`between`（插入线）与 `inside`（作为子节点）。不再对外暴露 `before/after` 作为独立语义。

### 3.2 纯计算与副作用分层
把“算落点/算插入 index/算候选档位/算指示线样式”等提炼成纯函数（放到 `utils/`），hook 只负责：
- 采集事件输入（指针位置、目标元素 rect、空白区 rect）
- 调用纯函数得到 `DropPreview`
- 在 drop 时调用纯函数得到 `Action[]` 再 dispatch

### 3.3 视觉反馈统一入口（节点行二态 + 空白区档位线）
- StageExplorer 只读 `DropPreview` 渲染：
  - row：给对应行追加 class 或渲染一条“between/inside”的指示（between 通过 top/bottom edge 表达插入前/后）
  - empty：渲染层级指示线（保持现有 UX）
- 明确互斥：`preview.kind === 'empty'` 时，row 预览必为 null；反之亦然。

---

## 4. 分阶段迁移步骤（每一步都可独立验收）

### Phase 0：安全网与清理（0.5 天）
- 清理 `styles.css` 中重复的 `.tree-node.drop-target-*` 定义，保留一套权威来源。
- 在重构期间保持 class 名不变，避免 UI 回归。

验收：拖拽视觉不变；CSS 无重复冲突。

### Phase 1：用类型系统“锁死互斥”（1 天）
- 把 `DragState` 改为：
  - `draggingId`
  - `preview: DropPreview`
- 让所有 handler 只写 `preview`，不再同时维护 `dropTargetId/dropPosition/dropIndicator`。

验收：
- 空白区永远只显示层级线；行上永远不显示空白区线。
- 现有功能行为完全一致。

### Phase 2：抽纯函数，稳定计算（1 天）
把以下逻辑提炼到 `utils/stageDrag.ts`（或同等位置）：
- `calcRowIntent(pointerY, height) -> { intent: 'between'|'inside'; edge?: 'top'|'bottom' }`
  - 规则：上 25% => between/top；中间 => inside；下 25% => between/bottom。
- `calcSiblingInsertIndex(...)`（含“同父 reorder 修正”，并以 between/top/bottom 推导 insertIndex）
- `getCandidateParentsForEmptyDrop(stageTree, lastVisibleId)`
- `pickEmptyDropLevel({rectHeight, relativeY, candidates, draggingId})`（含非法档位就近跳过策略）
- `toEmptyIndicatorStyle(level) -> {leftPx, mode}`

验收：
- Hook 代码体积明显下降（主要是编排逻辑）。
- 单元测试可直接覆盖纯函数（如果项目已有测试框架则加；若没有，则先写手动用例清单）。

状态：已完成。
- 纯计算函数已落地到 [utils/stageDrag.ts](utils/stageDrag.ts)
- Hook 已改为编排为主并调用纯函数：[hooks/useStageDrag.ts](hooks/useStageDrag.ts)

### Phase 3：节点行二态化（between vs inside）（必须，1 天）
本阶段把“节点行三态”彻底收敛为二态，作为本计划的硬性交付。

- 交互语义：
  - `between`：插入到目标同级（由 `edge=top/bottom` 决定插入在目标前/后）
  - `inside`：作为目标子节点（维持现有“drop 后自动展开”）
- 状态/类型：
  - `DropPreview.kind === 'row'` 时只允许 `intent: 'between'|'inside'`。
- 视觉层（最小改动优先）：
  - 新增 `.tree-node.drop-target-between`，并用 `data-drop-edge="top|bottom"`（或等价方式）控制画线位置。
  - 移除 `.drop-target-before/.drop-target-after` 的使用点，并删除对应 CSS（避免样式叠加回归）。

验收：
- 行上只表现 “between” 插入线 或 “inside” 高亮（两者互斥）。
- between/top 与 between/bottom 的 drop 结果分别等价于原 before/after。

### Phase 4：性能与 DOM 依赖降噪（0.5~1 天）
- 空白区 `getLastVisibleStageNode` 目前每次 dragOver 都 `querySelectorAll`，可以优化为：
  - 在 StageExplorer 渲染时维护“可见 stageId 列表”（基于 `ui.stageExpanded` 和 `stageTree` 递归得到），最后一个可见 id 直接从数据得出
  - 或者在 hook 内做 `requestAnimationFrame` 节流，避免每个 dragOver 都 setState / query

验收：
- 快速拖拽时帧率更稳；功能不变。

状态：已完成。
- StageExplorer 已数据驱动计算 `lastVisibleStageId` 并传给 hook（减少 DOM 依赖）：[components/Explorer/StageExplorer.tsx](components/Explorer/StageExplorer.tsx)
- 空白区 `dragover` 已使用 `requestAnimationFrame` 节流；drop 时会重新计算落点避免预览滞后：[hooks/useStageDrag.ts](hooks/useStageDrag.ts)

---

## 5. 验收清单（手动回归，按 UX_Flow 对齐）

1. Root 不可拖拽。
2. 行上拖拽（二态）：上/下区域触发 `between`（插入线，分别表示插入前/后），中间区域触发 `inside`。
3. inside drop 后目标自动展开。
4. 空白区拖拽：只显示离散档位层级线；上下移动能快速切换档位；越靠下越浅。
5. 空白区 drop：追加到选中父级末尾；同父情况下也能真正移动到末尾（REORDER）。
6. 循环引用保护：拖到非法父级/后代时，不出现“可 drop”的指示（或自动跳到最近合法档位，保持当前规则）。
7. Nodes 列表区域不影响 Stages 空白区指示线（容器限定仍生效）。

---

## 6. 风险与注意事项

- HTML5 DnD 在不同浏览器对 `dragover` 频率/事件顺序有差异：重构时要保证 `preventDefault()` 与 `stopPropagation()` 逻辑保持一致。
- 二态化（Phase 3）属于 UX 收敛：需要同步清理旧的 `.drop-target-before/.drop-target-after` 使用点，避免样式“叠加出两条线”的回归。
- 如果后续引入虚拟列表（大树性能），Phase 4 的“数据驱动最后可见节点”会比 DOM 查询更稳。

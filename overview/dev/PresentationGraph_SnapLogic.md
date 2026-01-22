# 演出图连线吸附逻辑分析

## 1. 核心机制概述

演出图编辑器（Presentation Graph Editor）的连线吸附逻辑主要由自定义 Hook `useGraphInteraction` 和几何工具库 `geometry.ts` 共同实现。

核心流程：
1. **拖拽开始**：计算所有节点的可吸附点（上下左右四个边的中点）并缓存。
2. **拖拽中**：实时计算鼠标位置与最近吸附点的距离，若小于阈值（30px）则激活吸附。
3. **结束**：根据是否有激活的吸附点决定建立连接。

## 2. 代码位置

- **交互逻辑**: `hooks/useGraphInteraction.ts`
- **几何计算**: `utils/geometry.ts`
- **渲染实现**: `components/Canvas/PresentationCanvas.tsx`

## 3. 详细逻辑分解

### 3.1 吸附点计算 (`updateSnapCache`)

在开始连线（`startLinking`）或修改连线（`startModifyingTransition`）时，系统会遍历当前画布上的所有节点，计算每个节点的四个锚 point：

```typescript
// hooks/useGraphInteraction.ts L86
const anchors = [
    { side: 'top', ...Geom.getNodeAnchor(pos, nodeWidth, nodeHeight, 'top') },
    { side: 'bottom', ...Geom.getNodeAnchor(pos, nodeWidth, nodeHeight, 'bottom') },
    { side: 'left', ...Geom.getNodeAnchor(pos, nodeWidth, nodeHeight, 'left') },
    { side: 'right', ...Geom.getNodeAnchor(pos, nodeWidth, nodeHeight, 'right') },
];
```

坐标计算依赖于 `Geom.getNodeAnchor`，基于节点的 `position` + `width/height` 计算边中心点。

### 3.2 距离检测与吸附激活

在 `useEffect` 的全局 `mousemove` 处理器中：

1. **距离计算**：遍历缓存的 `cachedSnapPoints`，计算鼠标位置与每个点的欧几里得距离。
2. **阈值判定**：`SNAP_THRESHOLD` 设为 **30px**。
3. **状态更新**：找到最近且小于阈值的点，更新 `activeSnapPoint` 状态。

```typescript
// hooks/useGraphInteraction.ts L153
let closest: SnapPoint | null = null;
let minDist = SNAP_THRESHOLD;

for (const point of cachedSnapPoints.current) {
    const dist = Math.hypot(point.x - pos.x, point.y - pos.y);
    if (dist < minDist) {
        minDist = dist;
        closest = point;
    }
}
setActiveSnapPoint(closest);
```

### 3.3 视觉反馈

在 `PresentationCanvas.tsx` 中，渲染临时连线时：

- 如果 `activeSnapPoint` 存在，连线终点直接吸附到该点的 `x, y`。
- 如果不存在，终点跟随鼠标 `mousePos`。

同时，连线的贝塞尔曲线方向（`toSide`）也会受到吸附点 `side` 属性的影响，确保曲线平滑进入目标边。

```typescript
// PresentationCanvas.tsx L786
const toSide = activeSnapPoint?.side || Geom.getNaturalEnteringSide(start, targetPos);
```

### 3.4 连线完成

鼠标松开（`mouseup`）时：

- 如果 `activeSnapPoint` 有值：直接调用 `onLinkComplete` 连接到对应的 `nodeId`。
- 如果无吸附点：尝试使用 `document.elementsFromPoint` 检测鼠标下的 DOM 元素是否包含 `data-node-id` 属性（作为备用判定）。

## 4. 总结

该逻辑确保了用户不需要精确点击节点边缘，只要靠近节点任一边的中心 30px 范围内即可自动吸附，大大提升了连线操作的容错率和流畅度。

/**
 * utils/stageDrag.ts
 * Stages 面板拖拽的“纯计算”工具函数。
 *
 * 设计目标（中文注释说明意图）：
 * - 让 useStageDrag 只负责事件编排与 dispatch
 * - 把可预测/可测试的计算逻辑集中到 utils（不依赖 DOM，不做 dispatch）
 */

import { StageId } from '../types/common';
import { StageTreeData } from '../types/stage';

/** 节点行放置意图（二态） */
export type RowDropIntent = 'between' | 'inside';

/** 节点行 between 的边缘（决定插入在目标前/后） */
export type RowDropEdge = 'top' | 'bottom';

/** 空白区指示线展示模式 */
export type DropIndicatorMode = 'indented' | 'full-width';

/**
 * 计算节点行拖拽预览（二态）。
 * - 上 25%：between/top
 * - 中间：inside
 * - 下 25%：between/bottom
 */
export function calculateRowDropPreview(
  y: number,
  height: number
): { intent: RowDropIntent; edge?: RowDropEdge } {
  if (y < height * 0.25) return { intent: 'between', edge: 'top' };
  if (y > height * 0.75) return { intent: 'between', edge: 'bottom' };
  return { intent: 'inside' };
}

/**
 * 计算 between(top/bottom) 的插入 index。
 *
 * 关键点：同一父节点排序时，需要考虑“先移除 dragged，再插入”的索引偏移。
 */
export function calculateBetweenInsertIndex(params: {
  edge: RowDropEdge;
  targetIndex: number;
  draggedIndex: number;
}): number {
  const { edge, targetIndex, draggedIndex } = params;

  let insertIndex = edge === 'top' ? targetIndex : targetIndex + 1;

  // 同父 reorder：如果 dragged 在 target 前面，移除后 targetIndex 会 -1。
  if (draggedIndex !== -1 && draggedIndex < targetIndex) {
    insertIndex = edge === 'top' ? targetIndex - 1 : targetIndex;
  }

  return insertIndex;
}

/**
 * 获取某个 Stage 到 Root 的路径（Root -> ... -> stageId）。
 * 只使用数据结构，不依赖 UI 展开状态。
 */
export function getStagePathFromRoot(stageTree: StageTreeData, stageId: StageId): StageId[] {
  const path: StageId[] = [];
  const visited = new Set<string>();
  let current: StageId | null = stageId;

  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    path.push(current);
    const node = stageTree.stages[current];
    current = (node?.parentId as StageId | null) ?? null;
  }

  path.reverse();
  return path;
}

/**
 * 空白区域候选父节点：Root -> ... -> parent(lastVisible)
 * 注意：不包含 lastVisible 自己这一层。
 */
export function getCandidateParentsForEmptyDrop(stageTree: StageTreeData, lastVisibleId: StageId): StageId[] {
  const path = getStagePathFromRoot(stageTree, lastVisibleId);
  const endExclusive = Math.max(1, path.length - 1);
  return path.slice(0, endExclusive);
}

/**
 * 空白区域离散档位：根据 relativeY + 容器高度，计算“偏好档位”。
 * 映射规则：越靠下越浅（level 越小）。
 */
export function calculatePreferredEmptyDropLevel(params: {
  candidateCount: number;
  relativeY: number;
  height: number;
}): number {
  const { candidateCount, relativeY, height } = params;

  const n = Math.max(1, candidateCount);
  const clampedY = Math.max(0, Math.min(height, relativeY));

  // 让轻微上下移动即可切换档位：bandHeight 约 8~12px，并用四舍五入吸附。
  const bandHeight = Math.max(8, Math.min(12, height / n));
  const rawIndex = Math.round(clampedY / bandHeight);
  const idx = Math.max(0, Math.min(candidateCount - 1, rawIndex));

  return (candidateCount - 1) - idx;
}

/**
 * 当偏好档位非法时，向上下寻找最近的合法档位。
 * 返回：合法 level 或 null（全部非法）。
 */
export function pickNearestValidLevel(params: {
  preferredLevel: number;
  candidateCount: number;
  isLevelValid: (level: number) => boolean;
}): number | null {
  const { preferredLevel, candidateCount, isLevelValid } = params;

  let level = preferredLevel;
  if (isLevelValid(level)) return level;

  for (let delta = 1; delta < candidateCount; delta += 1) {
    const up = preferredLevel - delta;
    const down = preferredLevel + delta;
    if (up >= 0 && isLevelValid(up)) return up;
    if (down < candidateCount && isLevelValid(down)) return down;
  }

  return null;
}

/**
 * 把空白区域档位 level 映射为指示线样式参数（left/mode）。
 * 与 StageExplorer 的缩进规则保持一致：paddingLeft = depth * 16 + 8。
 */
export function getEmptyIndicatorStyle(params: {
  level: number;
  indentStep: number;
  basePadding: number;
}): { mode: DropIndicatorMode; left: number } {
  const { level, indentStep, basePadding } = params;
  return {
    mode: level === 0 ? 'full-width' : 'indented',
    left: level === 0 ? 0 : basePadding + level * indentStep
  };
}

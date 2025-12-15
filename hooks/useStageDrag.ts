/**
 * hooks/useStageDrag.ts
 * Stage 树拖拽排序逻辑 Hook
 *
 * 关键交互（中文注释用于说明意图）：
 * - 拖到某个节点行（二态）：根据鼠标垂直位置决定 between/inside
 *   - between：插入到目标同级（通过 edge=top/bottom 表达插入在目标前/后）
 *   - inside：作为目标的子节点（默认追加到 childrenIds 末尾）
 * - 拖到“底部空白区域”：提供“离散档位”的层级选择（对应最后一个可见节点的祖先链）
 *   - 档位 0：Root（全宽指示线）
 *   - 档位 >0：祖先层级（缩进指示线）
 *   - 释放语义：追加到选中父节点 childrenIds 的末尾（不包含 lastVisible 自己这一层）
 */

import React, { useCallback, useRef, useState } from 'react';
import { Action } from '../store/types';
import { StageId } from '../types/common';
import { StageTreeData } from '../types/stage';
import { canMoveStage } from '../utils/stageTreeUtils';
import {
  calculateBetweenInsertIndex,
  calculatePreferredEmptyDropLevel,
  calculateRowDropPreview,
  getCandidateParentsForEmptyDrop,
  getEmptyIndicatorStyle,
  pickNearestValidLevel,
  type DropIndicatorMode,
  type RowDropEdge,
  type RowDropIntent
} from '../utils/stageDrag';

// ========== 类型定义 ==========

/** 节点行 Drop 预览 */
export interface RowDropPreview {
  kind: 'row';
  targetId: StageId;
  intent: RowDropIntent;
  /** intent=between 时必填 */
  edge?: RowDropEdge;
}

/** 空白区域 Drop 预览（离散档位） */
export interface EmptyAreaDropPreview {
  kind: 'empty';
  /** 目标父节点（在该父节点 childrenIds 末尾追加） */
  targetParentId: StageId;
  /** 指示线展示模式（root 使用 full-width，其余使用 indented） */
  mode: DropIndicatorMode;
  /** 指示线 left 偏移（px），用于表现层级缩进 */
  left: number;
}

/** Drop 预览（互斥） */
export type DropPreview = RowDropPreview | EmptyAreaDropPreview | null;

/** 拖拽状态 */
export interface DragState {
  /** 正在拖拽的 Stage ID */
  draggingId: StageId | null;
  /** 当前 drop 预览（节点行 or 空白区，互斥） */
  preview: DropPreview;
}

/** Hook 返回值 */
export interface UseStageDragResult {
  dragState: DragState;
  createNodeDragHandlers: (stageId: string) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  emptyAreaHandlers: {
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  isDragging: (stageId: string) => boolean;
  getDropClass: (stageId: string) => string;
  getDropEdge: (stageId: string) => RowDropEdge | null;
}

// ========== 常量 ==========

/** 与 StageExplorer 节点缩进保持一致：paddingLeft = depth * 16 + 8 */
const INDENT_STEP = 16;
const BASE_PADDING = 8;

const INITIAL_DRAG_STATE: DragState = {
  draggingId: null,
  preview: null
};

// ========== Hook 实现 ==========

export function useStageDrag(
  stageTree: StageTreeData,
  dispatch: React.Dispatch<Action>,
  containerRef?: React.RefObject<HTMLElement>,
  lastVisibleStageId?: StageId | null
): UseStageDragResult {
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);

  // 使用 ref 缓存 stageTree，避免闭包捕获旧值
  const stageTreeRef = useRef(stageTree);
  stageTreeRef.current = stageTree;

  // 空白区域 dragOver 高频触发：用 rAF 节流，减少 DOM 查询与 setState 压力。
  const emptyAreaRafIdRef = useRef<number | null>(null);
  const emptyAreaLatestRef = useRef<{ el: HTMLElement; clientY: number } | null>(null);

  const cancelEmptyAreaRaf = useCallback(() => {
    if (emptyAreaRafIdRef.current === null) return;
    if (typeof window === 'undefined') return;
    window.cancelAnimationFrame(emptyAreaRafIdRef.current);
    emptyAreaRafIdRef.current = null;
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, stageId: string) => {
    const stage = stageTreeRef.current.stages[stageId];
    if (!stage || !stage.parentId) {
      // 不允许拖拽根节点
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', stageId);
    e.dataTransfer.effectAllowed = 'move';
    setDragState(prev => ({ ...prev, draggingId: stageId as StageId }));
  }, []);

  const handleDragEnd = useCallback(() => {
    cancelEmptyAreaRaf();
    emptyAreaLatestRef.current = null;
    setDragState(INITIAL_DRAG_STATE);
  }, [cancelEmptyAreaRaf]);

  const handleRowDragOver = useCallback((e: React.DragEvent, targetId: StageId) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rowPreview = calculateRowDropPreview(y, rect.height);

    setDragState(prev => {
      if (!prev.draggingId || prev.draggingId === targetId) return prev;

      const targetStage = stageTreeRef.current.stages[targetId];
      if (!targetStage) return prev;

      const nextPreview: RowDropPreview =
        rowPreview.intent === 'inside'
          ? { kind: 'row', targetId, intent: 'inside' }
          : { kind: 'row', targetId, intent: 'between', edge: rowPreview.edge };

      // 合法性校验：
      // - inside：检测 move 到 targetId 是否会造成循环
      // - between：检测 move 到 target.parentId 是否会造成循环（且 parentId 必须存在）
      if (nextPreview.intent === 'inside') {
        if (!canMoveStage(stageTreeRef.current, prev.draggingId, targetId)) return prev;
      } else {
        if (!targetStage.parentId) return prev;
        const parentId = targetStage.parentId as StageId;
        if (!canMoveStage(stageTreeRef.current, prev.draggingId, parentId)) return prev;
      }

      if (
        prev.preview?.kind === 'row' &&
        prev.preview.targetId === nextPreview.targetId &&
        prev.preview.intent === nextPreview.intent &&
        prev.preview.edge === nextPreview.edge
      ) {
        return prev;
      }

      return { ...prev, preview: nextPreview };
    });
  }, []);

  const handleRowDragLeave = useCallback((targetId: StageId) => {
    setDragState(prev => {
      if (prev.preview?.kind !== 'row') return prev;
      if (prev.preview.targetId !== targetId) return prev;
      return { ...prev, preview: null };
    });
  }, []);

  const handleRowDrop = useCallback(
    (e: React.DragEvent, targetId: StageId) => {
      e.preventDefault();
      e.stopPropagation();

      const draggedId = e.dataTransfer.getData('text/plain') as StageId;
      if (!draggedId) {
        handleDragEnd();
        return;
      }
      if (draggedId === targetId) {
        handleDragEnd();
        return;
      }

      const targetStage = stageTreeRef.current.stages[targetId];
      const draggedStage = stageTreeRef.current.stages[draggedId];
      if (!targetStage || !draggedStage) {
        handleDragEnd();
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const rowPreview = calculateRowDropPreview(y, rect.height);

      if (rowPreview.intent === 'inside') {
        const targetParentId = targetId;
        const targetParent = stageTreeRef.current.stages[targetParentId];
        if (!targetParent) {
          handleDragEnd();
          return;
        }
        if (!canMoveStage(stageTreeRef.current, draggedId, targetParentId)) {
          handleDragEnd();
          return;
        }

        const insertIndex = targetParent.childrenIds.length;
        if (draggedStage.parentId === targetParentId) {
          dispatch({ type: 'REORDER_STAGE', payload: { stageId: draggedId, newIndex: insertIndex } });
        } else {
          dispatch({
            type: 'MOVE_STAGE',
            payload: { stageId: draggedId, newParentId: targetParentId, insertIndex }
          });
        }

        // inside：为避免拖入折叠父级后“看不见”，自动展开目标父节点。
        dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id: targetParentId, expanded: true } });

        handleDragEnd();
        return;
      }

      // between：插入到 target 同级（目标父级 = target.parentId）
      const edge = rowPreview.edge ?? 'bottom';
      if (!targetStage.parentId) {
        handleDragEnd();
        return;
      }

      const targetParentId = targetStage.parentId as StageId;
      const parentStage = stageTreeRef.current.stages[targetParentId];
      if (!parentStage) {
        handleDragEnd();
        return;
      }

      if (!canMoveStage(stageTreeRef.current, draggedId, targetParentId)) {
        handleDragEnd();
        return;
      }

      const siblings = parentStage.childrenIds as StageId[];
      const targetIndex = siblings.indexOf(targetId);
      const draggedIndex = siblings.indexOf(draggedId);
      if (targetIndex < 0) {
        handleDragEnd();
        return;
      }

      let insertIndex = calculateBetweenInsertIndex({ edge, targetIndex, draggedIndex });
      insertIndex = Math.max(0, Math.min(siblings.length, insertIndex));

      if (draggedStage.parentId === targetParentId) {
        dispatch({ type: 'REORDER_STAGE', payload: { stageId: draggedId, newIndex: insertIndex } });
      } else {
        dispatch({
          type: 'MOVE_STAGE',
          payload: { stageId: draggedId, newParentId: targetParentId, insertIndex }
        });
      }

      handleDragEnd();
    },
    [dispatch, handleDragEnd]
  );

  // ========== 空白区域处理（离散档位） ==========

  const getLastVisibleStageIdFromDom = useCallback((): StageId | null => {
    const queryRoot: ParentNode = containerRef?.current ?? document;
    const stageNodes = queryRoot.querySelectorAll<HTMLElement>('.tree-node[data-stage-id]');
    if (stageNodes.length === 0) return null;
    const lastNode = stageNodes[stageNodes.length - 1];
    return (lastNode.getAttribute('data-stage-id') as StageId | null) ?? null;
  }, [containerRef]);

  /**
   * 计算空白区域的离散档位预览。
   * 说明：尽量使用数据驱动的 lastVisibleStageId（来自 StageExplorer），DOM 仅作为回退。
   */
  const computeEmptyAreaPreview = useCallback(
    (params: { emptyAreaEl: HTMLElement; clientY: number; draggingId: StageId }): EmptyAreaDropPreview | null => {
      const { emptyAreaEl, clientY, draggingId } = params;

      const lastId = lastVisibleStageId ?? getLastVisibleStageIdFromDom();
      if (!lastId) return null;

      const emptyAreaBox = emptyAreaEl.getBoundingClientRect();
      const relativeY = clientY - emptyAreaBox.top;

      const candidateParents = getCandidateParentsForEmptyDrop(stageTreeRef.current, lastId);
      const preferredLevel = calculatePreferredEmptyDropLevel({
        candidateCount: candidateParents.length,
        relativeY,
        height: emptyAreaBox.height
      });

      const resolvedLevel = pickNearestValidLevel({
        preferredLevel,
        candidateCount: candidateParents.length,
        isLevelValid: (level: number) => canMoveStage(stageTreeRef.current, draggingId, candidateParents[level])
      });

      if (resolvedLevel === null) return null;

      const targetParentId = candidateParents[resolvedLevel];
      const style = getEmptyIndicatorStyle({ level: resolvedLevel, indentStep: INDENT_STEP, basePadding: BASE_PADDING });

      return { kind: 'empty', targetParentId, mode: style.mode, left: style.left };
    },
    [getLastVisibleStageIdFromDom, lastVisibleStageId]
  );

  const handleEmptyAreaDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      emptyAreaLatestRef.current = { el: e.currentTarget as HTMLElement, clientY: e.clientY };
      if (emptyAreaRafIdRef.current !== null) return;
      if (typeof window === 'undefined') return;

      emptyAreaRafIdRef.current = window.requestAnimationFrame(() => {
        emptyAreaRafIdRef.current = null;
        setDragState(prev => {
          if (!prev.draggingId) return prev;
          const latest = emptyAreaLatestRef.current;
          if (!latest) return prev;

          const indicator = computeEmptyAreaPreview({
            emptyAreaEl: latest.el,
            clientY: latest.clientY,
            draggingId: prev.draggingId
          });

          if (indicator === null) {
            if (prev.preview === null) return prev;
            return { ...prev, preview: null };
          }

          if (
            prev.preview?.kind === 'empty' &&
            prev.preview.targetParentId === indicator.targetParentId &&
            prev.preview.mode === indicator.mode &&
            prev.preview.left === indicator.left
          ) {
            return prev;
          }

          return { ...prev, preview: indicator };
        });
      });
    },
    [computeEmptyAreaPreview]
  );

  const handleEmptyAreaDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain') as StageId;
      if (!draggedId) {
        handleDragEnd();
        return;
      }

      // drop 时直接根据事件计算目标父级，避免 rAF 节流导致 preview 未及时刷新。
      const indicator = computeEmptyAreaPreview({
        emptyAreaEl: e.currentTarget as HTMLElement,
        clientY: e.clientY,
        draggingId: draggedId
      });
      if (!indicator) {
        handleDragEnd();
        return;
      }

      const draggedStage = stageTreeRef.current.stages[draggedId];
      const targetParent = stageTreeRef.current.stages[indicator.targetParentId];
      if (!draggedStage || !targetParent) {
        handleDragEnd();
        return;
      }

      if (!canMoveStage(stageTreeRef.current, draggedId, indicator.targetParentId)) {
        handleDragEnd();
        return;
      }

      const insertIndex = targetParent.childrenIds.length;

      // 语义：追加到目标父节点末尾。
      // 如果已经在同一父节点下，MOVE_STAGE 可能会被 reducer 视为 no-op，因此使用 REORDER_STAGE。
      if (draggedStage.parentId === indicator.targetParentId) {
        dispatch({ type: 'REORDER_STAGE', payload: { stageId: draggedId, newIndex: insertIndex } });
      } else {
        dispatch({
          type: 'MOVE_STAGE',
          payload: { stageId: draggedId, newParentId: indicator.targetParentId, insertIndex }
        });
      }

      handleDragEnd();
    },
    [computeEmptyAreaPreview, dispatch, handleDragEnd]
  );

  // ========== 便捷方法（供组件使用） ==========

  const createNodeDragHandlers = useCallback(
    (stageId: string) => {
      const stage = stageTree.stages[stageId];
      return {
        draggable: !!stage?.parentId,
        onDragStart: (e: React.DragEvent) => handleDragStart(e, stageId),
        onDragEnd: handleDragEnd,
        onDragOver: (e: React.DragEvent) => handleRowDragOver(e, stageId as StageId),
        onDragLeave: () => handleRowDragLeave(stageId as StageId),
        onDrop: (e: React.DragEvent) => handleRowDrop(e, stageId as StageId)
      };
    },
    [handleDragEnd, handleDragStart, handleRowDragLeave, handleRowDragOver, handleRowDrop, stageTree.stages]
  );

  const isDragging = useCallback((stageId: string) => dragState.draggingId === stageId, [dragState.draggingId]);

  const getDropClass = useCallback(
    (stageId: string) => {
      if (dragState.preview?.kind !== 'row' || dragState.preview.targetId !== stageId) return '';
      if (dragState.preview.intent === 'inside') return 'drop-target-inside';
      return 'drop-target-between';
    },
    [dragState.preview]
  );

  const getDropEdge = useCallback(
    (stageId: string) => {
      if (dragState.preview?.kind !== 'row' || dragState.preview.targetId !== stageId) return null;
      if (dragState.preview.intent !== 'between') return null;
      return dragState.preview.edge ?? null;
    },
    [dragState.preview]
  );

  return {
    dragState,
    createNodeDragHandlers,
    emptyAreaHandlers: {
      onDragOver: handleEmptyAreaDragOver,
      onDrop: handleEmptyAreaDrop
    },
    isDragging,
    getDropClass,
    getDropEdge
  };
}

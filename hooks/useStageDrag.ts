/**
 * hooks/useStageDrag.ts
 * Stage 树拖拽排序逻辑 Hook
 * 
 * 功能：
 * - 管理拖拽状态 (draggingId, dropTargetId, dropPosition)
 * - 计算放置位置 (before/inside/after)
 * - 处理循环引用检测
 * - 支持空白区域的 Sticky Bottom 逻辑
 */

import React, { useState, useCallback, useRef } from 'react';
import { StageId } from '../types/common';
import { StageTreeData } from '../types/stage';
import { canMoveStage } from '../utils/stageTreeUtils';
import { Action } from '../store/types';

// ========== 类型定义 ==========

/** 放置位置类型 */
export type DropPosition = 'before' | 'after' | 'inside' | null;

/** 空白区域放置指示器类型 */
export type DropIndicatorType = 'indented' | 'full-width' | null;

/** 拖拽状态 */
export interface DragState {
    /** 正在拖拽的 Stage ID */
    draggingId: string | null;
    /** 放置目标 Stage ID（'EMPTY_AREA' 表示空白区域） */
    dropTargetId: string | null;
    /** 放置位置 */
    dropPosition: DropPosition;
    /** 空白区域指示器类型 */
    dropIndicatorType: DropIndicatorType;
}

/** Hook 返回值 */
export interface UseStageDragResult {
    /** 当前拖拽状态 */
    dragState: DragState;
    /** 创建节点的拖拽事件处理器 */
    createNodeDragHandlers: (stageId: string) => {
        draggable: boolean;
        onDragStart: (e: React.DragEvent) => void;
        onDragEnd: () => void;
        onDragOver: (e: React.DragEvent) => void;
        onDragLeave: () => void;
        onDrop: (e: React.DragEvent) => void;
    };
    /** 空白区域拖拽事件处理器 */
    emptyAreaHandlers: {
        onDragOver: (e: React.DragEvent) => void;
        onDrop: (e: React.DragEvent) => void;
    };
    /** 判断节点是否正在被拖拽 */
    isDragging: (stageId: string) => boolean;
    /** 获取节点的 drop 状态 class */
    getDropClass: (stageId: string) => string;
}

// ========== 常量 ==========

/** Sticky Bottom 阈值（距离最后节点底部的像素数） */
const STICKY_THRESHOLD = 30;

/** 初始拖拽状态 */
const INITIAL_DRAG_STATE: DragState = {
    draggingId: null,
    dropTargetId: null,
    dropPosition: null,
    dropIndicatorType: null
};

// ========== 工具函数 ==========

/**
 * 根据鼠标 Y 位置计算放置位置
 * @param y 鼠标相对于目标元素的 Y 坐标
 * @param height 目标元素高度
 * @returns 放置位置
 */
function calculateDropPosition(y: number, height: number): DropPosition {
    if (y < height * 0.25) {
        return 'before';
    } else if (y > height * 0.75) {
        return 'after';
    }
    return 'inside';
}

/**
 * 获取最后一个可见树节点的信息
 * @returns 最后一个节点的 ID 和底部位置
 */
function getLastVisibleNode(): { stageId: string | null; bottom: number } {
    const treeNodes = document.querySelectorAll('.tree-node');
    if (treeNodes.length === 0) {
        return { stageId: null, bottom: 0 };
    }
    const lastNode = treeNodes[treeNodes.length - 1] as HTMLElement;
    const rect = lastNode.getBoundingClientRect();
    return {
        stageId: lastNode.getAttribute('data-stage-id'),
        bottom: rect.bottom
    };
}

// ========== Hook 实现 ==========

/**
 * Stage 拖拽排序 Hook
 * @param stageTree Stage 树数据
 * @param dispatch Redux dispatch 函数
 */
export function useStageDrag(
    stageTree: StageTreeData,
    dispatch: React.Dispatch<Action>
): UseStageDragResult {
    // 拖拽状态（使用函数式更新避免 stale closure）
    const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);

    // 使用 ref 缓存 stageTree，避免闭包捕获旧值
    const stageTreeRef = useRef(stageTree);
    stageTreeRef.current = stageTree;

    // ========== 核心处理函数 ==========

    /** 开始拖拽 */
    const handleDragStart = useCallback((e: React.DragEvent, stageId: string) => {
        const stage = stageTreeRef.current.stages[stageId];
        if (!stage || !stage.parentId) {
            // 不允许拖拽根节点
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', stageId);
        e.dataTransfer.effectAllowed = 'move';
        setDragState(prev => ({ ...prev, draggingId: stageId }));
    }, []);

    /** 结束拖拽 */
    const handleDragEnd = useCallback(() => {
        setDragState(INITIAL_DRAG_STATE);
    }, []);

    /** 拖拽经过节点 */
    const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        e.stopPropagation();

        // 在 setDragState 回调外部提取事件数据，避免 React 合成事件被回收
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseY = e.clientY;
        const y = mouseY - rect.top;
        const position = calculateDropPosition(y, rect.height);

        setDragState(prev => {
            // 不能放置到自身
            if (!prev.draggingId || prev.draggingId === stageId) {
                return prev;
            }

            // 检查是否可以移动到该位置（防止循环引用）
            if (!canMoveStage(stageTreeRef.current, prev.draggingId as StageId, stageId as StageId)) {
                return prev;
            }

            // 只在状态改变时更新
            if (prev.dropTargetId === stageId && prev.dropPosition === position) {
                return prev;
            }

            return {
                ...prev,
                dropTargetId: stageId,
                dropPosition: position,
                dropIndicatorType: null
            };
        });
    }, []);

    /** 拖拽离开节点 */
    const handleDragLeave = useCallback(() => {
        setDragState(prev => ({
            ...prev,
            dropTargetId: null,
            dropPosition: null,
            dropIndicatorType: null
        }));
    }, []);

    /** 放置到节点上 */
    const handleDrop = useCallback((e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');

        if (!draggedId || draggedId === stageId) {
            handleDragEnd();
            return;
        }

        setDragState(prev => {
            const { dropPosition } = prev;
            const targetStage = stageTreeRef.current.stages[stageId];
            const draggedStage = stageTreeRef.current.stages[draggedId];

            if (!targetStage || !draggedStage || !dropPosition) {
                return INITIAL_DRAG_STATE;
            }

            if (dropPosition === 'inside') {
                // 移动到目标 Stage 内部（作为子节点）
                if (canMoveStage(stageTreeRef.current, draggedId as StageId, stageId as StageId)) {
                    dispatch({
                        type: 'MOVE_STAGE',
                        payload: { stageId: draggedId as StageId, newParentId: stageId as StageId }
                    });
                    // 展开目标节点
                    dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id: stageId, expanded: true } });
                }
            } else if (dropPosition === 'before' || dropPosition === 'after') {
                // 移动到同级位置
                if (targetStage.parentId) {
                    const parentId = targetStage.parentId as StageId;
                    const parent = stageTreeRef.current.stages[parentId];

                    if (parent) {
                        const targetIndex = parent.childrenIds.indexOf(stageId);
                        let insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;

                        if (draggedStage.parentId === parentId) {
                            // 同一父节点下重新排序
                            const currentIndex = parent.childrenIds.indexOf(draggedId);
                            // 如果拖拽项在目标之前，需要调整索引
                            if (currentIndex < targetIndex) {
                                insertIndex = dropPosition === 'before' ? targetIndex - 1 : targetIndex;
                            }
                            dispatch({
                                type: 'REORDER_STAGE',
                                payload: { stageId: draggedId as StageId, newIndex: insertIndex }
                            });
                        } else {
                            // 跨父节点移动
                            dispatch({
                                type: 'MOVE_STAGE',
                                payload: { stageId: draggedId as StageId, newParentId: parentId, insertIndex }
                            });
                        }
                    }
                }
            }

            return INITIAL_DRAG_STATE;
        });
    }, [dispatch, handleDragEnd]);

    // ========== 空白区域处理 ==========

    /** 拖拽经过空白区域 */
    const handleEmptyAreaDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();

        // 在 setDragState 回调外部提取事件数据
        const mouseY = e.clientY;
        const { stageId: lastStageId, bottom } = getLastVisibleNode();

        setDragState(prev => {
            if (!prev.draggingId) return prev;
            if (!lastStageId) return prev;

            // 计算鼠标距离最后节点底部的距离
            const distance = mouseY - bottom;

            // 根据距离判断指示器类型
            const indicatorType: DropIndicatorType =
                distance >= 0 && distance <= STICKY_THRESHOLD ? 'indented' : 'full-width';

            // 只在状态改变时更新
            if (prev.dropTargetId === 'EMPTY_AREA' && prev.dropIndicatorType === indicatorType) {
                return prev;
            }

            return {
                ...prev,
                dropTargetId: 'EMPTY_AREA',
                dropPosition: null,
                dropIndicatorType: indicatorType
            };
        });
    }, []);

    /** 放置到空白区域 */
    const handleEmptyAreaDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');

        setDragState(prev => {
            if (!draggedId || !prev.dropIndicatorType) {
                return INITIAL_DRAG_STATE;
            }

            const draggedStage = stageTreeRef.current.stages[draggedId];
            if (!draggedStage) {
                return INITIAL_DRAG_STATE;
            }

            const { stageId: lastStageId } = getLastVisibleNode();
            if (!lastStageId) {
                return INITIAL_DRAG_STATE;
            }

            const lastStage = stageTreeRef.current.stages[lastStageId];
            const rootId = stageTreeRef.current.rootId;

            if (prev.dropIndicatorType === 'full-width') {
                // 添加到根节点末尾
                if (rootId && canMoveStage(stageTreeRef.current, draggedId as StageId, rootId as StageId)) {
                    const root = stageTreeRef.current.stages[rootId];
                    dispatch({
                        type: 'MOVE_STAGE',
                        payload: {
                            stageId: draggedId as StageId,
                            newParentId: rootId as StageId,
                            insertIndex: root.childrenIds.length
                        }
                    });
                }
            } else if (prev.dropIndicatorType === 'indented') {
                // 添加为最后节点的同级
                if (lastStage?.parentId) {
                    const parentId = lastStage.parentId as StageId;
                    if (canMoveStage(stageTreeRef.current, draggedId as StageId, parentId)) {
                        const parent = stageTreeRef.current.stages[parentId];
                        dispatch({
                            type: 'MOVE_STAGE',
                            payload: {
                                stageId: draggedId as StageId,
                                newParentId: parentId,
                                insertIndex: parent.childrenIds.length
                            }
                        });
                    }
                }
            }

            return INITIAL_DRAG_STATE;
        });
    }, [dispatch]);

    // ========== 便捷方法 ==========

    /** 创建节点的拖拽事件处理器 */
    const createNodeDragHandlers = useCallback((stageId: string) => {
        const stage = stageTree.stages[stageId];
        return {
            draggable: !!stage?.parentId,
            onDragStart: (e: React.DragEvent) => handleDragStart(e, stageId),
            onDragEnd: handleDragEnd,
            onDragOver: (e: React.DragEvent) => handleDragOver(e, stageId),
            onDragLeave: handleDragLeave,
            onDrop: (e: React.DragEvent) => handleDrop(e, stageId)
        };
    }, [stageTree.stages, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop]);

    /** 判断节点是否正在被拖拽 */
    const isDragging = useCallback((stageId: string) => {
        return dragState.draggingId === stageId;
    }, [dragState.draggingId]);

    /** 获取节点的 drop 状态 class */
    const getDropClass = useCallback((stageId: string) => {
        if (dragState.dropTargetId !== stageId || !dragState.dropPosition) {
            return '';
        }
        return `drop-target-${dragState.dropPosition}`;
    }, [dragState.dropTargetId, dragState.dropPosition]);

    return {
        dragState,
        createNodeDragHandlers,
        emptyAreaHandlers: {
            onDragOver: handleEmptyAreaDragOver,
            onDrop: handleEmptyAreaDrop
        },
        isDragging,
        getDropClass
    };
}

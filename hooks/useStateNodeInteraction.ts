/**
 * useStateNodeInteraction.ts - 状态节点交互逻辑 Hook
 * 处理状态节点的点击、拖拽、选中等交互
 */

import React, { useRef, useEffect, useCallback } from 'react';

/** 拖拽阈值：鼠标移动超过该像素视为拖拽 */
const DRAG_THRESHOLD = 4;

/** Hook 参数 */
interface UseStateNodeInteractionOptions {
    /** 当前连线状态 */
    linkingState: any;
    /** 当前修改连线状态 */
    modifyingTransition: any;
    /** 多选状态 ID 列表 */
    multiSelectIds: string[];
    /** 只读模式 */
    readOnly?: boolean;
    /** 开始节点拖拽 */
    startNodeDrag: (e: React.MouseEvent, nodeId: string, position: { x: number; y: number }) => void;
    /** 开始多节点拖拽 */
    startMultiNodeDrag: (e: React.MouseEvent, nodeIds: string[]) => void;
    /** 开始连线 */
    startLinking: (e: React.MouseEvent, nodeId: string) => void;
    /** 获取节点位置 */
    getNodePosition: (nodeId: string) => { x: number; y: number };
    /** 选中对象 */
    onSelectObject: (type: string, id: string, contextId: string) => void;
    /** 清空多选 */
    onClearMultiSelect: () => void;
}

/** Hook 返回值 */
interface UseStateNodeInteractionReturn {
    /** 处理状态节点鼠标按下 */
    handleStateMouseDown: (e: React.MouseEvent, stateId: string) => void;
    /** 处理状态节点鼠标抬起 */
    handleStateMouseUp: (e: React.MouseEvent, stateId: string) => void;
}

/**
 * 状态节点交互逻辑 Hook
 * 职责：
 * 1. 区分点击和拖拽（通过移动阈值）
 * 2. 处理多选节点的批量拖拽
 * 3. Shift+点击触发连线
 * 4. 延迟选中直到 mouseup（防止拖拽时误选）
 */
export function useStateNodeInteraction({
    linkingState,
    modifyingTransition,
    multiSelectIds,
    readOnly = false,
    startNodeDrag,
    startMultiNodeDrag,
    startLinking,
    getNodePosition,
    onSelectObject,
    onClearMultiSelect
}: UseStateNodeInteractionOptions): UseStateNodeInteractionReturn {
    // 延迟选中：在 mouseup 时触发
    const pendingStateSelect = useRef<string | null>(null);
    // 拖拽起点位置
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    // 是否已移动（超过阈值）
    const dragMoved = useRef(false);
    // 当前 PuzzleNode ID（用于 contextId）
    const nodeIdRef = useRef<string>('');

    /**
     * 处理状态节点鼠标按下
     */
    const handleStateMouseDown = useCallback((e: React.MouseEvent, stateId: string) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        const isLinkInteraction = !readOnly && (e.shiftKey || Boolean(linkingState) || Boolean(modifyingTransition));

        // 重置状态
        pendingStateSelect.current = null;
        dragMoved.current = false;
        dragStartPos.current = { x: e.clientX, y: e.clientY };

        // 多选节点的批量拖拽
        if (multiSelectIds.includes(stateId) && !isLinkInteraction && !readOnly) {
            startMultiNodeDrag(e, multiSelectIds);
            return;
        }

        // 清除多选（除非按住 Ctrl/Meta）
        if (multiSelectIds.length > 0 && !e.ctrlKey && !e.metaKey) {
            onClearMultiSelect();
        }

        // Shift+点击开始连线
        if (e.shiftKey && !readOnly) {
            startLinking(e, stateId);
            return;
        }

        // 正常拖拽或选中
        if (!linkingState && !modifyingTransition && !readOnly) {
            startNodeDrag(e, stateId, getNodePosition(stateId));
            pendingStateSelect.current = stateId;
        } else if (readOnly) {
            pendingStateSelect.current = stateId;
        }

        // 非连线/拖拽时记录待选中
        if (!isLinkInteraction && !pendingStateSelect.current) {
            pendingStateSelect.current = stateId;
        }
    }, [readOnly, linkingState, modifyingTransition, multiSelectIds, startMultiNodeDrag, startLinking, startNodeDrag, getNodePosition, onClearMultiSelect]);

    /**
     * 处理状态节点鼠标抬起
     */
    const handleStateMouseUp = useCallback((e: React.MouseEvent, stateId: string) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        // 只有未拖拽时才触发选中
        if (pendingStateSelect.current === stateId && !linkingState && !modifyingTransition && !dragMoved.current) {
            onSelectObject('STATE', stateId, nodeIdRef.current);
        }

        // 重置状态
        pendingStateSelect.current = null;
        dragStartPos.current = null;
        dragMoved.current = false;
    }, [linkingState, modifyingTransition, onSelectObject]);

    /**
     * 监听全局鼠标移动判断是否进入拖拽状态
     */
    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!pendingStateSelect.current || !dragStartPos.current) return;
            const dx = Math.abs(e.clientX - dragStartPos.current.x);
            const dy = Math.abs(e.clientY - dragStartPos.current.y);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                dragMoved.current = true;
            }
        };

        const handleUp = () => {
            dragStartPos.current = null;
        };

        window.addEventListener('mousemove', handleMove, { capture: true });
        window.addEventListener('mouseup', handleUp, { capture: true });
        return () => {
            window.removeEventListener('mousemove', handleMove, { capture: true });
            window.removeEventListener('mouseup', handleUp, { capture: true });
        };
    }, []);

    return {
        handleStateMouseDown,
        handleStateMouseUp
    };
}

/**
 * 设置当前 PuzzleNode ID（供 contextId 使用）
 * 需要在组件外部调用此函数更新
 */
export function setNodeIdRef(nodeId: string): void {
    // 这是一个简化实现，实际使用时需要通过 ref 传递
}

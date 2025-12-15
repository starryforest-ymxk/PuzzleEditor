/**
 * useGraphKeyboardShortcuts.ts - 通用图编辑器键盘快捷键 Hook
 * 
 * 从 useKeyboardShortcuts.ts 泛化而来，支持 FSM 和演出图画布
 * 处理键盘事件：删除、取消选择、模式切换等
 */

import { useEffect, useCallback } from 'react';

/** 选中对象类型 */
export type GraphSelectionType = 'STATE' | 'TRANSITION' | 'PRESENTATION_NODE' | 'PRESENTATION_GRAPH' | 'NODE' | string;

/** Hook 参数 */
interface UseGraphKeyboardShortcutsOptions {
    /** 上下文 ID（用于判断选中对象是否属于当前画布） */
    contextId: string;
    /** 支持的节点选中类型（如 'STATE' 或 'PRESENTATION_NODE'） */
    nodeSelectionType: GraphSelectionType;
    /** 支持的边选中类型（如 'TRANSITION'，演出图无独立边选中则传 null） */
    edgeSelectionType?: GraphSelectionType | null;
    /** 多选节点 ID 列表 */
    multiSelectIds: string[];
    /** 当前选中对象 */
    selection: {
        type: string;
        id: string | null;
        contextId?: string;
    };
    /** 只读模式 */
    readOnly?: boolean;
    /** 删除节点回调 */
    onDeleteNode: (nodeId: string) => void;
    /** 删除边回调（可选，演出图可能不需要） */
    onDeleteEdge?: (edgeId: string) => void;
    /** 清空多选 */
    onClearMultiSelect: () => void;
    /** 设置剪线模式提示 */
    onSetLineCuttingMode?: (value: boolean) => void;
    /** 设置连线模式提示 */
    onSetLinkKeyActive?: (value: boolean) => void;
}

/**
 * 通用图编辑器键盘快捷键 Hook
 * 职责：
 * 1. Delete/Backspace - 删除选中的节点/边
 * 2. Escape - 取消多选
 * 3. Ctrl - 显示剪线模式提示
 * 4. Shift - 显示连线模式提示
 */
export function useGraphKeyboardShortcuts({
    contextId,
    nodeSelectionType,
    edgeSelectionType,
    multiSelectIds,
    selection,
    readOnly = false,
    onDeleteNode,
    onDeleteEdge,
    onClearMultiSelect,
    onSetLineCuttingMode,
    onSetLinkKeyActive
}: UseGraphKeyboardShortcutsOptions): void {
    // 处理删除和取消选择
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        // 忽略输入框内的按键
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (readOnly) return;

            // 优先处理多选删除
            if (multiSelectIds.length > 0) {
                multiSelectIds.forEach(nodeId => {
                    onDeleteNode(nodeId);
                });
                onClearMultiSelect();
                return;
            }

            // 单选删除 - 检查上下文匹配
            if (selection.contextId === contextId && selection.id) {
                if (selection.type === nodeSelectionType) {
                    onDeleteNode(selection.id);
                } else if (edgeSelectionType && selection.type === edgeSelectionType && onDeleteEdge) {
                    onDeleteEdge(selection.id);
                }
            }
        }

        if (e.key === 'Escape') {
            onClearMultiSelect();
        }
    }, [multiSelectIds, selection, contextId, nodeSelectionType, edgeSelectionType, readOnly, onDeleteNode, onDeleteEdge, onClearMultiSelect]);

    // 处理模式提示按键
    const handleModifierKeyDown = useCallback((e: KeyboardEvent) => {
        if (readOnly) return;
        if (e.key === 'Control' && onSetLineCuttingMode) onSetLineCuttingMode(true);
        if (e.key === 'Shift' && onSetLinkKeyActive) onSetLinkKeyActive(true);
    }, [readOnly, onSetLineCuttingMode, onSetLinkKeyActive]);

    const handleModifierKeyUp = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Control' && onSetLineCuttingMode) onSetLineCuttingMode(false);
        if (e.key === 'Shift' && onSetLinkKeyActive) onSetLinkKeyActive(false);
    }, [onSetLineCuttingMode, onSetLinkKeyActive]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keydown', handleModifierKeyDown);
        window.addEventListener('keyup', handleModifierKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keydown', handleModifierKeyDown);
            window.removeEventListener('keyup', handleModifierKeyUp);
        };
    }, [handleKeyDown, handleModifierKeyDown, handleModifierKeyUp]);
}

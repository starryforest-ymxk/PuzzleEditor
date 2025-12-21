/**
 * useKeyboardShortcuts.ts - 画布键盘快捷键 Hook
 * 处理 FSM 画布的键盘事件：删除、取消选择、模式切换等
 */

import { useEffect, useCallback } from 'react';

/** Hook 参数 */
interface UseKeyboardShortcutsOptions {
    /** FSM ID */
    fsmId: string;
    /** 当前 PuzzleNode ID */
    nodeId: string;
    /** 多选状态 ID 列表 */
    multiSelectIds: string[];
    /** 当前选中对象 */
    selection: {
        type: string;
        id: string | null;
        contextId?: string;
    };
    /** 只读模式 */
    readOnly?: boolean;
    /** 删除状态节点 */
    onDeleteState: (stateId: string) => void;
    /** 删除连线 */
    onDeleteTransition: (transitionId: string) => void;
    /** 清空多选 */
    onClearMultiSelect: () => void;
    /** 设置剪线模式提示 */
    onSetLineCuttingMode: (value: boolean) => void;
    /** 设置连线模式提示 */
    onSetLinkKeyActive: (value: boolean) => void;
}

/**
 * 画布键盘快捷键 Hook
 * 职责：
 * 1. Delete/Backspace - 删除选中的状态/连线
 * 2. Escape - 取消多选
 * 3. Ctrl - 显示剪线模式提示
 * 4. Shift - 显示连线模式提示
 */
export function useKeyboardShortcuts({
    fsmId,
    nodeId,
    multiSelectIds,
    selection,
    readOnly = false,
    onDeleteState,
    onDeleteTransition,
    onClearMultiSelect,
    onSetLineCuttingMode,
    onSetLinkKeyActive
}: UseKeyboardShortcutsOptions): void {
    // 处理删除和取消选择
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInputElement = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

        // 忽略输入框内的其他按键
        if (isInputElement) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (readOnly) return;

            // 优先处理多选删除
            if (multiSelectIds.length > 0) {
                multiSelectIds.forEach(stateId => {
                    onDeleteState(stateId);
                });
                onClearMultiSelect();
                return;
            }

            // 单选删除
            if (selection.type === 'STATE' && selection.contextId === nodeId && selection.id) {
                onDeleteState(selection.id);
            } else if (selection.type === 'TRANSITION' && selection.contextId === nodeId && selection.id) {
                onDeleteTransition(selection.id);
            }
        }

        if (e.key === 'Escape') {
            onClearMultiSelect();
        }
    }, [multiSelectIds, selection, nodeId, readOnly, onDeleteState, onDeleteTransition, onClearMultiSelect]);

    // 处理模式提示按键
    const handleModifierKeyDown = useCallback((e: KeyboardEvent) => {
        if (readOnly) return;
        if (e.key === 'Control') onSetLineCuttingMode(true);
        if (e.key === 'Shift') onSetLinkKeyActive(true);
    }, [readOnly, onSetLineCuttingMode, onSetLinkKeyActive]);

    const handleModifierKeyUp = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Control') onSetLineCuttingMode(false);
        if (e.key === 'Shift') onSetLinkKeyActive(false);
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

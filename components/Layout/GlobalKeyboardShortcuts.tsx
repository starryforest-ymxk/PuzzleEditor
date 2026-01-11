/**
 * components/Layout/GlobalKeyboardShortcuts.tsx
 * 全局快捷键管理组件 - 统一处理应用级别的键盘快捷键
 * Updated: 集成全局删除逻辑 (Delete/Backspace)
 */

import React, { useEffect, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { useProjectActions } from '../../hooks/useProjectActions';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';

export const GlobalKeyboardShortcuts: React.FC = () => {
    const { ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const { saveProject } = useProjectActions();
    const { deleteSelection } = useDeleteHandler();

    // 提取删除逻辑
    const handleDelete = useCallback(() => {
        // 如果处于只读模式，不执行删除
        if (ui.readOnly) return;

        // 委托给 useDeleteHandler 处理当前选中项
        deleteSelection();

    }, [ui.readOnly, deleteSelection]);


    // 全局键盘事件处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
            const target = e.target as HTMLElement;

            // 忽略在输入框中的快捷键（除了特定的）
            const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

            // Delete / Backspace 处理
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (!isInInput && !ui.confirmDialog.isOpen) {
                    handleDelete();
                    return;
                }
            }

            // Ctrl+S / Cmd+S: 保存项目
            if (ctrlOrCmd && e.key.toLowerCase() === 's') {
                e.preventDefault();  // 阻止浏览器默认保存行为
                saveProject();
                return;
            }

            // Enter 键完成编辑
            if (e.key === 'Enter' && isInInput) {
                const isTextarea = target.tagName === 'TEXTAREA';
                if (!isTextarea || e.ctrlKey || e.shiftKey) {
                    (target as HTMLInputElement | HTMLTextAreaElement).blur();
                    e.preventDefault();
                    return;
                }
            }

            // 以下快捷键在输入框中不生效
            if (isInInput) return;

            // 只读模式下禁用编辑快捷键
            const isReadOnly = ui.readOnly;
            if (isReadOnly) return;

            // Ctrl+Z: 撤销
            if (ctrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                dispatch({ type: 'UNDO' });
                return;
            }

            // Ctrl+Y 或 Ctrl+Shift+Z: 重做
            if (ctrlOrCmd && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
                e.preventDefault();
                dispatch({ type: 'REDO' });
                return;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [saveProject, dispatch, ui.readOnly, handleDelete, ui.confirmDialog.isOpen]);

    // 该组件不渲染任何 UI
    return null;
};

export default GlobalKeyboardShortcuts;

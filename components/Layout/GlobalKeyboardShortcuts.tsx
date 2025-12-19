/**
 * components/Layout/GlobalKeyboardShortcuts.tsx
 * 全局快捷键管理组件 - 统一处理应用级别的键盘快捷键
 * 
 * 支持的快捷键：
 * - Ctrl+S / Cmd+S: 保存项目 (.puzzle.json) - 复用 useProjectActions
 * - Ctrl+Z: 撤销
 * - Ctrl+Y / Ctrl+Shift+Z: 重做
 */

import React, { useEffect } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { useProjectActions } from '../../hooks/useProjectActions';

export const GlobalKeyboardShortcuts: React.FC = () => {
    const { ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // 复用项目操作 hook 的保存逻辑
    const { saveProject } = useProjectActions();

    // 全局键盘事件处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

            // 忽略在输入框中的快捷键（除了特定的）
            const target = e.target as HTMLElement;
            const isInInput = target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable;

            // Ctrl+S / Cmd+S: 保存项目
            if (ctrlOrCmd && e.key.toLowerCase() === 's') {
                e.preventDefault();  // 阻止浏览器默认保存行为
                saveProject();
                return;
            }

            // 以下快捷键在输入框中不生效
            if (isInInput) return;

            // 只读模式下禁用编辑快捷键
            const isReadOnly = ui.readOnly;

            // Ctrl+Z: 撤销
            if (ctrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (!isReadOnly) dispatch({ type: 'UNDO' });
                return;
            }

            // Ctrl+Y 或 Ctrl+Shift+Z: 重做
            if (ctrlOrCmd && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
                e.preventDefault();
                if (!isReadOnly) dispatch({ type: 'REDO' });
                return;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [saveProject, dispatch, ui.readOnly]);

    // 该组件不渲染任何 UI
    return null;
};

export default GlobalKeyboardShortcuts;

/**
 * components/Layout/GlobalKeyboardShortcuts.tsx
 * 全局快捷键管理组件 - 统一处理应用级别的键盘快捷键
 * 
 * 支持的快捷键：
 * - Ctrl+S / Cmd+S: 保存项目 (.puzzle.json)
 * - Ctrl+Z: 撤销
 * - Ctrl+Y / Ctrl+Shift+Z: 重做
 */

import { useEffect, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ProjectFile } from '../../types/project';
import { UiMessage } from '../../store/types';

// 编辑器版本号
const EDITOR_VERSION = '1.0.0';

export const GlobalKeyboardShortcuts: React.FC = () => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // 消息推送工具
    const pushMessage = useCallback((level: UiMessage['level'], text: string) => {
        dispatch({
            type: 'ADD_MESSAGE',
            payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
        });
    }, [dispatch]);

    // 保存项目 (.puzzle.json 格式)
    const handleSave = useCallback(() => {
        if (!project.isLoaded) {
            pushMessage('warning', 'No project loaded to save');
            return;
        }

        // 构建完整项目文件（包含编辑器状态）
        const projectFile: ProjectFile = {
            fileType: 'puzzle-project',
            editorVersion: EDITOR_VERSION,
            savedAt: new Date().toISOString(),
            project: {
                meta: project.meta,
                blackboard: project.blackboard,
                scripts: project.scripts,
                triggers: project.triggers,
                stageTree: project.stageTree,
                nodes: project.nodes,
                stateMachines: project.stateMachines,
                presentationGraphs: project.presentationGraphs
            },
            // 保存编辑器 UI 状态
            editorState: {
                panelSizes: ui.panelSizes,
                stageExpanded: ui.stageExpanded,
                currentStageId: ui.currentStageId,
                currentNodeId: ui.currentNodeId,
                currentGraphId: ui.currentGraphId,
                view: ui.view
            }
        };

        const jsonStr = JSON.stringify(projectFile, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // 使用 .puzzle.json 后缀区分项目文件
        link.download = `${project.meta.name || 'project'}.puzzle.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        dispatch({ type: 'MARK_CLEAN' });
        pushMessage('info', 'Project saved successfully');
    }, [project, ui, dispatch, pushMessage]);

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
                handleSave();
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
    }, [handleSave, dispatch, ui.readOnly]);

    // 该组件不渲染任何 UI
    return null;
};

export default GlobalKeyboardShortcuts;

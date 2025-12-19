/**
 * hooks/useProjectActions.ts
 * 项目操作 hook - 统一管理保存、导出、加载等逻辑
 * 
 * 功能说明：
 * - saveProject: 保存完整项目文件 (.puzzle.json)，包含编辑器状态
 * - exportProject: 导出精简运行时数据 (.json)，供游戏引擎使用
 * - loadProjectFromString: 解析项目内容并加载到编辑器
 * - pushMessage: 消息推送工具函数
 * 
 * 使用场景：
 * - Header.tsx: 菜单保存/导出
 * - GlobalKeyboardShortcuts.tsx: Ctrl+S 快捷键保存
 */

import { useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../store/context';
import { normalizeProjectForStore } from '../utils/projectNormalizer';
import { ExportBundle, ProjectFile } from '../types/project';
import { UiMessage } from '../store/types';
import { isElectron, saveFileDialog, exportProject as electronExportProject, writeProject, readProject } from '@/src/electron/api';

// 编辑器版本号 - 集中管理
export const EDITOR_VERSION = '1.0.0';

/**
 * 项目操作 hook
 * 提供统一的保存、导出、加载逻辑，供多个组件复用
 */
export function useProjectActions() {
    const { project, ui, runtime } = useEditorState();
    const dispatch = useEditorDispatch();

    // ========== 消息推送工具 ==========
    const pushMessage = useCallback((level: UiMessage['level'], text: string) => {
        dispatch({
            type: 'ADD_MESSAGE',
            payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
        });
    }, [dispatch]);

    // ========== 保存项目 (.puzzle.json) ==========
    /**
     * 保存完整项目文件，包含编辑器 UI 状态
     * - Electron 环境：直接写入文件系统
     * - 浏览器环境：触发下载
     */
    const saveProject = useCallback(async () => {
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
                meta: {
                    ...project.meta,
                    updatedAt: new Date().toISOString()
                },
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

        // Electron 环境：直接保存到文件系统
        if (isElectron() && runtime.currentProjectPath) {
            const result = await writeProject(runtime.currentProjectPath, jsonStr);
            if (result.success) {
                dispatch({ type: 'MARK_CLEAN' });
                pushMessage('info', `Project saved to ${runtime.currentProjectPath}`);
            } else {
                pushMessage('error', `Failed to save project: ${result.error}`);
            }
            return;
        }

        // 浏览器环境或新项目：触发下载
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
    }, [project, ui, runtime, dispatch, pushMessage]);

    // ========== 导出项目（精简运行时数据）==========
    /**
     * 导出精简的运行时数据，供游戏引擎使用
     * 不包含编辑器 UI 状态
     */
    const exportProjectData = useCallback(async () => {
        if (!project.isLoaded) return;

        // 精简导出：仅包含游戏引擎需要的运行时数据
        const exportBundle: ExportBundle = {
            fileType: 'puzzle-export',
            manifestVersion: '1.0.0',
            exportedAt: new Date().toISOString(),
            projectName: project.meta.name,
            projectVersion: project.meta.version,
            data: {
                blackboard: project.blackboard,
                scripts: project.scripts,
                triggers: project.triggers,
                stageTree: project.stageTree,
                nodes: project.nodes,
                stateMachines: project.stateMachines,
                presentationGraphs: project.presentationGraphs
            }
        };

        const jsonStr = JSON.stringify(exportBundle, null, 2);
        // 使用项目设置的导出文件名，或默认生成
        const defaultFileName = project.meta.exportFileName || `${project.meta.name || 'project'}_export.json`;

        // Electron 环境：使用保存对话框
        if (isElectron()) {
            const defaultPath = project.meta.exportPath || '';
            const result = await saveFileDialog(defaultPath, defaultFileName);
            if (result && !result.canceled && result.filePath) {
                const exportResult = await electronExportProject(result.filePath, jsonStr);
                if (exportResult.success) {
                    pushMessage('info', `Project exported to ${result.filePath}`);
                } else {
                    pushMessage('error', `Export failed: ${exportResult.error}`);
                }
            }
            return;
        }

        // 浏览器环境：下载文件
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = defaultFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        pushMessage('info', 'Project exported for runtime');
    }, [project, pushMessage]);

    // ========== 保存项目设置（仅 meta 信息）==========
    /**
     * 仅保存项目设置（meta 信息），然后写入项目文件
     * 用于 Project Settings 弹窗的 "Save Changes" 按钮
     * @param updates 要更新的 meta 字段
     */
    const saveProjectSettings = useCallback(async (updates: Partial<typeof project.meta>) => {
        if (!project.isLoaded) {
            pushMessage('warning', 'No project loaded');
            return;
        }

        // 1. 先更新 Redux 状态（保持 UI 同步）
        dispatch({ type: 'UPDATE_PROJECT_META', payload: updates });

        // 2. Electron 环境：读取磁盘文件 -> 更新 meta -> 写回
        if (isElectron() && runtime.currentProjectPath) {
            try {
                // 读取原始文件
                const readResult = await readProject(runtime.currentProjectPath);
                if (!readResult.success || !readResult.data) {
                    throw new Error(readResult.error || 'Failed to read project file');
                }

                // 解析 JSON
                const fileData = JSON.parse(readResult.data);

                // 确保数据结构正确
                if (!fileData.project || !fileData.project.meta) {
                    throw new Error('Invalid project file format');
                }

                // 仅更新 meta 字段
                const updatedMeta = {
                    ...fileData.project.meta,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };

                // 应用更新
                fileData.project.meta = updatedMeta;
                fileData.savedAt = new Date().toISOString(); // 更新文件保存时间

                // 写回文件
                const jsonStr = JSON.stringify(fileData, null, 2);
                const writeResult = await writeProject(runtime.currentProjectPath, jsonStr);

                if (writeResult.success) {
                    pushMessage('info', 'Project settings updated (file preserved)');
                } else {
                    pushMessage('error', `Failed to save settings: ${writeResult.error}`);
                }

            } catch (err: any) {
                console.error('Save settings failed:', err);
                pushMessage('error', `Failed to update settings: ${err.message}`);
            }
        } else {
            // 浏览器环境：仅更新状态，提示用户手动保存
            pushMessage('info', 'Settings updated. Use Ctrl+S to save the project file.');
        }
    }, [project, runtime.currentProjectPath, dispatch, pushMessage]);

    // ========== 加载项目（从字符串解析）==========
    /**
     * 从 JSON 字符串解析并加载项目
     * @param content JSON 字符串内容
     * @param filePath 可选的文件路径（Electron 环境使用）
     */
    const loadProjectFromString = useCallback((content: string, filePath?: string) => {
        dispatch({ type: 'INIT_START' });

        try {
            const parsed = JSON.parse(content);
            const normalized = normalizeProjectForStore(parsed as any);

            dispatch({
                type: 'INIT_SUCCESS',
                payload: {
                    stageTree: normalized.project.stageTree,
                    nodes: normalized.project.nodes,
                    stateMachines: normalized.project.stateMachines,
                    presentationGraphs: normalized.project.presentationGraphs,
                    blackboard: normalized.project.blackboard,
                    meta: normalized.project.meta,
                    scripts: normalized.project.scripts,
                    triggers: normalized.project.triggers
                }
            });

            // 设置项目路径（Electron 环境）
            if (filePath) {
                dispatch({ type: 'SET_PROJECT_PATH', payload: filePath });
            }

            // 如果是 ProjectFile 格式，恢复编辑器 UI 状态
            if (normalized.editorState) {
                const es = normalized.editorState;
                dispatch({ type: 'SET_PANEL_SIZES', payload: es.panelSizes });
                // 恢复阶段树展开状态
                Object.entries(es.stageExpanded).forEach(([id, expanded]) => {
                    dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id, expanded } });
                });
                // 恢复视图
                dispatch({ type: 'SWITCH_VIEW', payload: es.view });
                // 恢复导航位置
                if (es.currentStageId) {
                    dispatch({
                        type: 'NAVIGATE_TO',
                        payload: { stageId: es.currentStageId, nodeId: es.currentNodeId, graphId: es.currentGraphId }
                    });
                }
                pushMessage('info', `Project "${normalized.project.meta.name}" restored with editor state`);
            } else {
                // 普通加载，跳转到根 Stage
                pushMessage('info', `Project "${normalized.project.meta.name}" loaded successfully`);

                if (normalized.project.stageTree.rootId) {
                    dispatch({
                        type: 'NAVIGATE_TO',
                        payload: { stageId: normalized.project.stageTree.rootId, nodeId: null, graphId: null }
                    });
                    dispatch({
                        type: 'SELECT_OBJECT',
                        payload: { type: 'STAGE', id: normalized.project.stageTree.rootId }
                    });
                }
            }
        } catch (err) {
            console.error('Failed to parse JSON:', err);
            dispatch({ type: 'INIT_ERROR', payload: { message: 'JSON import failed' } });
            pushMessage('error', 'Failed to load project: invalid JSON format');
        }
    }, [dispatch, pushMessage]);

    return {
        saveProject,
        saveProjectSettings,
        exportProject: exportProjectData,
        loadProjectFromString,
        pushMessage
    };
}

export default useProjectActions;

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
import { createEmptyProject } from '../utils/projectFactory';
import { ExportBundle, ProjectFile } from '../types/project';
import { UiMessage } from '../store/types';
import { usePushMessage } from './usePushMessage';
import { isElectron, saveFileDialog, exportProject as electronExportProject, writeProject, readProject } from '@/src/electron/api';
import { validateProject } from '../utils/validation/validator';
import { normalizePanelSizes } from '../utils/panelSizes';

// 编辑器版本号 - 集中管理
export const EDITOR_VERSION = '1.0.0';

/**
 * 项目操作 hook
 * 提供统一的保存、导出、加载逻辑，供多个组件复用
 */
export function useProjectActions() {
    const { project, ui, runtime } = useEditorState();
    const dispatch = useEditorDispatch();

    // 消息推送（复用共享 Hook）
    const pushMessage = usePushMessage();

    // ========== 保存项目 (.puzzle.json) ==========
    /**
     * 保存完整项目文件，包含编辑器 UI 状态
     * - Electron 环境：直接写入文件系统
     * - 浏览器环境：触发下载
     */
    const saveProject = useCallback(async (options?: { silent?: boolean }) => {
        const silent = !!options?.silent;

        if (!project.isLoaded) {
            if (!silent) {
                pushMessage('warning', 'No project loaded to save');
            }
            return false;
        }

        // 统一时间戳，确保 savedAt 和 updatedAt 一致
        const now = new Date().toISOString();

        // 构建完整项目文件（包含编辑器状态）
        const projectFile: ProjectFile = {
            fileType: 'puzzle-project',
            editorVersion: EDITOR_VERSION,
            savedAt: now,
            project: {
                meta: {
                    ...project.meta,
                    updatedAt: now
                },
                blackboard: project.blackboard,
                scripts: project.scripts,
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
                // 同步更新 Redux 中的 updatedAt（不触发 isDirty）
                dispatch({ type: 'SYNC_UPDATED_AT', payload: now });
                dispatch({ type: 'MARK_CLEAN' });
                if (!silent) {
                    pushMessage('info', `Project saved to ${runtime.currentProjectPath}`);
                }
                return true;
            } else {
                pushMessage('error', `Failed to save project: ${result.error}`);
                return false;
            }
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

        // 同步更新 Redux 中的 updatedAt（不触发 isDirty）
        dispatch({ type: 'SYNC_UPDATED_AT', payload: now });
        dispatch({ type: 'MARK_CLEAN' });
        if (!silent) {
            pushMessage('info', 'Project saved successfully');
        }
        return true;
    }, [project, ui, runtime, dispatch, pushMessage]);

    // ========== 导出项目（精简运行时数据）==========
    /**
     * 导出精简的运行时数据，供游戏引擎使用
     * 不包含编辑器 UI 状态
     */
    const exportProjectData = useCallback(async () => {
        if (!project.isLoaded) return;

        // 1. Run Validation
        const validationResults = validateProject(project);
        const errors = validationResults.filter(r => r.level === 'error');

        if (errors.length > 0) {
            pushMessage('error', `Export failed: Found ${errors.length} critical errors.`);
            // Push individual errors to stack
            errors.forEach(err => {
                pushMessage('error', `[${err.location}] ${err.message}`);
            });
            return; // Block export
        }

        // 2. Warn about warnings if any (optional, just logging count)
        const warnings = validationResults.filter(r => r.level === 'warning');
        if (warnings.length > 0) {
            pushMessage('warning', `Exporting with ${warnings.length} warnings. Check message stack for details.`);
            warnings.forEach(warn => {
                pushMessage('warning', `[${warn.location}] ${warn.message}`);
            });
        }

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
                stageTree: project.stageTree,
                nodes: project.nodes,
                stateMachines: project.stateMachines,
                presentationGraphs: project.presentationGraphs
            }
        };

        const jsonStr = JSON.stringify(exportBundle, null, 2);
        // 使用项目设置的导出文件名，或默认生成
        let defaultFileName = project.meta.exportFileName;
        if (!defaultFileName) {
            defaultFileName = `${project.meta.name || 'project'}.export.json`;
        } else if (!defaultFileName.toLowerCase().endsWith('.json')) {
            // 如果用户自定义了文件名但没有后缀，自动补充 .export.json
            if (!defaultFileName.toLowerCase().endsWith('.export')) {
                defaultFileName += '.export';
            }
            defaultFileName += '.json';
        }

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

    // ========== 创建并保存新项目 ==========
    /**
     * 创建新项目并立即保存到磁盘
     * @param name 项目名称
     * @param description 项目描述
     * @param location 项目存放目录
     */
    const createAndSaveProject = useCallback(async (name: string, description: string, location: string) => {
        // 1. 创建内存中的项目对象
        const newProject = createEmptyProject(name, description);

        // 2. Electron 环境：立即写入文件
        let projectPath = '';
        if (isElectron() && location) {
            // 注意：简单的路径拼接，实际环境可能需要处理路径分隔符
            // 假设 location 是目录路径
            const separator = location.includes('\\') ? '\\' : '/';
            const fileName = `${name}.puzzle.json`;
            projectPath = location.endsWith(separator) ? location + fileName : location + separator + fileName;

            // 构建完整项目文件
            const projectFile: ProjectFile = {
                fileType: 'puzzle-project',
                editorVersion: EDITOR_VERSION,
                savedAt: new Date().toISOString(),
                project: {
                    meta: newProject.meta,
                    blackboard: newProject.blackboard,
                    scripts: newProject.scripts,
                    stageTree: newProject.stageTree,
                    nodes: newProject.nodes,
                    stateMachines: newProject.stateMachines,
                    presentationGraphs: newProject.presentationGraphs
                },
                editorState: {
                    // 默认编辑器状态
                    panelSizes: normalizePanelSizes({ explorerWidth: 280, inspectorWidth: 300, stagesHeight: 55 }),
                    stageExpanded: {},
                    currentStageId: newProject.stageTree.rootId || null,
                    currentNodeId: null,
                    currentGraphId: null,
                    view: 'EDITOR'
                }
            };

            const jsonStr = JSON.stringify(projectFile, null, 2);

            // 写入文件
            const result = await writeProject(projectPath, jsonStr);
            if (result.success) {
                pushMessage('info', `Project created at ${projectPath}`);
            } else {
                pushMessage('error', `Failed to create project file: ${result.error}`);
                // 如果写入失败，仍继续在内存中加载，但提示错误
            }
        }

        // 3. 加载到 Store
        dispatch({
            type: 'INIT_SUCCESS',
            payload: {
                stageTree: newProject.stageTree,
                nodes: newProject.nodes,
                stateMachines: newProject.stateMachines,
                presentationGraphs: newProject.presentationGraphs,
                blackboard: newProject.blackboard,
                meta: newProject.meta,
                scripts: newProject.scripts
            }
        });

        // 4. 设置当前项目路径
        if (projectPath) {
            dispatch({ type: 'SET_PROJECT_PATH', payload: projectPath });
        }

        // 5. 初始导航
        if (newProject.stageTree.rootId) {
            dispatch({
                type: 'NAVIGATE_TO',
                payload: { stageId: newProject.stageTree.rootId, nodeId: null, graphId: null }
            });
            dispatch({
                type: 'SELECT_OBJECT',
                payload: { type: 'STAGE', id: newProject.stageTree.rootId }
            });
        }

        // 6. 标记为 clean（因为刚保存）
        if (projectPath) {
            dispatch({ type: 'MARK_CLEAN' });
        }

    }, [dispatch, pushMessage]);

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
                    scripts: normalized.project.scripts
                }
            });

            // 设置项目路径（Electron 环境）
            if (filePath) {
                dispatch({ type: 'SET_PROJECT_PATH', payload: filePath });
            }

            // 如果是 ProjectFile 格式，恢复编辑器 UI 状态
            if (normalized.editorState) {
                const es = normalized.editorState;
                dispatch({ type: 'SET_PANEL_SIZES', payload: normalizePanelSizes(es.panelSizes) });
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
                pushMessage('info', `Project "${normalized.project.meta.name}" restored.`);
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
        createAndSaveProject,
        exportProject: exportProjectData,
        loadProjectFromString,
        pushMessage
    };
}

export default useProjectActions;

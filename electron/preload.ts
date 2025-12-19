/**
 * Electron 预加载脚本
 * 在渲染进程加载前执行，负责安全地暴露主进程 API 给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
    IPC_CHANNELS,
    ElectronAPI,
    UserPreferences,
    CreateProjectParams,
    FileDialogResult,
    IPCResult,
    CreateProjectResult,
} from './types.js';

/**
 * 暴露给渲染进程的 API 实现
 */
const electronAPI: ElectronAPI = {
    // ========================================================================
    // 偏好设置相关
    // ========================================================================

    /**
     * 加载用户偏好设置
     */
    loadPreferences: (): Promise<IPCResult<UserPreferences>> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_LOAD);
    },

    /**
     * 保存用户偏好设置
     */
    savePreferences: (prefs: UserPreferences): Promise<IPCResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_SAVE, prefs);
    },

    // ========================================================================
    // 项目操作相关
    // ========================================================================

    /**
     * 读取项目文件
     * @param filePath 项目文件路径
     */
    readProject: (filePath: string): Promise<IPCResult<string>> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_READ, filePath);
    },

    /**
     * 写入项目文件
     * @param filePath 项目文件路径
     * @param data 项目数据 (JSON 字符串)
     */
    writeProject: (filePath: string, data: string): Promise<IPCResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_WRITE, filePath, data);
    },

    /**
     * 导出项目文件
     * @param filePath 导出文件路径
     * @param data 导出数据 (JSON 字符串)
     */
    exportProject: (filePath: string, data: string): Promise<IPCResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_EXPORT, filePath, data);
    },

    /**
     * 创建新项目
     * @param params 项目创建参数
     */
    createProject: (params: CreateProjectParams): Promise<IPCResult<CreateProjectResult>> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, params);
    },

    // ========================================================================
    // 最近项目管理相关
    // ========================================================================

    /**
     * 更新最近项目
     * @param projectPath 项目文件路径
     * @param projectName 项目名称
     */
    updateRecentProject: (projectPath: string, projectName: string): Promise<IPCResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.RECENT_UPDATE, projectPath, projectName);
    },

    /**
     * 从最近项目列表移除
     * @param projectPath 项目文件路径
     */
    removeRecentProject: (projectPath: string): Promise<IPCResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.RECENT_REMOVE, projectPath);
    },

    /**
     * 清空最近项目列表
     */
    clearRecentProjects: (): Promise<IPCResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.RECENT_CLEAR);
    },

    // ========================================================================
    // 对话框相关
    // ========================================================================

    /**
     * 打开文件选择对话框
     */
    openFileDialog: (): Promise<FileDialogResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE);
    },

    /**
     * 打开目录选择对话框
     */
    openDirectoryDialog: (): Promise<FileDialogResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY);
    },

    /**
     * 打开保存文件对话框
     * @param defaultPath 默认目录路径
     * @param defaultFileName 默认文件名
     */
    saveFileDialog: (defaultPath?: string, defaultFileName?: string): Promise<FileDialogResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, defaultPath, defaultFileName);
    },

    // ========================================================================
    // 文件操作相关
    // ========================================================================

    /**
     * 检查文件是否存在
     * @param filePath 文件路径
     */
    fileExists: (filePath: string): Promise<boolean> => {
        return ipcRenderer.invoke(IPC_CHANNELS.FILE_EXISTS, filePath);
    },

    /**
     * 在资源管理器中显示文件
     * @param filePath 文件路径
     */
    showInExplorer: (filePath: string): Promise<void> => {
        return ipcRenderer.invoke(IPC_CHANNELS.FILE_SHOW_IN_EXPLORER, filePath);
    },
};

// 通过 contextBridge 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

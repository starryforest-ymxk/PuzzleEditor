/**
 * Electron 预加载脚本
 * 在渲染进程加载前执行，负责安全地暴露主进程 API 给渲染进程
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, } from './types.js';
/**
 * 暴露给渲染进程的 API 实现
 */
const electronAPI = {
    // ========================================================================
    // 偏好设置相关
    // ========================================================================
    /**
     * 加载用户偏好设置
     */
    loadPreferences: () => {
        return ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_LOAD);
    },
    /**
     * 保存用户偏好设置
     */
    savePreferences: (prefs) => {
        return ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_SAVE, prefs);
    },
    // ========================================================================
    // 项目操作相关
    // ========================================================================
    /**
     * 读取项目文件
     * @param filePath 项目文件路径
     */
    readProject: (filePath) => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_READ, filePath);
    },
    /**
     * 写入项目文件
     * @param filePath 项目文件路径
     * @param data 项目数据 (JSON 字符串)
     */
    writeProject: (filePath, data) => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_WRITE, filePath, data);
    },
    /**
     * 导出项目文件
     * @param filePath 导出文件路径
     * @param data 导出数据 (JSON 字符串)
     */
    exportProject: (filePath, data) => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_EXPORT, filePath, data);
    },
    /**
     * 创建新项目
     * @param params 项目创建参数
     */
    createProject: (params) => {
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
    updateRecentProject: (projectPath, projectName) => {
        return ipcRenderer.invoke(IPC_CHANNELS.RECENT_UPDATE, projectPath, projectName);
    },
    /**
     * 从最近项目列表移除
     * @param projectPath 项目文件路径
     */
    removeRecentProject: (projectPath) => {
        return ipcRenderer.invoke(IPC_CHANNELS.RECENT_REMOVE, projectPath);
    },
    /**
     * 清空最近项目列表
     */
    clearRecentProjects: () => {
        return ipcRenderer.invoke(IPC_CHANNELS.RECENT_CLEAR);
    },
    // ========================================================================
    // 对话框相关
    // ========================================================================
    /**
     * 打开文件选择对话框
     */
    openFileDialog: () => {
        return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE);
    },
    /**
     * 打开目录选择对话框
     */
    openDirectoryDialog: () => {
        return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY);
    },
    /**
     * 打开保存文件对话框
     * @param defaultPath 默认目录路径
     * @param defaultFileName 默认文件名
     */
    saveFileDialog: (defaultPath, defaultFileName) => {
        return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, defaultPath, defaultFileName);
    },
    // ========================================================================
    // 文件操作相关
    // ========================================================================
    /**
     * 检查文件是否存在
     * @param filePath 文件路径
     */
    fileExists: (filePath) => {
        return ipcRenderer.invoke(IPC_CHANNELS.FILE_EXISTS, filePath);
    },
    /**
     * 在资源管理器中显示文件
     * @param filePath 文件路径
     */
    showInExplorer: (filePath) => {
        return ipcRenderer.invoke(IPC_CHANNELS.FILE_SHOW_IN_EXPLORER, filePath);
    },
    // ========================================================================
    // 事件监听
    // ========================================================================
    /**
     * 监听项目文件变更
     */
    onProjectFileChanged: (callback) => {
        const subscription = (_, event) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.PROJECT_FILE_CHANGED, subscription);
        // 返回取消订阅函数
        return () => {
            ipcRenderer.removeListener(IPC_CHANNELS.PROJECT_FILE_CHANGED, subscription);
        };
    },
};
// 通过 contextBridge 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

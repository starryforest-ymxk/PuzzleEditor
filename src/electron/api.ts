/**
 * src/electron/api.ts
 * 渲染进程 Electron API 封装
 * 提供统一的接口调用 Electron 主进程功能
 */

import type {
    ElectronAPI,
    UserPreferences,
    CreateProjectParams,
    CreateProjectResult,
    IPCResult,
    FileDialogResult
} from '@/electron/types';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查是否在 Electron 环境中运行
 */
export function isElectron(): boolean {
    return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

/**
 * 获取 Electron API 实例
 * 如果不在 Electron 环境中则返回 null
 */
function getAPI(): ElectronAPI | null {
    if (isElectron()) {
        return window.electronAPI!;
    }
    return null;
}

// ============================================================================
// 偏好设置 API
// ============================================================================

/**
 * 加载用户偏好设置
 */
export async function loadPreferences(): Promise<IPCResult<UserPreferences>> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.loadPreferences();
}

/**
 * 保存用户偏好设置
 */
export async function savePreferences(prefs: UserPreferences): Promise<IPCResult> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.savePreferences(prefs);
}

// ============================================================================
// 项目操作 API
// ============================================================================

/**
 * 读取项目文件
 * @param filePath 项目文件路径
 */
export async function readProject(filePath: string): Promise<IPCResult<string>> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.readProject(filePath);
}

/**
 * 写入项目文件
 * @param filePath 项目文件路径
 * @param data 项目数据 (JSON 字符串)
 */
export async function writeProject(filePath: string, data: string): Promise<IPCResult> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.writeProject(filePath, data);
}

/**
 * 导出项目文件
 * @param filePath 导出文件路径
 * @param data 导出数据 (JSON 字符串)
 */
export async function exportProject(filePath: string, data: string): Promise<IPCResult> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.exportProject(filePath, data);
}

/**
 * 创建新项目
 * @param params 项目创建参数
 */
export async function createProject(params: CreateProjectParams): Promise<IPCResult<CreateProjectResult>> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.createProject(params);
}

// ============================================================================
// 最近项目管理 API
// ============================================================================

/**
 * 更新最近项目列表
 * @param projectPath 项目文件路径
 * @param projectName 项目名称
 */
export async function updateRecentProject(projectPath: string, projectName: string): Promise<IPCResult> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.updateRecentProject(projectPath, projectName);
}

/**
 * 从最近项目列表移除
 * @param projectPath 项目文件路径
 */
export async function removeRecentProject(projectPath: string): Promise<IPCResult> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.removeRecentProject(projectPath);
}

/**
 * 清空最近项目列表
 */
export async function clearRecentProjects(): Promise<IPCResult> {
    const api = getAPI();
    if (!api) {
        return { success: false, error: 'Not running in Electron environment' };
    }
    return api.clearRecentProjects();
}

// ============================================================================
// 对话框 API
// ============================================================================

/**
 * 打开文件选择对话框
 */
export async function openFileDialog(): Promise<FileDialogResult | null> {
    const api = getAPI();
    if (!api) {
        return null;
    }
    return api.openFileDialog();
}

/**
 * 打开目录选择对话框
 */
export async function openDirectoryDialog(): Promise<FileDialogResult | null> {
    const api = getAPI();
    if (!api) {
        return null;
    }
    return api.openDirectoryDialog();
}

/**
 * 打开保存文件对话框
 * @param defaultPath 默认目录路径
 * @param defaultFileName 默认文件名
 */
export async function saveFileDialog(defaultPath?: string, defaultFileName?: string): Promise<FileDialogResult | null> {
    const api = getAPI();
    if (!api) {
        return null;
    }
    return api.saveFileDialog(defaultPath, defaultFileName);
}

// ============================================================================
// 文件操作 API
// ============================================================================

/**
 * 检查文件是否存在
 * @param filePath 文件路径
 */
export async function fileExists(filePath: string): Promise<boolean> {
    const api = getAPI();
    if (!api) {
        return false;
    }
    return api.fileExists(filePath);
}

/**
 * 在资源管理器中显示文件
 * @param filePath 文件路径
 */
export async function showInExplorer(filePath: string): Promise<void> {
    const api = getAPI();
    if (!api) {
        return;
    }
    return api.showInExplorer(filePath);
}

// ============================================================================
// 事件监听 API
// ============================================================================

/**
 * 监听项目文件变更
 * @param callback 变更回调
 * @returns 取消监听函数
 */
export function onProjectFileChanged(callback: (event: import('@/electron/types').FileChangedEvent) => void): () => void {
    const api = getAPI();
    if (!api) {
        return () => { };
    }
    return api.onProjectFileChanged(callback);
}

// ============================================================================
// 导出类型
// ============================================================================

export type {
    UserPreferences,
    CreateProjectParams,
    CreateProjectResult,
    IPCResult,
    FileDialogResult,
    RecentProject,
    FileChangedEvent
} from '@/electron/types';


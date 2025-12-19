/**
 * src/electron/useElectronAPI.ts
 * Electron API React Hook
 * 提供在 React 组件中使用 Electron API 的便捷方式
 */

import { useState, useEffect, useCallback } from 'react';
import * as electronAPI from './api';
import type { UserPreferences, RecentProject } from './api';

// ============================================================================
// Hook: useElectron
// ============================================================================

/**
 * 检查是否在 Electron 环境中
 */
export function useIsElectron(): boolean {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        setIsElectron(electronAPI.isElectron());
    }, []);

    return isElectron;
}

// ============================================================================
// Hook: usePreferences
// ============================================================================

interface UsePreferencesReturn {
    preferences: UserPreferences | null;
    isLoading: boolean;
    error: string | null;
    reload: () => Promise<void>;
    save: (prefs: UserPreferences) => Promise<boolean>;
    updateProjectsDirectory: (path: string) => Promise<boolean>;
    updateExportDirectory: (path: string) => Promise<boolean>;
    updateRestoreLastProject: (value: boolean) => Promise<boolean>;
}

/**
 * 用户偏好设置 Hook
 */
export function usePreferences(): UsePreferencesReturn {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 加载偏好设置
    const reload = useCallback(async () => {
        if (!electronAPI.isElectron()) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const result = await electronAPI.loadPreferences();
        if (result.success && result.data) {
            setPreferences(result.data);
        } else {
            setError(result.error || 'Failed to load preferences');
        }
        setIsLoading(false);
    }, []);

    // 保存偏好设置
    const save = useCallback(async (prefs: UserPreferences): Promise<boolean> => {
        if (!electronAPI.isElectron()) {
            return false;
        }

        const result = await electronAPI.savePreferences(prefs);
        if (result.success) {
            setPreferences(prefs);
            return true;
        } else {
            setError(result.error || 'Failed to save preferences');
            return false;
        }
    }, []);

    // 便捷更新方法
    const updateProjectsDirectory = useCallback(async (path: string): Promise<boolean> => {
        if (!preferences) return false;
        return save({ ...preferences, projectsDirectory: path });
    }, [preferences, save]);

    const updateExportDirectory = useCallback(async (path: string): Promise<boolean> => {
        if (!preferences) return false;
        return save({ ...preferences, exportDirectory: path });
    }, [preferences, save]);

    const updateRestoreLastProject = useCallback(async (value: boolean): Promise<boolean> => {
        if (!preferences) return false;
        return save({ ...preferences, restoreLastProject: value });
    }, [preferences, save]);

    // 初始加载
    useEffect(() => {
        reload();
    }, [reload]);

    return {
        preferences,
        isLoading,
        error,
        reload,
        save,
        updateProjectsDirectory,
        updateExportDirectory,
        updateRestoreLastProject,
    };
}

// ============================================================================
// Hook: useRecentProjects
// ============================================================================

interface UseRecentProjectsReturn {
    recentProjects: RecentProject[];
    isLoading: boolean;
    refresh: () => Promise<void>;
    remove: (path: string) => Promise<boolean>;
    clear: () => Promise<boolean>;
}

/**
 * 最近项目列表 Hook
 */
export function useRecentProjects(): UseRecentProjectsReturn {
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 刷新列表
    const refresh = useCallback(async () => {
        if (!electronAPI.isElectron()) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const result = await electronAPI.loadPreferences();
        if (result.success && result.data) {
            setRecentProjects(result.data.recentProjects);
        }
        setIsLoading(false);
    }, []);

    // 移除项目
    const remove = useCallback(async (path: string): Promise<boolean> => {
        const result = await electronAPI.removeRecentProject(path);
        if (result.success) {
            setRecentProjects(prev => prev.filter(p => p.path !== path));
            return true;
        }
        return false;
    }, []);

    // 清空列表
    const clear = useCallback(async (): Promise<boolean> => {
        const result = await electronAPI.clearRecentProjects();
        if (result.success) {
            setRecentProjects([]);
            return true;
        }
        return false;
    }, []);

    // 初始加载
    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        recentProjects,
        isLoading,
        refresh,
        remove,
        clear,
    };
}

// ============================================================================
// Hook: useProjectFile
// ============================================================================

interface UseProjectFileReturn {
    isElectron: boolean;
    openProject: () => Promise<{ path: string; content: string } | null>;
    saveProject: (path: string, data: string) => Promise<boolean>;
    createProject: (name: string, description?: string) => Promise<{ path: string } | null>;
    exportProject: (path: string, data: string) => Promise<boolean>;
}

/**
 * 项目文件操作 Hook
 */
export function useProjectFile(): UseProjectFileReturn {
    const isElectronEnv = useIsElectron();

    // 打开项目
    const openProject = useCallback(async (): Promise<{ path: string; content: string } | null> => {
        if (!electronAPI.isElectron()) return null;

        const dialogResult = await electronAPI.openFileDialog();
        if (!dialogResult || dialogResult.canceled || !dialogResult.filePath) {
            return null;
        }

        const readResult = await electronAPI.readProject(dialogResult.filePath);
        if (!readResult.success || !readResult.data) {
            return null;
        }

        // 更新最近项目
        try {
            const projectData = JSON.parse(readResult.data);
            const projectName = projectData?.project?.meta?.name || 'Unknown Project';
            await electronAPI.updateRecentProject(dialogResult.filePath, projectName);
        } catch {
            // 忽略解析错误
        }

        return { path: dialogResult.filePath, content: readResult.data };
    }, []);

    // 保存项目
    const saveProject = useCallback(async (path: string, data: string): Promise<boolean> => {
        if (!electronAPI.isElectron()) return false;

        const result = await electronAPI.writeProject(path, data);
        return result.success;
    }, []);

    // 创建项目
    const createNewProject = useCallback(async (name: string, description?: string): Promise<{ path: string } | null> => {
        if (!electronAPI.isElectron()) return null;

        const result = await electronAPI.createProject({ name, description });
        if (result.success && result.data) {
            return { path: result.data.path };
        }
        return null;
    }, []);

    // 导出项目
    const exportProjectToFile = useCallback(async (path: string, data: string): Promise<boolean> => {
        if (!electronAPI.isElectron()) return false;

        const result = await electronAPI.exportProject(path, data);
        return result.success;
    }, []);

    return {
        isElectron: isElectronEnv,
        openProject,
        saveProject,
        createProject: createNewProject,
        exportProject: exportProjectToFile,
    };
}

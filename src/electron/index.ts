/**
 * src/electron/index.ts
 * Electron API 统一导出
 */

// 导出所有 API 函数
export * from './api';

// 导出所有 Hooks
export {
    useIsElectron,
    usePreferences,
    useRecentProjects,
    useProjectFile,
} from './useElectronAPI';

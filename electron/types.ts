/**
 * Electron 主进程类型定义
 * 定义 IPC 通信中使用的所有类型接口
 */

// ============================================================================
// 用户偏好相关类型
// ============================================================================

/**
 * 最近打开的项目记录
 */
export interface RecentProject {
    /** 项目文件完整路径 */
    path: string;
    /** 项目显示名称 */
    name: string;
    /** 最后打开时间 (ISO8601 格式) */
    lastOpened: string;
}

/**
 * 翻译服务配置 (持久化存储)
 */
export interface TranslationPreferences {
    provider: 'openai' | 'google' | 'local';
    openaiApiKey?: string;
    googleApiKey?: string;
    openaiModel?: string;
    openaiBaseUrl?: string;
    googleBaseUrl?: string;
    autoTranslate?: boolean;
}

/**
 * 用户偏好设置
 * 存储于 %APPDATA%/StarryTree/PuzzleEditor/preferences.json
 */
export interface UserPreferences {
    /** 新项目存储路径 (默认: Documents/StarryTree/PuzzleEditor/Projects/) */
    projectsDirectory: string;

    /** 默认导出路径 (空则使用 projectsDirectory) */
    exportDirectory: string;

    /** 启动时自动加载上次项目 */
    restoreLastProject: boolean;

    /** 上次打开的项目文件路径 */
    lastProjectPath: string | null;

    /** 最近打开的项目列表 (最多保留 10 条) */
    recentProjects: RecentProject[];

    /** 翻译服务配置 */
    translation?: TranslationPreferences;

    /** 消息过滤器配置 */
    messageFilters?: {
        info: boolean;
        warning: boolean;
        error: boolean;
    };
}

// ============================================================================
// IPC 通道名称常量
// ============================================================================

/**
 * IPC 通道名称定义
 * 用于主进程和渲染进程之间的通信
 */
export const IPC_CHANNELS = {
    // 偏好设置相关
    PREFERENCES_LOAD: 'preferences:load',
    PREFERENCES_SAVE: 'preferences:save',

    // 项目操作相关
    PROJECT_READ: 'project:read',
    PROJECT_WRITE: 'project:write',
    PROJECT_EXPORT: 'project:export',
    PROJECT_CREATE: 'project:create',

    // 最近项目管理
    RECENT_UPDATE: 'recent:update',
    RECENT_REMOVE: 'recent:remove',
    RECENT_CLEAR: 'recent:clear',

    // 对话框相关
    DIALOG_OPEN_FILE: 'dialog:open-file',
    DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
    DIALOG_SAVE_FILE: 'dialog:save-file',

    // 文件操作相关
    FILE_EXISTS: 'file:exists',
    FILE_SHOW_IN_EXPLORER: 'file:show-in-explorer',
} as const;

// ============================================================================
// IPC 操作结果类型
// ============================================================================

/**
 * IPC 操作结果基础接口
 */
export interface IPCResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * 文件选择对话框结果
 */
export interface FileDialogResult {
    /** 用户是否取消操作 */
    canceled: boolean;
    /** 选中的文件路径 */
    filePath?: string;
    /** 选中的文件路径列表 (多选时) */
    filePaths?: string[];
}

/**
 * 项目创建参数
 */
export interface CreateProjectParams {
    /** 项目名称 */
    name: string;
    /** 项目描述 (可选) */
    description?: string;
}

/**
 * 项目创建结果
 */
export interface CreateProjectResult {
    /** 创建的项目文件路径 */
    path: string;
}

// ============================================================================
// 暴露给渲染进程的 API 类型
// ============================================================================

/**
 * 通过 preload 脚本暴露给渲染进程的 API
 */
export interface ElectronAPI {
    // 偏好设置
    loadPreferences: () => Promise<IPCResult<UserPreferences>>;
    savePreferences: (prefs: UserPreferences) => Promise<IPCResult>;

    // 项目操作
    readProject: (path: string) => Promise<IPCResult<string>>;
    writeProject: (path: string, data: string) => Promise<IPCResult>;
    exportProject: (path: string, data: string) => Promise<IPCResult>;
    createProject: (params: CreateProjectParams) => Promise<IPCResult<CreateProjectResult>>;

    // 最近项目管理
    updateRecentProject: (path: string, name: string) => Promise<IPCResult>;
    removeRecentProject: (path: string) => Promise<IPCResult>;
    clearRecentProjects: () => Promise<IPCResult>;

    // 对话框
    openFileDialog: () => Promise<FileDialogResult>;
    openDirectoryDialog: () => Promise<FileDialogResult>;
    saveFileDialog: (defaultPath?: string, defaultFileName?: string) => Promise<FileDialogResult>;

    // 文件操作
    fileExists: (path: string) => Promise<boolean>;
    showInExplorer: (path: string) => Promise<void>;
}

// ============================================================================
// 扩展 Window 类型
// ============================================================================

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

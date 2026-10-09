/**
 * Electron 主进程类型定义
 * 定义 IPC 通信中使用的所有类型接口
 */
// ============================================================================
// IPC 通道名称常量
// ============================================================================
/**
 * IPC 通道名称定义
 * 用于主进程和渲染进程之间的通信
 */
export const IPC_CHANNELS = {
    SESSION_START: 'session:start',
    SESSION_STOP: 'session:stop',
    SESSION_REQUEST: 'session:request',
    SESSION_RESPONSE: 'session:response',
    // 偏好设置相关
    PREFERENCES_LOAD: 'preferences:load',
    PREFERENCES_SAVE: 'preferences:save',
    // 项目操作相关
    PROJECT_READ: 'project:read',
    PROJECT_WRITE: 'project:write',
    PROJECT_ACTIVATE: 'project:activate',
    PROJECT_CLAIM: 'project:claim',
    PROJECT_RELEASE_CLAIM: 'project:release-claim',
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
    // 文件监听
    PROJECT_FILE_CHANGED: 'project:file-changed',
    // 原生窗口关闭握手
    WINDOW_CLOSE_READY: 'window:close-ready',
    WINDOW_CLOSE_REQUESTED: 'window:close-requested',
    WINDOW_CLOSE_RESOLVE: 'window:close-resolve',
};

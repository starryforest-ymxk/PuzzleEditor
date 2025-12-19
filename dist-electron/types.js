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
};

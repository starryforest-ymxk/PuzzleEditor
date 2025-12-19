/**
 * IPC 处理器注册
 * 集中注册所有 IPC 事件处理器
 */
import { dialog, shell } from 'electron';
import { IPC_CHANNELS } from '../types.js';
import { preferencesService } from './preferencesService.js';
import { fileService } from './fileService.js';
/**
 * 注册所有 IPC 处理器
 * @param ipcMain Electron IpcMain 实例
 */
export function registerIpcHandlers(ipcMain) {
    // ========================================================================
    // 偏好设置处理器
    // ========================================================================
    /**
     * 加载用户偏好设置
     */
    ipcMain.handle(IPC_CHANNELS.PREFERENCES_LOAD, async () => {
        try {
            const preferences = await preferencesService.loadPreferences();
            return { success: true, data: preferences };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to load preferences:', message);
            return { success: false, error: message };
        }
    });
    /**
     * 保存用户偏好设置
     */
    ipcMain.handle(IPC_CHANNELS.PREFERENCES_SAVE, async (_, prefs) => {
        try {
            await preferencesService.savePreferences(prefs);
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to save preferences:', message);
            return { success: false, error: message };
        }
    });
    // ========================================================================
    // 项目操作处理器
    // ========================================================================
    /**
     * 读取项目文件
     */
    ipcMain.handle(IPC_CHANNELS.PROJECT_READ, async (_, filePath) => {
        try {
            const content = await fileService.readFile(filePath);
            return { success: true, data: content };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to read project:', message);
            return { success: false, error: message };
        }
    });
    /**
     * 写入项目文件
     */
    ipcMain.handle(IPC_CHANNELS.PROJECT_WRITE, async (_, filePath, data) => {
        try {
            await fileService.writeFile(filePath, data);
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to write project:', message);
            return { success: false, error: message };
        }
    });
    /**
     * 导出项目文件
     */
    ipcMain.handle(IPC_CHANNELS.PROJECT_EXPORT, async (_, filePath, data) => {
        try {
            await fileService.writeFile(filePath, data);
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to export project:', message);
            return { success: false, error: message };
        }
    });
    /**
     * 创建新项目
     */
    ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_, params) => {
        try {
            const result = await fileService.createProject(params);
            return { success: true, data: result };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to create project:', message);
            return { success: false, error: message };
        }
    });
    // ========================================================================
    // 最近项目管理处理器
    // ========================================================================
    /**
     * 更新最近项目
     */
    ipcMain.handle(IPC_CHANNELS.RECENT_UPDATE, async (_, projectPath, projectName) => {
        try {
            await preferencesService.updateRecentProjects(projectPath, projectName);
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to update recent projects:', message);
            return { success: false, error: message };
        }
    });
    /**
     * 从最近项目列表移除
     */
    ipcMain.handle(IPC_CHANNELS.RECENT_REMOVE, async (_, projectPath) => {
        try {
            await preferencesService.removeFromRecentProjects(projectPath);
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to remove from recent projects:', message);
            return { success: false, error: message };
        }
    });
    /**
     * 清空最近项目列表
     */
    ipcMain.handle(IPC_CHANNELS.RECENT_CLEAR, async () => {
        try {
            await preferencesService.clearRecentProjects();
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to clear recent projects:', message);
            return { success: false, error: message };
        }
    });
    // ========================================================================
    // 对话框处理器
    // ========================================================================
    /**
     * 打开文件选择对话框
     */
    ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILE, async () => {
        const result = await dialog.showOpenDialog({
            title: 'Open Project',
            filters: [
                { name: 'Puzzle Project', extensions: ['puzzle.json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile'],
        });
        return {
            canceled: result.canceled,
            filePath: result.filePaths[0],
            filePaths: result.filePaths,
        };
    });
    /**
     * 打开目录选择对话框
     */
    ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async () => {
        const result = await dialog.showOpenDialog({
            title: 'Select Directory',
            properties: ['openDirectory', 'createDirectory'],
        });
        return {
            canceled: result.canceled,
            filePath: result.filePaths[0],
            filePaths: result.filePaths,
        };
    });
    /**
     * 打开保存文件对话框
     */
    ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_FILE, async (_, defaultPath, defaultFileName) => {
        const result = await dialog.showSaveDialog({
            title: 'Export Project',
            defaultPath: defaultPath
                ? (defaultFileName ? `${defaultPath}/${defaultFileName}` : defaultPath)
                : defaultFileName,
            filters: [
                { name: 'JSON', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        return {
            canceled: result.canceled,
            filePath: result.filePath,
        };
    });
    // ========================================================================
    // 文件操作处理器
    // ========================================================================
    /**
     * 检查文件是否存在
     */
    ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_, filePath) => {
        return fileService.fileExists(filePath);
    });
    /**
     * 在资源管理器中显示文件
     */
    ipcMain.handle(IPC_CHANNELS.FILE_SHOW_IN_EXPLORER, async (_, filePath) => {
        shell.showItemInFolder(filePath);
    });
    console.log('IPC handlers registered successfully');
}

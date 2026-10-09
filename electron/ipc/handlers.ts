/**
 * IPC 处理器注册
 * 集中注册所有 IPC 事件处理器
 */

import { IpcMain, dialog, shell, type IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IPCResult, CreateProjectParams, CreateProjectResult, FileDialogResult, UserPreferences } from '../types.js';
import { preferencesService } from './preferencesService.js';
import { fileService } from './fileService.js';
import { fileWatcherService } from './watcherService.js';
import { desktopProjectOwnership } from './projectOwnershipService.js';

const ownershipSenders = new Set<number>();
function projectOwner(event: IpcMainInvokeEvent): number {
    if (event.senderFrame !== event.sender.mainFrame) throw new Error('Project operations require the main frame.');
    const id = event.sender.id;
    if (!ownershipSenders.has(id)) {
        ownershipSenders.add(id);
        event.sender.once('destroyed', () => { ownershipSenders.delete(id); void desktopProjectOwnership.release(id); });
    }
    return id;
}


/**
 * 注册所有 IPC 处理器
 * @param ipcMain Electron IpcMain 实例
 */
export function registerIpcHandlers(ipcMain: IpcMain): void {
    // ========================================================================
    // 偏好设置处理器
    // ========================================================================

    /**
     * 加载用户偏好设置
     */
    ipcMain.handle(IPC_CHANNELS.PREFERENCES_LOAD, async (): Promise<IPCResult<UserPreferences>> => {
        try {
            const preferences = await preferencesService.loadPreferences();
            return { success: true, data: preferences };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to load preferences:', message);
            return { success: false, error: message };
        }
    });

    /**
     * 保存用户偏好设置
     */
    ipcMain.handle(IPC_CHANNELS.PREFERENCES_SAVE, async (_, prefs): Promise<IPCResult> => {
        try {
            await preferencesService.savePreferences(prefs);
            return { success: true };
        } catch (error) {
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
    ipcMain.handle(IPC_CHANNELS.PROJECT_READ, async (_, filePath: string): Promise<IPCResult<string>> => {
        try {
            const content = await fileService.readFile(filePath);
            return { success: true, data: content };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to read project:', message);
            return { success: false, error: message };
        }
    });

    /**
     * 写入项目文件
     * 写入后记录内容指纹，监听仍可接收真实外部变化
     */
    ipcMain.handle(IPC_CHANNELS.PROJECT_WRITE, async (event, filePath: string, data: string, options?: { exclusive?: boolean; expectedHash?: string }): Promise<IPCResult> => {
        try {
            await desktopProjectOwnership.write(projectOwner(event), filePath, data, options);
            fileWatcherService.noteInternalWrite(filePath, data);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to write project:', message);
            return { success: false, error: message };
        }
    });

    // 候选所有权先取得再提交；读取文件本身不切换当前监听和偏好。
    ipcMain.handle(IPC_CHANNELS.PROJECT_CLAIM, async (event, filePath: string | null, expectedContent?: string, create?: boolean): Promise<IPCResult<string>> => {
        try {
            if ((filePath !== null && typeof filePath !== 'string') || (expectedContent !== undefined && typeof expectedContent !== 'string') || (create !== undefined && typeof create !== 'boolean')) throw new Error('Invalid project claim.');
            return { success: true, data: await desktopProjectOwnership.claim(projectOwner(event), filePath, expectedContent, create) };
        } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
    });
    ipcMain.handle(IPC_CHANNELS.PROJECT_RELEASE_CLAIM, async (event, token: string): Promise<IPCResult> => {
        try { await desktopProjectOwnership.abandon(projectOwner(event), token); return { success: true }; }
        catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
    });
    ipcMain.handle(IPC_CHANNELS.PROJECT_ACTIVATE, async (event, filePath: string | null, name: string, token?: string): Promise<IPCResult> => {
        try {
            if (!token) throw new Error('Project ownership claim is required.');
            await desktopProjectOwnership.activate(projectOwner(event), filePath, token);
        } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
        try {
            if (filePath) fileWatcherService.startWatching(filePath);
            else fileWatcherService.stopWatching();
            if (filePath) await preferencesService.updateRecentProjects(filePath, name);
            else {
                const prefs = await preferencesService.loadPreferences();
                await preferencesService.savePreferences({ ...prefs, lastProjectPath: null });
            }
            return { success: true };
        } catch (error) {
            // 所有权已转移；保留活动工程，调用方将偏好/监听故障作为警告报告。
            return { success: false, error: 'Project ownership was transferred, but session preferences or watching failed: ' + String(error) };
        }
    });

    /**
     * 导出项目文件
     */
    ipcMain.handle(IPC_CHANNELS.PROJECT_EXPORT, async (event, filePath: string, data: string): Promise<IPCResult> => {
        try {
            await desktopProjectOwnership.write(projectOwner(event), filePath, data, undefined, false);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to export project:', message);
            return { success: false, error: message };
        }
    });

    /**
     * 创建新项目
     */
    ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (event, params: CreateProjectParams): Promise<IPCResult<CreateProjectResult>> => {
        const owner = projectOwner(event);
        let claim: string | undefined;
        try {
            // 保留兼容入口，但同样先预留候选；不能通过旧创建路径绕过活动工程锁。
            const result = await fileService.createProject(params, async (path, content, options) => {
                claim = await desktopProjectOwnership.claim(owner, path, undefined, true);
                await desktopProjectOwnership.write(owner, path, content, options);
            });
            await desktopProjectOwnership.activate(owner, result.path, claim!);
            // 启动文件监听
            fileWatcherService.startWatching(result.path);
            return { success: true, data: result };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to create project:', message);
            return { success: false, error: message };
        } finally { if (claim) await desktopProjectOwnership.abandon(owner, claim); }
    });

    // ========================================================================
    // 最近项目管理处理器
    // ========================================================================

    /**
     * 更新最近项目
     */
    ipcMain.handle(IPC_CHANNELS.RECENT_UPDATE, async (_, projectPath: string, projectName: string): Promise<IPCResult> => {
        try {
            await preferencesService.updateRecentProjects(projectPath, projectName);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to update recent projects:', message);
            return { success: false, error: message };
        }
    });

    /**
     * 从最近项目列表移除
     */
    ipcMain.handle(IPC_CHANNELS.RECENT_REMOVE, async (_, projectPath: string): Promise<IPCResult> => {
        try {
            await preferencesService.removeFromRecentProjects(projectPath);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to remove from recent projects:', message);
            return { success: false, error: message };
        }
    });

    /**
     * 清空最近项目列表
     */
    ipcMain.handle(IPC_CHANNELS.RECENT_CLEAR, async (): Promise<IPCResult> => {
        try {
            await preferencesService.clearRecentProjects();
            return { success: true };
        } catch (error) {
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
    ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILE, async (): Promise<FileDialogResult> => {
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
    ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async (): Promise<FileDialogResult> => {
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
    ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_FILE, async (_, defaultPath?: string, defaultFileName?: string, kind: 'project' | 'export' = 'export'): Promise<FileDialogResult> => {
        const result = await dialog.showSaveDialog({
            title: kind === 'project' ? 'Save Project' : 'Export Project',
            defaultPath: defaultPath
                ? (defaultFileName ? `${defaultPath}/${defaultFileName}` : defaultPath)
                : defaultFileName,
            filters: [
                { name: kind === 'project' ? 'Puzzle Project' : 'Puzzle Export', extensions: kind === 'project' ? ['puzzle.json'] : ['json'] },
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
    ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_, filePath: string): Promise<boolean> => {
        return fileService.fileExists(filePath);
    });

    /**
     * 在资源管理器中显示文件
     */
    ipcMain.handle(IPC_CHANNELS.FILE_SHOW_IN_EXPLORER, async (_, filePath: string): Promise<void> => {
        shell.showItemInFolder(filePath);
    });

    console.log('IPC handlers registered successfully');
}

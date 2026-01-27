/**
 * 文件监听服务
 * 使用 chokidar 监听当前打开的项目文件
 * 当外部修改时通知渲染进程
 */
import chokidar from 'chokidar';
import { IPC_CHANNELS } from '../types.js';
class FileWatcherService {
    watcher = null;
    currentWatchedPath = null;
    mainWindow = null;
    debounceTimer = null;
    isPaused = false; // 暂停标识，防止前端保存时触发自身监听
    constructor() { }
    /**
     * 设置主窗口引用 (用于发送事件)
     */
    setMainWindow(window) {
        this.mainWindow = window;
    }
    /**
     * 开始监听指定文件
     * @param filePath 文件路径
     */
    startWatching(filePath) {
        // 如果路径相同且正在监听，无需重启
        if (this.currentWatchedPath === filePath && this.watcher) {
            return;
        }
        // 停止之前的监听
        this.stopWatching();
        this.currentWatchedPath = filePath;
        console.log(`[FileWatcher] Start watching: ${filePath}`);
        // 启动新监听
        // atomic: true 应对 Vim/Sublime 等"写时复制"保存行为
        // ignoreInitial: true 忽略启动时的 add 事件
        this.watcher = chokidar.watch(filePath, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 500, // 写入稳定后才触发
                pollInterval: 100
            },
            atomic: true
        });
        this.watcher
            .on('change', (path) => this.handleFileChange(path, 'change'))
            .on('unlink', (path) => this.handleFileChange(path, 'unlink'))
            .on('error', (error) => console.error(`[FileWatcher] Error: ${error}`));
    }
    /**
     * 停止监听
     */
    stopWatching() {
        if (this.watcher) {
            console.log(`[FileWatcher] Stop watching: ${this.currentWatchedPath}`);
            this.watcher.close();
            this.watcher = null;
            this.currentWatchedPath = null;
        }
    }
    /**
     * 暂停监听（前端保存时调用，防止触发自身）
     */
    pauseWatching() {
        this.isPaused = true;
        console.log('[FileWatcher] Paused (internal write)');
    }
    /**
     * 恢复监听
     */
    resumeWatching() {
        // 延迟恢复，确保文件写入完成后的事件被忽略
        setTimeout(() => {
            this.isPaused = false;
            console.log('[FileWatcher] Resumed');
        }, 600); // 略大于 awaitWriteFinish.stabilityThreshold (500ms)
    }
    /**
     * 处理文件变更 (带防抖)
     */
    handleFileChange(path, type) {
        // 如果处于暂停状态（前端自身写入），忽略此次变更
        if (this.isPaused) {
            console.log(`[FileWatcher] Ignored (paused): ${type} ${path}`);
            return;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            // 再次检查暂停状态（防抖期间可能被暂停）
            if (this.isPaused) {
                console.log(`[FileWatcher] Ignored after debounce (paused): ${type} ${path}`);
                return;
            }
            console.log(`[FileWatcher] External file ${type}: ${path}`);
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                const event = { path, type };
                this.mainWindow.webContents.send(IPC_CHANNELS.PROJECT_FILE_CHANGED, event);
            }
        }, 100); // 额外防抖 (虽然 awaitWriteFinish 已处理大部分)
    }
}
export const fileWatcherService = new FileWatcherService();

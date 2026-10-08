/**
 * 文件监听服务
 * 使用 chokidar 监听当前打开的项目文件
 * 当外部修改时通知渲染进程
 */

import chokidar, { FSWatcher } from 'chokidar';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS, FileChangedEvent } from '../types.js';

class FileWatcherService {
    private watcher: FSWatcher | null = null;
    private currentWatchedPath: string | null = null;
    private mainWindow: BrowserWindow | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private generation = 0;
    private ownWrites = new Map<string, string>();
    private key(path: string): string { return process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path); }
    private hash(content: string): string { return createHash('sha256').update(content).digest('hex'); }

    public noteInternalWrite(path: string, content: string) {
        this.ownWrites.set(this.key(path), this.hash(content));
        if (this.ownWrites.size > 20) this.ownWrites.delete(this.ownWrites.keys().next().value!);
    }

    constructor() { }

    /**
     * 设置主窗口引用 (用于发送事件)
     */
    public setMainWindow(window: BrowserWindow | null) {
        this.mainWindow = window;
    }

    /**
     * 开始监听指定文件
     * @param filePath 文件路径
     */
    public startWatching(filePath: string) {
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
    public stopWatching() {
        this.generation++;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        if (this.watcher) {
            console.log(`[FileWatcher] Stop watching: ${this.currentWatchedPath}`);
            this.watcher.close();
            this.watcher = null;
            this.currentWatchedPath = null;
        }
    }

    /** 内容指纹过滤自身回声，不设置忽略真实外部更新的时间窗口。 */
    private handleFileChange(path: string, type: 'change' | 'unlink') {
        if (!this.currentWatchedPath || this.key(path) !== this.key(this.currentWatchedPath)) return;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        const generation = this.generation;
        this.debounceTimer = setTimeout(async () => {
            if (generation !== this.generation) return;
            if (type === 'change') {
                try {
                    const content = await readFile(path, 'utf8');
                    if (generation !== this.generation) return;
                    if (this.ownWrites.get(this.key(path)) === this.hash(content)) return;
                    this.ownWrites.delete(this.key(path));
                } catch { /* 读取错误交给渲染进程统一报告。 */ }
            }
            if (generation !== this.generation) return;
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                // chokidar 在 Windows 可能改写斜杠；向渲染进程返回激活时的同一身份路径。
                const event: FileChangedEvent = { path: this.currentWatchedPath!, type };
                this.mainWindow.webContents.send(IPC_CHANNELS.PROJECT_FILE_CHANGED, event);
            }
        }, 100);
    }
}
export const fileWatcherService = new FileWatcherService();

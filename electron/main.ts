/**
 * Electron 主进程入口文件
 * 负责创建窗口、注册 IPC 处理器和应用生命周期管理
 */

import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc/handlers.js';

// ESM 模式下获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 开发环境判断
const isDev = !app.isPackaged;

// 主窗口实例
let mainWindow: BrowserWindow | null = null;

/**
 * 创建主窗口
 */
function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        // 窗口图标（左上角）
        icon: path.join(__dirname, '../public/icon.png'),
        webPreferences: {
            // 预加载脚本路径
            preload: path.join(__dirname, 'preload.js'),
            // 安全设置
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // 禁用沙盒以允许 preload 脚本正常工作
        },
        // 窗口样式
        frame: true,
        titleBarStyle: 'default',
        backgroundColor: '#474747ff',
        // 显示设置
        show: false,
    });

    // 窗口准备好后显示，避免白屏闪烁
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // 加载应用内容
    if (isDev) {
        // 开发模式：加载 Vite 开发服务器
        mainWindow.loadURL('http://localhost:3000');
        // 打开开发者工具
        mainWindow.webContents.openDevTools();
    } else {
        // 生产模式：加载打包后的文件
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // 窗口关闭处理
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * 应用初始化
 */
async function initialize(): Promise<void> {
    // 强制使用暗色主题，不受系统主题影响
    nativeTheme.themeSource = 'dark';

    // 隐藏默认菜单栏
    Menu.setApplicationMenu(null);

    // 注册 IPC 处理器
    registerIpcHandlers(ipcMain);

    // 创建主窗口
    createWindow();
}

// ============================================================================
// 应用生命周期事件
// ============================================================================

// 应用准备就绪
app.whenReady().then(() => {
    initialize();

    // macOS: 点击 dock 图标时重新创建窗口
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭时退出应用 (Windows/Linux)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 应用即将退出时的清理
app.on('before-quit', () => {
    // 可在此处保存应用状态
    console.log('Application is closing...');
});

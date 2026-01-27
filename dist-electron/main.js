/**
 * Electron 主进程入口文件
 * 负责创建窗口、注册 IPC 处理器和应用生命周期管理
 */
import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc/handlers.js';
import { fileWatcherService } from './ipc/watcherService.js';
// ESM 模式下获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 禁用 Autofill 相关功能，防止 DevTools 报错
// 错误原因：Electron 缺少 Chrome 的 Autofill 组件，但 DevTools 尝试调用
app.commandLine.appendSwitch('disable-features', 'Autofill,AutofillServerCommunication');
// 开发环境判断
const isDev = !app.isPackaged;
// 主窗口实例
let mainWindow = null;
/**
 * 创建主窗口
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        // 窗口图标（左上角）
        icon: path.join(__dirname, '../public/icon.png'),
        webPreferences: {
            // 预加载脚本路径
            preload: path.join(__dirname, 'preload.mjs'),
            // 安全设置
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // 禁用沙盒以确保 preload 脚本正确加载
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
    // 屏蔽 DevTools Autofill 协议警告（不影响功能，仅减少噪音）
    mainWindow.webContents.on('console-message', (_, __, message) => {
        if (message.includes('Autofill.enable') || message.includes('Autofill.setAddresses')) {
            return;
        }
    });
    // 加载应用内容
    if (isDev) {
        // 开发模式：加载 Vite 开发服务器
        mainWindow.loadURL('http://localhost:3000');
        // 打开开发者工具
        mainWindow.webContents.openDevTools();
    }
    else {
        // 生产模式：加载打包后的文件
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    // 窗口关闭处理
    mainWindow.on('closed', () => {
        mainWindow = null;
        fileWatcherService.setMainWindow(null); // 清理引用
    });
    // 注入窗口实例到文件监听服务
    fileWatcherService.setMainWindow(mainWindow);
}
/**
 * 应用初始化
 */
async function initialize() {
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

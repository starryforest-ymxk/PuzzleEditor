import { app, dialog, ipcMain, } from 'electron';
import { randomUUID } from 'node:crypto';
import { IPC_CHANNELS } from './types.js';
/** 单主窗口的退出握手；主进程只认当前请求，不复制渲染器的项目/dirty 状态。 */
export function registerWindowCloseGuard(window) {
    const contents = window.webContents;
    let ready = false;
    let wasReady = false;
    let approved = false;
    let quitting = false;
    let pending = null;
    let fallbackOpen = false;
    const owns = (event) => !window.isDestroyed() &&
        event.sender === window.webContents &&
        event.senderFrame === window.webContents.mainFrame;
    const cancel = () => {
        pending = null;
        quitting = false;
    };
    const finish = () => {
        approved = true;
        if (quitting)
            app.quit();
        else
            window.close();
    };
    const request = () => {
        if (pending || fallbackOpen)
            return;
        if (ready) {
            pending = randomUUID();
            window.webContents.send(IPC_CHANNELS.WINDOW_CLOSE_REQUESTED, pending);
            return;
        }
        // 编辑器失效后也不能默默丢弃；没有渲染器时无法执行项目保存。
        fallbackOpen = true;
        void dialog
            .showMessageBox(window, {
            type: 'warning',
            title: 'Editor unavailable',
            message: 'The editor cannot confirm that your project is saved.',
            detail: 'Cancel to keep the window open, or close without saving.',
            buttons: ['Cancel', 'Close Without Saving'],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
        })
            .then(({ response }) => {
            if (window.isDestroyed())
                return;
            if (response === 1)
                finish();
            else
                cancel();
        })
            .catch(cancel)
            .finally(() => {
            fallbackOpen = false;
        });
    };
    const onClose = (event) => {
        // 尚未挂载编辑器的启动窗口没有可编辑内容；后续全部走会话确认。
        if (approved || !wasReady)
            return;
        event.preventDefault();
        request();
    };
    const onQuit = (event) => {
        if (approved || !wasReady)
            return;
        event.preventDefault();
        quitting = true;
        request();
    };
    const onReady = (event, value) => {
        if (!owns(event) || typeof value !== 'boolean')
            return;
        ready = value;
        if (ready)
            wasReady = true;
        else
            cancel();
    };
    const onGone = () => {
        ready = false;
        cancel();
    };
    ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE_READY, onReady);
    ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE_RESOLVE, (event, requestId, allow) => {
        if (!owns(event) || !pending || requestId !== pending || typeof allow !== 'boolean')
            return false;
        pending = null;
        if (allow) {
            // 先回传握手结果，再继续原生关闭；禁止超时自动批准。
            approved = true;
            setImmediate(() => {
                if (!window.isDestroyed())
                    finish();
            });
        }
        else
            quitting = false;
        return true;
    });
    window.on('close', onClose);
    app.on('before-quit', onQuit);
    window.webContents.on('render-process-gone', onGone);
    window.once('closed', () => {
        app.removeListener('before-quit', onQuit);
        ipcMain.removeListener(IPC_CHANNELS.WINDOW_CLOSE_READY, onReady);
        ipcMain.removeHandler(IPC_CHANNELS.WINDOW_CLOSE_RESOLVE);
        contents.removeListener('render-process-gone', onGone);
    });
}

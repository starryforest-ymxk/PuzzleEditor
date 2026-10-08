import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'vite';

// 全部项目、偏好及 Chromium 数据都隔离到新建临时目录，保留验收产物便于复查。
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const directory = await mkdtemp(join(tmpdir(), 'puzzle-batch2-electron-'));
const userData = join(directory, 'appdata', 'app');
const documents = join(directory, 'documents');
await mkdir(userData, { recursive: true });
await mkdir(documents, { recursive: true });
const projectDirectory = join(directory, 'projects');
await mkdir(projectDirectory);
await build({ configFile: false, logLevel: 'error', resolve: { alias: { '@': root } }, build: {
    outDir: directory, emptyOutDir: false, minify: false,
    lib: { entry: resolve(root, 'tests/electron/sessionSmoke.renderer.ts'), name: 'SessionSmoke', formats: ['iife'], fileName: () => 'renderer.js' }
} });
await writeFile(join(directory, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Isolated IPC verification</title><script src="renderer.js"></script>', 'utf8');
await writeFile(join(directory, 'preload.mjs'), `
import ${JSON.stringify(pathToFileURL(resolve(root, 'dist-electron/preload.mjs')).href)};
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('smokeHarness', {
    directory: ${JSON.stringify(projectDirectory.replaceAll('\\', '/'))},
    report: result => ipcRenderer.send('smoke:result', result),
    writeExternal: (path, content) => ipcRenderer.invoke('smoke:external-write', path, content)
});
`, 'utf8');
await writeFile(join(directory, 'main.mjs'), `
import { app, BrowserWindow, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { registerIpcHandlers } from ${JSON.stringify(pathToFileURL(resolve(root, 'dist-electron/ipc/handlers.js')).href)};
import { fileWatcherService } from ${JSON.stringify(pathToFileURL(resolve(root, 'dist-electron/ipc/watcherService.js')).href)};
app.setPath('userData', ${JSON.stringify(userData)});
app.setPath('documents', ${JSON.stringify(documents)});
app.whenReady().then(async () => {
registerIpcHandlers(ipcMain);
ipcMain.handle('smoke:external-write', async (_, path, content) => {
    const target = resolve(path);
    if (!target.startsWith(resolve(${JSON.stringify(projectDirectory)}) + sep)) throw new Error('Test path outside isolated projects directory');
    await writeFile(target, content, 'utf8');
});
const window = new BrowserWindow({ show: false, webPreferences: {
    preload: ${JSON.stringify(join(directory, 'preload.mjs'))}, contextIsolation: true, nodeIntegration: false, sandbox: false
} });
fileWatcherService.setMainWindow(window);
const timeout = setTimeout(() => { console.error('Electron IPC verification timed out'); app.exit(1); }, 30000);
ipcMain.once('smoke:result', async (_, result) => {
    clearTimeout(timeout);
    await writeFile(${JSON.stringify(join(directory, 'result.json'))}, JSON.stringify(result, null, 2), 'utf8');
    console.log('ELECTRON_SMOKE_RESULT ' + JSON.stringify(result));
    fileWatcherService.stopWatching();
    window.destroy();
    app.exit(result.success ? 0 : 1);
});
await window.loadFile(${JSON.stringify(join(directory, 'index.html'))});
}).catch(error => { console.error(error); app.exit(1); });
`, 'utf8');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [join(directory, 'main.mjs')], { env, stdio: 'inherit', windowsHide: true });
console.log('Isolated Electron evidence directory: ' + directory);
const deadline = setTimeout(() => { console.error('Electron process exceeded verification timeout'); child.kill(); }, 45000);
child.on('error', error => { clearTimeout(deadline); console.error(error); process.exitCode = 1; });
child.on('exit', code => { clearTimeout(deadline); process.exitCode = code ?? 1; });

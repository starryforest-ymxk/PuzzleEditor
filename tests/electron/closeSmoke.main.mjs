import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir, rename, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { registerIpcHandlers } from '../../dist-electron/ipc/handlers.js';
import { fileWatcherService } from '../../dist-electron/ipc/watcherService.js';
import { registerWindowCloseGuard } from '../../dist-electron/windowCloseGuard.js';
import { registerSessionBridge } from '../../dist-electron/sessionBridge.js';

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { scenario, root, isolated, userData, documents, projectPath, savePath, rootId } = config;
process.env.PUZZLE_EDITOR_SESSION_DIR = join(isolated, 'sessions');
app.setPath('userData', userData);
app.setPath('documents', documents);
const checks = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(message);
};
let window;
let expectedClose = scenario === 'manual';
let quitCount = 0;
let lastRequest;
let requestCount = 0;
let failed = false;
app.on('before-quit', () => {
  quitCount++;
});
const result = (success, error) => {
  writeFileSync(
    join(isolated, 'result.json'),
    JSON.stringify({ scenario, success, checks, error }, null, 2),
    'utf8',
  );
};
const fail = (error) => {
  if (failed) return;
  failed = true;
  result(false, String(error?.stack || error));
  console.error(error);
  app.exit(1);
};
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
const evaluate = (expression) => window.webContents.executeJavaScript(expression);
async function until(check, message) {
  const deadline = Date.now() + 7000;
  while (!(await check())) {
    if (Date.now() >= deadline) throw new Error(message);
    await delay(30);
  }
}
const confirming = () =>
  evaluate(`Boolean(document.querySelector('[role="dialog"][aria-label="Unsaved Changes"]'))`);
const waitConfirm = () => until(confirming, 'Missing close confirmation');
async function clickButton(text) {
  assert(
    await evaluate(
      `(() => { const button = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) return false; button.click(); return true; })()`,
    ),
    `Clicked ${text}`,
  );
}
async function changeName() {
  // DOM 输入不失焦，覆盖原生关闭不会主动提交 React 草稿的情况。
  assert(
    await evaluate(
      `(() => { const field = Array.from(document.querySelectorAll('input')).find(e => e.value === 'Close Test Root'); if (!field) return false; field.focus(); field.select(); return true; })()`,
    ),
    'Focused Inspector draft',
  );
  await window.webContents.insertText('Latest Close Edit');
  await delay(50);
}

app
  .whenReady()
  .then(async () => {
    Menu.setApplicationMenu(null);
    registerIpcHandlers(ipcMain);
    // 文件选择结果可重复控制；其余 preload、保存 IPC 与磁盘写入均为生产实现。
    let saveDialogCount = 0;
    if (scenario === 'save-as')
      dialog.showSaveDialog = async () =>
        ++saveDialogCount === 1 ? { canceled: true } : { canceled: false, filePath: savePath };
    const preload = join(isolated, 'preload.mjs');
    await writeFile(
      preload,
      `import ${JSON.stringify(pathToFileURL(join(root, 'dist-electron/preload.mjs')).href)};\nimport { ipcRenderer } from 'electron';\nipcRenderer.on('window:close-requested', (_, id) => ipcRenderer.send('close-smoke:requested', id));`,
      'utf8',
    );
    window = new BrowserWindow({
      title: 'Puzzle Close Verification',
      show: scenario === 'manual',
      width: 1400,
      height: 900,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
      },
    });
    window.on('page-title-updated', (event) => event.preventDefault());
    registerWindowCloseGuard(window);
    registerSessionBridge(window, pathToFileURL(join(root, 'dist/index.html')).href);
    fileWatcherService.setMainWindow(window);
    ipcMain.on('close-smoke:requested', (event, id) => {
      if (event.sender === window.webContents) {
        lastRequest = id;
        requestCount++;
      }
    });
    window.on('closed', () => {
      if (failed) return;
      try {
        assert(expectedClose, 'Window closed only after explicit approval or a clean session');
        if (['save', 'failed-save', 'save-as', 'quit'].includes(scenario)) {
          const saved = JSON.parse(readFileSync(savePath, 'utf8'));
          assert(
            saved.project.stageTree.stages[rootId].name === 'Latest Close Edit',
            'Latest input was on disk before the window closed',
          );
        }
        if (scenario === 'discard')
          assert(
            JSON.parse(readFileSync(projectPath, 'utf8')).project.stageTree.stages[rootId].name ===
              'Close Test Root',
            'Discard left the saved file unchanged',
          );
        if (scenario === 'save')
          assert(quitCount === 1, 'Cancelled quit did not turn a later window close into app.quit');
        result(true);
        fileWatcherService.stopWatching();
        console.log(`CLOSE_SMOKE ${scenario}: passed (${checks.length} checks)`);
        if (scenario !== 'quit') app.exit(0);
      } catch (error) {
        fail(error);
      }
    });
    await window.loadFile(join(root, 'dist/index.html'));
    if (scenario === 'empty') {
      await until(
        () => evaluate(`Boolean(document.querySelector('.app-header'))`),
        'Empty editor did not mount',
      );
      await delay(100);
      expectedClose = true;
      window.close();
      return;
    }
    const stageSelector = `[data-stage-id="${rootId}"]`;
    await until(
      () => evaluate(`Boolean(document.querySelector(${JSON.stringify(stageSelector)}))`),
      'Project did not restore',
    );
    await evaluate(`document.querySelector(${JSON.stringify(stageSelector)}).click()`);
    await until(
      () =>
        evaluate(
          `Array.from(document.querySelectorAll('input')).some(e => e.value === 'Close Test Root')`,
        ),
      'Inspector did not open',
    );
    if (scenario === 'manual') {
      window.show();
      console.log('Manual test window ready: ' + isolated);
      return;
    }
    if (scenario === 'clean') {
      expectedClose = true;
      window.close();
      return;
    }
    await changeName();
    if (scenario === 'save') {
      app.quit();
      await waitConfirm();
      const cancelledRequest = lastRequest;
      await clickButton('Cancel');
      await until(async () => !(await confirming()), 'Cancel did not dismiss dialog');
      assert(!window.isDestroyed(), 'Cancel kept the window alive');
      window.close();
      window.close();
      window.close();
      await waitConfirm();
      assert(requestCount === 2, 'Repeated close requests share one confirmation');
      assert(
        (await evaluate(
          `window.electronAPI.resolveWindowClose(${JSON.stringify(cancelledRequest)}, true)`,
        )) === false,
        'Stale approval rejected',
      );
      const other = new BrowserWindow({
        show: false,
        webPreferences: { preload, contextIsolation: true, sandbox: false },
      });
      const otherPage = join(isolated, 'other.html');
      await writeFile(
        otherPage,
        '<!doctype html><title>Other test window</title><p>Unrelated renderer</p>',
        'utf8',
      );
      await other.loadFile(otherPage);
      await until(
        () => other.webContents.executeJavaScript('Boolean(window.electronAPI)'),
        'Other preload did not initialize',
      );
      assert(
        (await other.webContents.executeJavaScript(
          `window.electronAPI.resolveWindowClose(${JSON.stringify(lastRequest)}, true)`,
        )) === false,
        'Approval from another window rejected',
      );
      other.destroy();
    } else if (scenario === 'quit') {
      app.quit();
      await waitConfirm();
    } else {
      window.close();
      await waitConfirm();
    }
    // DOM 确认出现后再等待合成帧，避免隐藏窗口截图仍是旧画面。
    await evaluate(
      'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    );
    await delay(100);
    const capture = await window.webContents.capturePage();
    await writeFile(join(isolated, 'confirmation.png'), capture.toPNG());
    await writeFile(
      join(isolated, 'confirmation.txt'),
      await evaluate('document.querySelector("[role=dialog]").textContent'),
      'utf8',
    );
    if (scenario === 'discard') {
      expectedClose = true;
      await clickButton('Discard & Close');
      return;
    }
    if (scenario === 'failed-save') {
      fileWatcherService.stopWatching();
      await rename(projectPath, projectPath + '.original');
      await mkdir(projectPath);
      await clickButton('Save & Close');
      await until(
        () =>
          evaluate(
            `document.querySelector('[role="alert"]')?.textContent.includes('Failed to save project')`,
          ),
        'Save failure was not shown',
      );
      assert(!window.isDestroyed(), 'Failed write kept the window alive');
      // 仅移除本测试刚创建的空目录，然后恢复隔离测试文件。
      await rmdir(projectPath);
      await rename(projectPath + '.original', projectPath);
    }
    if (scenario === 'save-as') {
      await clickButton('Save & Close');
      await until(
        () =>
          evaluate(
            `document.querySelector('[role="alert"]')?.textContent.includes('Save was cancelled')`,
          ),
        'Cancelled picker was not shown',
      );
      assert(!window.isDestroyed(), 'Cancelled save picker kept the window alive');
    }
    expectedClose = true;
    await clickButton('Save & Close');
  })
  .catch(fail);

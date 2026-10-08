import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// 直接启动打包后的程序；在应用入口执行前隔离所有持久化路径，不改动 ASAR。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const executable = resolve(process.argv[2] ?? 'release/2026-10-08/win-unpacked/Puzzle Editor.exe');
const directory = await mkdtemp(join(tmpdir(), 'puzzle-packaged-release-'));
const userData = join(directory, 'appdata', 'app');
const documents = join(directory, 'documents');
const prefsDirectory = join(directory, 'appdata', 'StarryTree', 'PuzzleEditor');
await Promise.all(
  [userData, documents, prefsDirectory].map((path) => mkdir(path, { recursive: true })),
);
const projectPath = join(directory, 'release-verification.puzzle.json');
const fixture = JSON.parse(
  await readFile(join(root, 'overview/dev/verification/batch6-browser-saved.puzzle.json'), 'utf8'),
);
const rootId = fixture.project.stageTree.rootId;
fixture.project.meta.name = 'Packaged Release Verification';
fixture.project.stageTree.stages[rootId].name = 'Release Test Root';
fixture.editorState = {
  currentStageId: rootId,
  currentNodeId: null,
  currentGraphId: null,
  view: 'EDITOR',
};
await writeFile(projectPath, JSON.stringify(fixture), 'utf8');
await writeFile(
  join(prefsDirectory, 'preferences.json'),
  JSON.stringify({
    projectsDirectory: directory,
    exportDirectory: directory,
    restoreLastProject: true,
    lastProjectPath: projectPath,
    recentProjects: [],
    autoSave: { enabled: false, intervalMinutes: 1 },
    translation: { provider: 'local', autoTranslate: false },
  }),
  'utf8',
);

const checks = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(message);
};
async function until(check, message) {
  const deadline = Date.now() + 15000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(message);
    await delay(50);
  }
}
async function availablePort() {
  const server = createServer();
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

// Node Inspector 仅用于隔离路径和驱动真实 BrowserWindow/DOM，应用代码保持生产实现。
async function connect(url) {
  const socket = new globalThis.WebSocket(url);
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  let pause;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Debugger.paused') pause = message.params;
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.done(message.result);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Inspector closed'));
    }
    pending.clear();
  });
  const send = (method, params = {}) =>
    new Promise((done, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Inspector timeout: ${method}`));
      }, 15000);
      pending.set(id, { done, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  return { send, evaluate, paused: () => pause, close: () => socket.close() };
}

const processes = [];
const connections = [];
const log = [];
const metadata = [];
async function launch() {
  const port = await availablePort();
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, [`--inspect-brk=127.0.0.1:${port}`], {
    cwd: dirname(executable),
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processes.push(child);
  let exit;
  let spawnError;
  child.on('error', (error) => {
    spawnError = error;
  });
  child.on('exit', (code, signal) => {
    exit = { code, signal };
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (data) => log.push(data.toString()));
  let target;
  await until(async () => {
    if (spawnError) throw spawnError;
    if (exit) throw new Error(`Packaged app exited before inspection: ${JSON.stringify(exit)}`);
    try {
      target = (await (await globalThis.fetch(`http://127.0.0.1:${port}/json/list`)).json())[0];
    } catch {
      return false;
    }
    return Boolean(target?.webSocketDebuggerUrl);
  }, 'Packaged inspector did not start');
  const inspector = await connect(target.webSocketDebuggerUrl);
  connections.push(inspector);
  await inspector.send('Debugger.enable');
  await inspector.send('Runtime.runIfWaitingForDebugger');
  await until(() => inspector.paused(), 'App did not pause before startup');
  const isolated = await inspector.send('Debugger.evaluateOnCallFrame', {
    callFrameId: inspector.paused().callFrames[0].callFrameId,
    expression: `(() => {
      const electron = process.getBuiltinModule('module').createRequire(process.execPath)('electron');
      if (electron.app.isReady()) throw new Error('Too late to isolate user data');
      electron.app.setPath('userData', ${JSON.stringify(userData)});
      electron.app.setPath('sessionData', ${JSON.stringify(userData)});
      electron.app.setPath('documents', ${JSON.stringify(documents)});
      globalThis.__releaseElectron = electron;
      return { packaged: electron.app.isPackaged, version: electron.app.getVersion(), appPath: electron.app.getAppPath(), userData: electron.app.getPath('userData') };
    })()`,
    returnByValue: true,
  });
  if (isolated.exceptionDetails) throw new Error(JSON.stringify(isolated.exceptionDetails));
  metadata.push(isolated.result.value);
  assert(
    isolated.result.value.packaged && isolated.result.value.appPath.endsWith('app.asar'),
    'Actual packaged ASAR application launched',
  );
  assert(isolated.result.value.userData === userData, 'User data was isolated before startup');
  await inspector.send('Debugger.resume');
  await until(
    () =>
      inspector.evaluate(
        'Boolean(globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0]?.webContents.getURL().includes("app.asar/dist/index.html"))',
      ),
    'Production page did not load',
  );
  const evaluate = (expression) =>
    inspector.evaluate(
      `globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(${JSON.stringify(expression)})`,
    );
  await until(
    () => evaluate(`Boolean(document.querySelector('[data-stage-id="${rootId}"]'))`),
    'Fixture did not restore',
  );
  await evaluate(`document.querySelector('[data-stage-id="${rootId}"]').click()`);
  assert(
    await evaluate(
      'Boolean(window.electronAPI?.writeProject && window.electronAPI?.onWindowCloseRequested)',
    ),
    'Packaged preload and close API available',
  );
  const prefs = await evaluate('window.electronAPI.loadPreferences()');
  assert(
    prefs.success && prefs.data.lastProjectPath === projectPath,
    'Packaged preferences IPC restored the isolated fixture',
  );
  await inspector.evaluate(
    `globalThis.__releaseConsoleErrors = []; globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].webContents.on('console-message', (_, level, message) => { if (level >= 2) globalThis.__releaseConsoleErrors.push(message); });`,
  );
  return { child, inspector, evaluate, exit: () => exit };
}

let success = false;
let error;
let consoleErrors = [];
try {
  const first = await launch();
  const { inspector, evaluate } = first;
  await until(
    () =>
      evaluate(
        `Array.from(document.querySelectorAll('input')).some(e => e.value === 'Release Test Root')`,
      ),
    'Inspector field missing',
  );
  assert(
    await evaluate(
      `(() => { const input = Array.from(document.querySelectorAll('input')).find(e => e.value === 'Release Test Root'); input.focus(); input.select(); return document.activeElement === input; })()`,
    ),
    'Focused Inspector input',
  );
  await inspector.evaluate(
    `globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].webContents.insertText('Release Saved Edit')`,
  );
  await until(
    () => evaluate(`document.activeElement?.value === 'Release Saved Edit'`),
    'Input edit failed',
  );
  await inspector.evaluate('globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].close()');
  const confirming = () =>
    evaluate(`Boolean(document.querySelector('[role="dialog"][aria-label="Unsaved Changes"]'))`);
  await until(confirming, 'Packaged close confirmation missing');
  assert(
    await evaluate(
      `['Save & Close', 'Discard & Close', 'Cancel'].every(text => Array.from(document.querySelectorAll('[role="dialog"] button')).some(b => b.textContent.trim() === text))`,
    ),
    'Unified close dialog displayed all three choices',
  );
  const image = await inspector.evaluate(
    'globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image => image.toPNG().toString("base64"))',
  );
  await writeFile(join(directory, 'close-confirmation.png'), Buffer.from(image, 'base64'));
  await evaluate(
    `Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.textContent.trim() === 'Cancel').click()`,
  );
  await until(async () => !(await confirming()), 'Cancel did not dismiss confirmation');
  assert(!first.exit(), 'Cancel kept the actual packaged process alive');
  assert(
    JSON.parse(await readFile(projectPath, 'utf8')).project.stageTree.stages[rootId].name ===
      'Release Test Root',
    'Cancel left the saved project unchanged',
  );
  await inspector.evaluate('globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].close()');
  await until(confirming, 'Second close did not confirm');
  consoleErrors = await inspector.evaluate('globalThis.__releaseConsoleErrors');
  await evaluate(
    `Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.textContent.trim() === 'Save & Close').click()`,
  );
  // 关闭会销毁 Inspector 连接，先断开后等待进程自然退出，避免调试器阻止退出。
  inspector.close();
  await until(() => first.exit(), 'Saved app did not exit');
  assert(first.exit().code === 0, 'Save & Close exited successfully');
  assert(
    JSON.parse(await readFile(projectPath, 'utf8')).project.stageTree.stages[rootId].name ===
      'Release Saved Edit',
    'Latest Inspector draft persisted before process exit',
  );
  const second = await launch();
  await until(
    () =>
      second.evaluate(
        `Array.from(document.querySelectorAll('input')).some(e => e.value === 'Release Saved Edit')`,
      ),
    'Saved edit did not restore',
  );
  assert(true, 'Restart restored the saved edit');
  consoleErrors.push(...(await second.inspector.evaluate('globalThis.__releaseConsoleErrors')));
  await second.inspector.evaluate(
    'globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].close()',
  );
  second.inspector.close();
  await until(() => second.exit(), 'Clean project did not close');
  assert(second.exit().code === 0, 'Clean packaged project closed without confirmation');
  assert(
    consoleErrors.length === 0,
    'No renderer warnings or errors observed during the exercised interactions',
  );
  success = true;
} catch (caught) {
  error = String(caught.stack ?? caught);
  process.exitCode = 1;
} finally {
  for (const connection of connections) connection.close();
  for (const child of processes) if (child.exitCode === null && !child.killed) child.kill();
  await writeFile(join(directory, 'process.log'), log.join(''), 'utf8');
  const result = { success, executable, directory, metadata, checks, consoleErrors, error };
  await writeFile(join(directory, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

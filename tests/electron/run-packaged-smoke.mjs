import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { ProjectLease } from '../../dist-node/projectOwnership.js';

// 直接启动打包后的程序；在应用入口执行前隔离所有持久化路径，不改动 ASAR。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const executable = resolve(process.argv[2] ?? 'release/2026-10-08/win-unpacked/Puzzle Editor.exe');
const checkOwnership = process.argv.includes('--ownership');
const cliZipIndex = process.argv.indexOf('--cli-zip');
const cliZip = cliZipIndex >= 0 ? resolve(process.argv[cliZipIndex + 1]) : null;
const directory = await mkdtemp(join(tmpdir(), 'puzzle-packaged-release-'));
const discovery = join(directory, 'sessions');
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
const system = process.env.SystemRoot ?? 'C:\\Windows';
let launcher;
const cliEnv = {
  ...process.env,
  PATH: join(system, 'System32'),
  APPDATA: join(directory, 'cli-prefs'),
  LOCALAPPDATA: join(directory, 'cli-prefs'),
  PUZZLE_EDITOR_SESSION_DIR: discovery,
};
delete cliEnv.NODE_OPTIONS;
delete cliEnv.NODE_PATH;
if (cliZip) {
  const unpack = join(directory, '中文 配套验收');
  const result = spawnSync(
    join(system, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:C10_CLI_ZIP -DestinationPath $env:C10_CLI_UNPACK",
    ],
    {
      windowsHide: true,
      encoding: 'utf8',
      env: { ...process.env, C10_CLI_ZIP: cliZip, C10_CLI_UNPACK: unpack },
    },
  );
  assert(
    result.status === 0,
    'Paired CLI ZIP extracted outside repository into a Chinese space path',
  );
  launcher = join(unpack, (await readdir(unpack))[0], 'puzzle.cmd');
  assert(
    spawnSync(join(system, 'System32/where.exe'), ['node'], {
      env: cliEnv,
      cwd: directory,
      windowsHide: true,
    }).status !== 0,
    'Paired CLI environment has no global Node',
  );
}
async function cli(args, code = 0) {
  if (!launcher || [launcher, ...args].some((value) => /["%!\r\n]/.test(value)))
    throw new Error('Invalid test launcher arguments');
  const command = `""${launcher}" ${args.map((value) => `"${value}"`).join(' ')}"`;
  const result = spawnSync(join(system, 'System32/cmd.exe'), ['/d', '/s', '/c', command], {
    cwd: directory,
    env: cliEnv,
    windowsHide: true,
    windowsVerbatimArguments: true,
    encoding: 'utf8',
    timeout: 35000,
  });
  if (result.status !== code || result.stderr)
    throw new Error('Paired CLI failed: ' + result.stderr + ' ' + result.stdout);
  return JSON.parse(result.stdout);
}
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
  const env = { ...process.env, PUZZLE_EDITOR_SESSION_DIR: discovery };
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
async function verifyOwnership(held) {
  if (!checkOwnership) return;
  let occupied = false;
  try {
    const lease = await ProjectLease.acquire(projectPath, 'packaged-cli-probe');
    await lease.release();
  } catch (error) {
    if (error.code !== 'PROJECT_OWNED') throw error;
    occupied = true;
  }
  assert(
    occupied === held,
    held
      ? 'Packaged C8 desktop blocks external project owner'
      : 'Packaged C8 desktop releases ownership after exit',
  );
}
async function verifyOnline(desktop) {
  if (!cliZip) return 'Release Test Root';
  const capability = (await cli(['describe'])).data;
  assert(
    capability.phase === 'C10' &&
      capability.capabilities.some((x) => x.operation === 'history redo'),
    'Actual ZIP exposes C10 history capabilities',
  );
  let session;
  await until(async () => {
    const rows = (await cli(['session', 'list'])).data.sessions;
    session = rows.find((x) => x.status === 'available' && x.data.path === projectPath)?.data;
    return Boolean(session?.loaded);
  }, 'Packaged live session unavailable');
  assert(true, 'Actual desktop ASAR authenticates with the paired protocol 2 CLI');
  const target = [
    '--instance',
    session.token.instanceId,
    '--session',
    String(session.token.sessionId),
  ];
  const tokenPath = join(directory, 'online-token.json'),
    planPath = join(directory, 'online-plan.json'),
    receiptPath = join(directory, 'online-receipt.json');
  const rid = () => `${Date.now()}:${randomUUID()}`;
  await desktop.evaluate(
    `(()=>{const input=document.querySelector('textarea');input.focus();input.select();})()`,
  );
  await desktop.inspector.evaluate(
    `globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].webContents.insertText('Human unsaved before CLI')`,
  );
  await desktop.evaluate(`document.activeElement.blur()`);
  const status = (await cli(['session', 'status', ...target])).data;
  assert(status.dirty, 'Actual UI has unsaved human content before Agent editing');
  await writeFile(tokenPath, JSON.stringify(status.token));
  await writeFile(
    planPath,
    JSON.stringify({
      apiVersion: '1.0.0',
      sourceHash: status.token.contentHash,
      scope: { project: true },
      commands: [
        { op: 'stage.update', target: { id: rootId }, changes: { name: 'Paired Online Root' } },
      ],
    }),
  );
  await cli([
    'session',
    'preview',
    ...target,
    '--token',
    tokenPath,
    '--plan',
    planPath,
    '--receipt-out',
    receiptPath,
  ]);
  await cli([
    'session',
    'apply',
    ...target,
    '--plan',
    planPath,
    '--receipt',
    receiptPath,
    '--request-id',
    rid(),
  ]);
  const visible = (name) =>
    desktop.evaluate(
      `Array.from(document.querySelectorAll('input')).some(e=>e.value===${JSON.stringify(name)})`,
    );
  await until(() => visible('Paired Online Root'), 'Packaged Inspector did not reflect CLI edit');
  assert(true, 'Packaged CLI edit updates the actual Inspector');
  await desktop.inspector.evaluate(
    `(()=>{const w=globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0];w.webContents.sendInputEvent({type:'keyDown',keyCode:'z',modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:'z',modifiers:['control']});})()`,
  );
  await until(() => visible('Release Test Root'), 'Packaged GUI Undo did not restore root');
  const history = (await cli(['history', 'list', ...target])).data;
  assert(
    history.history.future[0]?.source === 'agent' && history.history.past[0]?.source === 'human',
    'Packaged GUI and CLI share mixed human and Agent history',
  );
  await writeFile(tokenPath, JSON.stringify(history.token));
  const redo = [
    'history',
    'redo',
    ...target,
    '--token',
    tokenPath,
    '--entry-id',
    history.history.redoEntryId,
    '--request-id',
    rid(),
  ];
  const restored = await cli(redo);
  assert(
    (await cli(redo)).data.token.contentEpoch === restored.data.token.contentEpoch,
    'Paired CLI history retry is idempotent',
  );
  await until(() => visible('Paired Online Root'), 'Packaged CLI Redo did not restore root');
  assert(
    restored.data.savePolicy.autoSaveBlocked,
    'Paired history restores content with automatic overwrite blocked',
  );
  await writeFile(tokenPath, JSON.stringify(restored.data.token));
  const save = ['session', 'save', ...target, '--token', tokenPath];
  assert(
    (await cli([...save, '--request-id', rid()], 6)).error.code ===
      'OVERWRITE_AUTHORIZATION_REQUIRED',
    'Paired save without chat declaration is denied',
  );
  const diskHash = createHash('sha256')
    .update(await readFile(projectPath))
    .digest('hex');
  const saved = await cli([
    ...save,
    '--request-id',
    rid(),
    '--allow-overwrite',
    '--expected-disk-hash',
    diskHash,
  ]);
  assert(!saved.data.dirty, 'Paired authorized save acknowledges current content');
  const onDisk = JSON.parse(await readFile(projectPath, 'utf8')).project.stageTree.stages[rootId];
  assert(
    onDisk.name === 'Paired Online Root' && onDisk.description === 'Human unsaved before CLI',
    'Paired save retains both human and Agent changes',
  );
  const png = await desktop.inspector.evaluate(
    'globalThis.__releaseElectron.BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image=>image.toPNG().toString("base64"))',
  );
  await writeFile(join(directory, 'paired-online.png'), Buffer.from(png, 'base64'));
  return 'Paired Online Root';
}
try {
  const first = await launch();
  await verifyOwnership(true);
  const { inspector, evaluate } = first;
  const initialRootName = await verifyOnline(first);
  await until(
    () =>
      evaluate(
        `Array.from(document.querySelectorAll('input')).some(e => e.value === ${JSON.stringify(initialRootName)})`,
      ),
    'Inspector field missing',
  );
  assert(
    await evaluate(
      `(() => { const input = Array.from(document.querySelectorAll('input')).find(e => e.value === ${JSON.stringify(initialRootName)}); input.focus(); input.select(); return document.activeElement === input; })()`,
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
  await verifyOwnership(true);
  assert(
    JSON.parse(await readFile(projectPath, 'utf8')).project.stageTree.stages[rootId].name ===
      initialRootName,
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
  await verifyOwnership(false);
  assert(
    JSON.parse(await readFile(projectPath, 'utf8')).project.stageTree.stages[rootId].name ===
      'Release Saved Edit',
    'Latest Inspector draft persisted before process exit',
  );
  const second = await launch();
  await verifyOwnership(true);
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
  await verifyOwnership(false);
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
  const result = { success, executable, cliZip, directory, metadata, checks, consoleErrors, error };
  await writeFile(join(directory, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

import { SESSION_PROTOCOL } from '../../dist-node/sessionTransport.js';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createServer, createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// 两个完整生产页面、真实键盘/字段、实际 preload/主进程，以及独立编译 CLI。
if (process.platform !== 'win32') {
  console.log('C10 online smoke requires Windows.');
  process.exit(0);
}
const root = process.cwd(),
  require = createRequire(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'puzzle C10 desktop 中文 '));
const discovery = join(directory, 'sessions');
console.log('C10 online evidence: ' + directory);
const children = [],
  checks = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(message);
  console.log('PASS ' + message);
};
const sourceURL = (path) => JSON.stringify(pathToFileURL(resolve(root, path)).href);
const requestId = () => `${Date.now()}:${randomUUID()}`;
const hash = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
await writeFile(
  join(directory, 'main.mjs'),
  `
import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import { createConnection } from 'node:net';
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { registerIpcHandlers } from ${sourceURL('dist-electron/ipc/handlers.js')};
import { registerSessionBridge } from ${sourceURL('dist-electron/sessionBridge.js')};
import { registerWindowCloseGuard } from ${sourceURL('dist-electron/windowCloseGuard.js')};
import { fileWatcherService } from ${sourceURL('dist-electron/ipc/watcherService.js')};
app.setPath('userData',process.env.C10_USER_DATA); app.setPath('documents',process.env.C10_DOCUMENTS);
app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null); registerIpcHandlers(ipcMain);
  const win = new BrowserWindow({show:false,width:1400,height:900,webPreferences:{preload:${JSON.stringify(resolve(root, 'dist-electron/preload.mjs'))},nodeIntegration:false,contextIsolation:true,sandbox:false,backgroundThrottling:false}});
  registerSessionBridge(win, ${sourceURL('dist/index.html')}); registerWindowCloseGuard(win); fileWatcherService.setMainWindow(win);
  await win.loadFile(${JSON.stringify(resolve(root, 'dist/index.html'))});
  const control = createConnection(process.env.C10_HARNESS_PIPE); control.on('error',()=>app.exit(1)); control.write('READY\\n');
  createInterface({input:control}).on('line',async line=>{
    const {id,action,data}=JSON.parse(line);
    try {
      let value;
      if(action==='evaluate') value=await win.webContents.executeJavaScript(data);
      if(action==='input') await win.webContents.insertText(data);
      if(action==='key') { win.webContents.sendInputEvent({type:'keyDown',keyCode:data.key,modifiers:data.modifiers}); win.webContents.sendInputEvent({type:'keyUp',keyCode:data.key,modifiers:data.modifiers}); }
      if(action==='screenshot') {await writeFile(data,(await win.webContents.capturePage()).toPNG());value=true;}
      if(action==='chooseOpen') {dialog.showOpenDialog=async()=>({canceled:false,filePaths:[data]});value=true;}
      if(action==='close') {win.close();value=true;}
      if(action==='destroy') {fileWatcherService.stopWatching();win.destroy();control.write(JSON.stringify({id,data:true})+'\\n',()=>app.exit(0));return;}
      control.write(JSON.stringify({id,data:value??true})+'\\n');
    }catch(error){control.write(JSON.stringify({id,error:String(error)})+'\\n');}
  });
}).catch(error=>{console.error(error);app.exit(1);});
`,
);
async function desktop(name, path) {
  const user = join(directory, name, 'appdata', 'app'),
    docs = join(directory, name, 'documents');
  const prefs = join(directory, name, 'appdata', 'StarryTree', 'PuzzleEditor');
  await mkdir(user, { recursive: true });
  await mkdir(docs, { recursive: true });
  await mkdir(prefs, { recursive: true });
  await writeFile(
    join(prefs, 'preferences.json'),
    JSON.stringify({
      projectsDirectory: directory,
      exportDirectory: directory,
      restoreLastProject: true,
      lastProjectPath: path,
      recentProjects: [],
      autoSave: { enabled: true, intervalMinutes: 1 },
      translation: { provider: 'local', autoTranslate: false },
    }),
  );
  const endpoint = '\\\\.\\pipe\\puzzle-c9-test-' + randomUUID(),
    server = createServer();
  await new Promise((ok, bad) => {
    server.once('error', bad);
    server.listen(endpoint, ok);
  });
  let socket,
    stderr = '';
  const pending = new Map();
  let seq = 0;
  let ready;
  const readyPromise = new Promise((ok, bad) => {
    const timer = setTimeout(() => bad(new Error('Desktop start timeout ' + stderr)), 20000);
    ready = () => {
      clearTimeout(timer);
      ok();
    };
  });
  server.once('connection', (s) => {
    socket = s;
    createInterface({ input: s }).on('line', (line) => {
      if (line === 'READY') {
        ready();
        return;
      }
      const r = JSON.parse(line),
        p = pending.get(r.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(r.id);
        if (r.error) p.bad(new Error(r.error));
        else p.ok(r.data);
      }
    });
  });
  const env = {
    ...process.env,
    PUZZLE_EDITOR_SESSION_DIR: discovery,
    C10_USER_DATA: user,
    C10_DOCUMENTS: docs,
    C10_HARNESS_PIPE: endpoint,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [join(directory, 'main.mjs')], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.stdout.on('data', (b) => {
    stderr += b;
    console.log('DESKTOP ' + name + ': ' + b.toString().trim());
  });
  child.stderr.on('data', (b) => {
    stderr += b;
    console.log('DESKTOP ' + name + ': ' + b.toString().trim());
  });
  child.once('exit', () => {
    socket?.destroy();
    server.close();
  });
  await readyPromise;
  return {
    child,
    request: (action, data) =>
      new Promise((ok, bad) => {
        const id = ++seq;
        const timer = setTimeout(() => bad(new Error('Desktop request timeout ' + stderr)), 15000);
        pending.set(id, { ok, bad, timer });
        socket.write(JSON.stringify({ id, action, data }) + '\n');
      }),
  };
}
async function cli(args) {
  const child = spawn(process.execPath, [resolve('dist-cli/cli.js'), ...args], {
    cwd: directory,
    env: { ...process.env, PUZZLE_EDITOR_SESSION_DIR: discovery },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '',
    err = '';
  child.stdout.on('data', (b) => {
    out += b;
  });
  child.stderr.on('data', (b) => {
    err += b;
  });
  const code = await new Promise((ok, bad) => {
    const timer = setTimeout(() => {
      child.kill();
      bad(new Error('CLI timeout ' + args.join(' ')));
    }, 35000);
    child.once('error', bad);
    child.once('exit', (c) => {
      clearTimeout(timer);
      ok(c);
    });
  });
  if (err || !out) throw new Error('CLI output error: ' + err);
  return { code, ...JSON.parse(out) };
}
async function until(check, label) {
  const end = Date.now() + 12000;
  while (!(await check())) {
    if (Date.now() > end) throw new Error(label);
    await delay(70);
  }
}
const target = (s) => ['--instance', s.token.instanceId, '--session', String(s.token.sessionId)];
const status = async (s) => {
  const r = await cli(['session', 'status', ...target(s)]);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.data;
};
async function historyMutation(s, direction) {
  const result = await cli(['history', 'list', ...target(s)]);
  if (!result.ok) throw new Error(JSON.stringify(result));
  const data = result.data,
    tokenPath = join(directory, randomUUID() + '.token.json');
  await writeFile(tokenPath, JSON.stringify(data.token));
  const entryId =
    (direction === 'undo' ? data.history.undoEntryId : data.history.redoEntryId) ?? '0:999';
  const request = {
    operation: 'history.' + direction,
    sessionId: data.token.sessionId,
    token: data.token,
    entryId,
    requestId: requestId(),
  };
  return {
    data,
    request,
    args: [
      'history',
      direction,
      ...target(s),
      '--token',
      tokenPath,
      '--entry-id',
      entryId,
      '--request-id',
      request.requestId,
    ],
  };
}
// 测试客户端在请求完整送达后断开，不读取提交响应；再次 CLI 调用必须复用真实服务的结果缓存。
async function sendAndDisconnect(instanceId, request) {
  const record = JSON.parse(await readFile(join(discovery, instanceId + '.json'), 'utf8'));
  await new Promise((ok, bad) => {
    const socket = createConnection('\\\\.\\pipe\\puzzle-editor-session-v1-' + instanceId);
    socket.once('error', bad);
    socket.once('data', (bytes) => {
      const hello = JSON.parse(bytes.toString()),
        body = JSON.stringify(request);
      const proof = createHmac('sha256', record.secret)
        .update('request:' + hello.nonce + ':' + body)
        .digest('hex');
      socket.write(
        JSON.stringify({ protocol: SESSION_PROTOCOL, nonce: hello.nonce, request: body, proof }) +
          '\n',
        () => {
          socket.destroy();
          ok();
        },
      );
    });
  });
}
const click = async (d, text) =>
  d.request(
    'evaluate',
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.title===${JSON.stringify(text)}));if(!b)throw new Error('Button missing: '+${JSON.stringify(text)});b.click();return true;})()`,
  );
let counter = 0;
async function preview(s, name) {
  const t = await status(s),
    prefix = join(directory, 'request-' + ++counter),
    plan = prefix + '.plan.json',
    token = prefix + '.token.json',
    receipt = prefix + '.receipt.json';
  await writeFile(token, JSON.stringify(t.token));
  await writeFile(
    plan,
    JSON.stringify({
      apiVersion: '1.0.0',
      sourceHash: t.token.contentHash,
      scope: { project: true },
      commands: [{ op: 'stage.update', target: { alias: 'root' }, changes: { name } }],
    }),
  );
  const result = await cli([
    'session',
    'preview',
    ...target(t),
    '--token',
    token,
    '--plan',
    plan,
    '--receipt-out',
    receipt,
  ]);
  return {
    result,
    t,
    plan,
    token,
    receipt,
    apply: () => [
      'session',
      'apply',
      ...target(t),
      '--plan',
      plan,
      '--receipt',
      receipt,
      '--request-id',
      requestId(),
    ],
  };
}
const deadline = setTimeout(() => {
  for (const child of children) child.kill();
}, 180000);
try {
  const a = join(directory, 'A.puzzle.json'),
    b = join(directory, 'B.puzzle.json');
  for (const [path, name] of [
    [a, 'First'],
    [b, 'Second'],
  ])
    assert(
      (await cli(['create', '--name', name, '--root-asset-name', 'Root', '--out', path])).ok,
      'Create isolated ' + name,
    );
  const first = await desktop('one', a),
    second = await desktop('two', b);
  let sessions;
  await until(async () => {
    const r = await cli(['session', 'list']);
    sessions = r.data.sessions.filter((s) => s.status === 'available').map((s) => s.data);
    const ready = sessions.length === 2 && sessions.every((s) => s.loaded);
    if (!ready) console.log('DISCOVERY ' + JSON.stringify(r));
    return ready;
  }, 'Two desktop sessions unavailable');
  const s = sessions.find((s) => s.path === a),
    other = sessions.find((s) => s.path === b);
  assert(Boolean(s && other), 'Two production desktop sessions discovered without guessing');
  const initialHash = await hash(a);
  const p = await preview(s, 'Agent root');
  assert(p.result.ok, 'Preview against live token');
  const args = p.apply();
  await sendAndDisconnect(s.token.instanceId, {
    operation: 'apply',
    sessionId: s.token.sessionId,
    requestId: args.at(-1),
    plan: JSON.parse(await readFile(p.plan, 'utf8')),
    receipt: JSON.parse(await readFile(p.receipt, 'utf8')),
  });
  await until(
    async () => (await status(s)).history.past === 1,
    'Disconnected request did not commit',
  );
  assert(true, 'Dropped connection after request delivery preserves the committed transaction');
  const applied = await cli(args);
  assert(
    applied.ok && applied.data.changed && applied.data.history.past === 1,
    'CLI applies one atomic GUI undo transaction',
  );
  await until(
    () =>
      first.request(
        'evaluate',
        `[...document.querySelectorAll('input')].some(e=>e.value==='Agent root')`,
      ),
    'Inspector did not update',
  );
  assert(true, 'Production Inspector immediately displays CLI edit');
  assert(
    (await cli(args)).data.token.contentEpoch === applied.data.token.contentEpoch,
    'Same ID retry after real disconnect returns original result without duplicate commit',
  );
  assert((await status(other)).dirty === false, 'Other desktop remains unchanged');
  assert(applied.data.savePolicy.autoSaveBlocked, 'Auto-save restriction visible in live status');
  await first.request('screenshot', join(directory, '01-agent-edit.png'));
  await first.request('key', { key: 'z', modifiers: ['control'] });
  await delay(100);
  const undone = await status(s);
  assert(
    undone.history.future === 1 && undone.history.past === 0,
    'Real GUI Ctrl+Z undoes whole Agent batch',
  );
  const redo = await historyMutation(s, 'redo');
  const agentEntryId = redo.request.entryId;
  assert(
    redo.data.history.future[0].source === 'agent',
    'History list exposes the GUI-undone Agent entry',
  );
  assert((await cli(redo.args)).ok, 'CLI Redo restores the same GUI history entry');
  await until(
    () =>
      first.request(
        'evaluate',
        `[...document.querySelectorAll('input')].some(e=>e.value==='Agent root')`,
      ),
    'CLI Redo did not refresh Inspector',
  );
  assert(true, 'CLI Redo immediately updates production Inspector');
  const disconnectedUndo = await historyMutation(s, 'undo');
  await sendAndDisconnect(s.token.instanceId, disconnectedUndo.request);
  await until(
    async () => (await status(s)).history.future === 1,
    'Disconnected Undo did not complete',
  );
  const undoRetry = await cli(disconnectedUndo.args);
  assert(
    undoRetry.ok && undoRetry.data.status === 'undone',
    'Disconnected CLI Undo retries with the original result',
  );
  assert(
    (await cli(disconnectedUndo.args)).data.token.contentEpoch ===
      undoRetry.data.token.contentEpoch,
    'Retry never undoes a second entry',
  );
  await first.request('key', { key: 'z', modifiers: ['control', 'shift'] });
  await delay(100);
  assert(
    (await status(s)).savePolicy.autoSaveBlocked,
    'Real GUI redo restores auto-save restriction',
  );
  const stale = await cli([...p.apply()]);
  assert(
    !stale.ok && stale.error.code === 'SESSION_CONFLICT',
    'Old token rejected after GUI undo/redo',
  );

  // 后台窗口 focus/insertText 不产生自然 blur；CLI 必须先提交最新字段再报冲突。
  const draft = await preview(s, 'Would overwrite draft');
  assert(draft.result.ok, 'Draft test preview');
  assert(
    await first.request(
      'evaluate',
      `(()=>{const f=[...document.querySelectorAll('input')].find(e=>e.value==='Agent root');if(!f)return false;f.focus();f.select();return true;})()`,
    ),
    'Focus real Inspector field in hidden/background window',
  );
  await first.request('input', 'Human draft');
  await delay(100);
  const read = await cli(['session', 'inspect', ...target(s), '--view', 'project']);
  assert(
    read.data.pendingEdits &&
      Object.values(read.data.result.file.project.stageTree.stages)[0].name === 'Agent root',
    'Read-only reports pending draft and committed content separately',
  );
  const rejected = await cli(draft.apply());
  assert(
    !rejected.ok && rejected.error.code === 'SESSION_CONFLICT',
    'Apply flushes background field then rejects stale preview',
  );
  assert((await status(s)).history.past === 2, 'Human field commit remains in shared history');
  const wrongTop = await historyMutation(s, 'undo');
  wrongTop.args[wrongTop.args.indexOf('--entry-id') + 1] = agentEntryId;
  assert(
    (await cli(wrongTop.args)).error?.code === 'HISTORY_CONFLICT',
    'CLI cannot skip a later human entry to undo old Agent work',
  );
  assert(
    await first.request(
      'evaluate',
      `[...document.querySelectorAll('input')].some(e=>e.value==='Human draft')`,
    ),
    'Human draft preserved visibly',
  );

  await click(first, 'Preferences');
  const busy = await preview(s, 'Blocked by dialog');
  assert(
    !busy.result.ok && busy.result.error.code === 'SESSION_BUSY',
    'Online preview does not interrupt an open modal',
  );
  assert(
    (await cli((await historyMutation(s, 'undo')).args)).error?.code === 'SESSION_BUSY',
    'CLI history respects the active modal barrier',
  );
  await first.request(
    'evaluate',
    `(()=>{const d=document.querySelector('[role="dialog"]');const b=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cancel');if(b)b.click();else d.querySelector('[aria-label="Close"]')?.click();return true;})()`,
  );
  await until(
    () => first.request('evaluate', `!document.querySelector('[role="dialog"]')`),
    'Modal did not close',
  );

  const savedToken = join(directory, 'save-token.json');
  await writeFile(savedToken, JSON.stringify((await status(s)).token));
  const denied = await cli([
    'session',
    'save',
    ...target(s),
    '--token',
    savedToken,
    '--request-id',
    requestId(),
  ]);
  assert(
    denied.error?.code === 'OVERWRITE_AUTHORIZATION_REQUIRED',
    'Current-file save requires chat overwrite declaration',
  );
  const conflict = await cli([
    'session',
    'save',
    ...target(s),
    '--token',
    savedToken,
    '--request-id',
    requestId(),
    '--allow-overwrite',
    '--expected-disk-hash',
    '0'.repeat(64),
  ]);
  assert(
    !conflict.ok && conflict.data.dirty && (await hash(a)) === initialHash,
    'Disk hash conflict leaves memory dirty and disk untouched',
  );

  console.log('Waiting for the real one-minute auto-save tick with unauthorized Agent content...');
  await delay(61000);
  assert(
    (await hash(a)) === initialHash,
    'Real auto-save timer performs zero unauthorized disk overwrite',
  );
  const prefs = JSON.parse(
    await readFile(
      join(directory, 'one', 'appdata', 'StarryTree', 'PuzzleEditor', 'preferences.json'),
      'utf8',
    ),
  );
  assert(prefs.autoSave.enabled, 'Auto-save preference remains enabled');
  await writeFile(savedToken, JSON.stringify((await status(s)).token));
  const save = await cli([
    'session',
    'save',
    ...target(s),
    '--token',
    savedToken,
    '--request-id',
    requestId(),
    '--allow-overwrite',
    '--expected-disk-hash',
    initialHash,
  ]);
  assert(
    save.ok && !save.data.dirty && !save.data.savePolicy.autoSaveBlocked,
    'Authorized current-file save acknowledges captured content',
  );
  assert(
    Object.values(JSON.parse(await readFile(a, 'utf8')).project.stageTree.stages)[0].name ===
      'Human draft',
    'Saved disk contains latest human and Agent content',
  );

  const diskAfterSave = await hash(a);
  assert(
    (await cli((await historyMutation(s, 'undo')).args)).ok,
    'CLI Undo after saving edits only memory',
  );
  const afterSavedUndo = await status(s);
  assert(
    afterSavedUndo.dirty && afterSavedUndo.savePolicy.autoSaveBlocked,
    'Saved then undone content is dirty with a fresh auto-save restriction',
  );
  assert((await hash(a)) === diskAfterSave, 'History Undo is not a disk rollback');
  assert(
    (await cli((await historyMutation(s, 'redo')).args)).ok,
    'CLI Redo can restore the saved snapshot',
  );
  assert(
    (await status(s)).savePolicy.autoSaveBlocked,
    'Previous save does not grant permission to later history moves',
  );
  const again = await preview(s, 'Saved copy root');
  assert(again.result.ok, 'Preview next task');
  assert((await cli(again.apply())).ok, 'Apply next task');
  assert(
    (await status(s)).savePolicy.autoSaveBlocked,
    'Previous authorization does not allow next task auto-save',
  );
  const out = join(directory, 'New copy.puzzle.json');
  await writeFile(savedToken, JSON.stringify((await status(s)).token));
  const copied = await cli([
    'session',
    'save',
    ...target(s),
    '--token',
    savedToken,
    '--request-id',
    requestId(),
    '--out',
    out,
  ]);
  assert(
    copied.ok && copied.data.path === out && !copied.data.dirty,
    'Explicit new path saves through ownership and session queue',
  );
  const written = JSON.parse(await readFile(out, 'utf8'));
  assert(
    Object.values(written.project.stageTree.stages)[0].name === 'Saved copy root',
    'New copy contains expected current snapshot',
  );
  await first.request('screenshot', join(directory, '02-saved-copy.png'));
  await first.request('chooseOpen', a);
  await click(first, 'Project');
  await click(first, 'Open Project...');
  await until(async () => {
    const r = await cli(['session', 'list']);
    return r.data.sessions.some(
      (x) => x.data?.path === a && x.data.token.sessionId !== s.token.sessionId,
    );
  }, 'Project switch did not complete');
  assert(
    (await cli(['session', 'status', ...target(s)])).error?.code === 'SESSION_EXPIRED',
    'Switching project invalidates old session identity',
  );
  await first.request('destroy');
  await second.request('destroy');
  await delay(150);
  assert(
    (await cli(['session', 'list'])).data.sessions.length === 0,
    'Closed desktop registrations are removed',
  );
  await writeFile(
    join(directory, 'result.json'),
    JSON.stringify({ success: true, checks }, null, 2),
  );
  console.log(`C10 real desktop online smoke passed (${checks.length} checks).`);
} catch (error) {
  await writeFile(
    join(directory, 'result.json'),
    JSON.stringify({ success: false, checks, error: String(error.stack ?? error) }, null, 2),
  );
  throw error;
} finally {
  clearTimeout(deadline);
  for (const child of children)
    if (child.exitCode === null && child.signalCode === null)
      await new Promise((ok) => {
        child.once('exit', ok);
        child.kill();
      });
}

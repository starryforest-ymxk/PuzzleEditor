import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { build } from 'vite';
import { ProjectLease } from '../../dist-node/projectOwnership.js';

// 两个独立 Electron 主进程、真实 preload/Store，以及独立 CLI 子进程；不使用用户工程。
if (process.platform !== 'win32') {
  console.log('C8 ownership smoke skipped: Windows only.');
  process.exit(0);
}
const root = process.cwd(),
  require = createRequire(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'puzzle-c8-electron-'));
console.log('C8 ownership evidence directory: ' + directory);
const checks = [],
  children = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(message);
};
const url = (path) => JSON.stringify(pathToFileURL(resolve(root, path)).href);
await build({
  configFile: false,
  logLevel: 'error',
  build: {
    outDir: directory,
    emptyOutDir: false,
    lib: {
      entry: resolve('tests/electron/ownershipSmoke.renderer.ts'),
      name: 'OwnershipSmoke',
      formats: ['iife'],
      fileName: () => 'renderer.js',
    },
  },
});
await writeFile(
  join(directory, 'index.html'),
  '<!doctype html><meta charset="utf-8"><script src="renderer.js"></script>',
);
await writeFile(
  join(directory, 'main.mjs'),
  `
import {app,BrowserWindow,ipcMain} from 'electron';
import {createInterface} from 'node:readline';
import {createConnection} from 'node:net';
import {registerIpcHandlers} from ${url('dist-electron/ipc/handlers.js')};
import {fileWatcherService} from ${url('dist-electron/ipc/watcherService.js')};
app.setPath('userData',process.env.C8_USER_DATA);app.setPath('documents',process.env.C8_DOCUMENTS);
app.whenReady().then(async()=>{ registerIpcHandlers(ipcMain);
const win=new BrowserWindow({show:false,webPreferences:{preload:${JSON.stringify(resolve(root, 'dist-electron/preload.mjs'))},contextIsolation:true,nodeIntegration:false,sandbox:false}});
fileWatcherService.setMainWindow(win);
await win.loadFile(${JSON.stringify(join(directory, 'index.html'))});
const control=createConnection(process.env.C8_HARNESS_PIPE);control.on('error',error=>{console.error(error);app.exit(1);});
control.write('C8_READY\\n');
createInterface({input:control}).on('line',async line=>{const {id,action,data}=JSON.parse(line);try{
if(action==='destroy'){fileWatcherService.stopWatching();win.destroy();control.write('C8_RESULT '+JSON.stringify({id,data:true})+'\\n',()=>app.exit(0));return;}
const result=await win.webContents.executeJavaScript('window.ownershipSmoke('+JSON.stringify(action)+','+JSON.stringify(data)+')');
control.write('C8_RESULT '+JSON.stringify({id,data:result})+'\\n');
}catch(error){control.write('C8_RESULT '+JSON.stringify({id,error:String(error)})+'\\n');}});
}).catch(error=>{console.error(error);app.exit(1);});
`,
);
async function desktop(name) {
  const user = join(directory, name, 'appdata', 'app'),
    docs = join(directory, name, 'documents');
  await mkdir(user, { recursive: true });
  await mkdir(docs, { recursive: true });
  const endpoint = '\\\\.\\pipe\\puzzle-c8-test-' + randomUUID();
  const server = createServer();
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(endpoint, done);
  });
  let socket;
  const connection = new Promise((done) =>
    server.once('connection', (s) => {
      socket = s;
      done(s);
    }),
  );
  const env = { ...process.env, C8_USER_DATA: user, C8_DOCUMENTS: docs, C8_HARNESS_PIPE: endpoint };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [join(directory, 'main.mjs')], {
    env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  children.push(child);
  let seq = 0,
    ready,
    stderr = '';
  const pending = new Map();
  child.stderr.on('data', (b) => {
    stderr += b;
  });
  child.stdout.on('data', (b) => {
    stderr += b;
  });
  child.once('exit', () => {
    socket?.destroy();
    server.close();
  });
  const control = await connection;
  createInterface({ input: control }).on('line', (line) => {
    if (line === 'C8_READY') ready();
    if (line.startsWith('C8_RESULT ')) {
      const message = JSON.parse(line.slice(10)),
        p = pending.get(message.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(message.id);
        if (message.error) p.reject(new Error(message.error));
        else p.done(message.data);
      }
    }
  });
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Electron ready timeout: ' + stderr)), 20000);
    ready = () => {
      clearTimeout(timer);
      done();
    };
    child.once('error', reject);
  });
  return {
    child,
    request: (action, data = {}) =>
      new Promise((done, reject) => {
        const id = ++seq;
        const timer = setTimeout(
          () => reject(new Error('Operation timeout: ' + action + ' ' + stderr)),
          15000,
        );
        pending.set(id, { done, reject, timer });
        control.write(JSON.stringify({ id, action, data }) + '\n');
      }),
  };
}
async function cli(args) {
  const child = spawn(process.execPath, [resolve('dist-cli/cli.js'), ...args], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (b) => {
    stdout += b;
  });
  child.stderr.on('data', (b) => {
    stderr += b;
  });
  const code = await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', done);
  });
  if (!stdout) throw new Error(stderr);
  return { code, result: JSON.parse(stdout) };
}
async function preview(source) {
  const plan = source + '.plan.json',
    receipt = source + '.receipt.json';
  await writeFile(
    plan,
    JSON.stringify({
      apiVersion: '1.0.0',
      sourceHash: createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
      scope: { project: true },
      commands: [{ op: 'project.update', changes: { description: 'CLI C8 updated' } }],
    }),
  );
  const p = await cli(['preview', source, '--plan', plan, '--in-place', '--receipt-out', receipt]);
  assert(p.code === 0, 'Real CLI preview: ' + source);
  return () =>
    cli(['apply', source, '--plan', plan, '--receipt', receipt, '--in-place', '--allow-overwrite']);
}
async function terminated(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((done) => {
    child.once('exit', done);
    child.kill();
  });
}
const deadline = setTimeout(() => {
  for (const child of children) child.kill();
}, 90000);
try {
  const a = join(directory, 'A.puzzle.json'),
    b = join(directory, 'B.puzzle.json'),
    c = join(directory, 'C.puzzle.json');
  for (const [path, name] of [
    [a, 'A'],
    [b, 'B'],
  ])
    assert(
      (await cli(['create', '--out', path, '--name', name, '--root-asset-name', 'Root'])).code ===
        0,
      'Create ' + name,
    );
  const applyA = await preview(a),
    first = await desktop('one'),
    second = await desktop('two');
  assert(
    (await first.request('open', { path: a })).result.status === 'loaded',
    'First desktop owns A',
  );
  assert((await applyA()).result.error.code === 'PROJECT_OWNED', 'Clean open desktop blocks CLI');
  assert(
    (await second.request('open', { path: a })).result.status === 'failed',
    'Second desktop cannot own A',
  );
  assert(
    (await second.request('open', { path: b })).result.status === 'loaded',
    'Second desktop owns B',
  );
  const dirty = await first.request('edit', { description: 'Unsaved A' });
  assert((await applyA()).result.error.code === 'PROJECT_OWNED', 'Unsaved desktop blocks CLI');
  const failed = await first.request('open', { path: b, choice: 'discard' });
  assert(
    failed.result.status === 'failed' &&
      failed.state.path === a &&
      failed.state.dirty &&
      failed.state.history === dirty.state.history &&
      failed.state.description === 'Unsaved A',
    'Failed switch preserves document/history/path/dirty',
  );
  assert(
    (await applyA()).result.error.code === 'PROJECT_OWNED',
    'Failed switch retains old ownership',
  );
  assert(
    (await first.request('open', { path: b, choice: 'cancel' })).result.status === 'cancelled',
    'Cancelled switch stays in old session',
  );
  await second.request('destroy');
  await terminated(second.child);
  assert(
    (await first.request('open', { path: b, choice: 'discard' })).result.status === 'loaded',
    'Window destroyed releases target; switch succeeds',
  );
  assert((await applyA()).code === 0, 'Successful switch releases previous A to CLI');
  assert(
    (await first.request('memory', { content: await readFile(a, 'utf8') })).result.status ===
      'loaded',
    'Memory project releases previous file',
  );
  const hold = await ProjectLease.acquire(c, 'cli-transaction');
  await first.request('edit', { description: 'Memory edit pending save' });
  try {
    const r = await first.request('save', { path: c });
    assert(
      r.result.status === 'failed' && r.state.path === null && r.state.dirty,
      'Save As claim conflict preserves unsaved session',
    );
  } finally {
    await hold.release();
  }
  assert(
    (await first.request('save', { path: c })).result.status === 'saved',
    'Save As succeeds after target released',
  );
  const applyC = await preview(c);
  assert(
    (await applyC()).result.error.code === 'PROJECT_OWNED',
    'Save As retains new file ownership',
  );
  await first.request('edit', { description: 'Unsaved C' });
  assert(
    (await first.request('closeCancel')).result === false,
    'Cancel close preserves active session',
  );
  assert(
    (await applyC()).result.error.code === 'PROJECT_OWNED',
    'Cancel close retains file ownership',
  );
  await terminated(first.child);
  assert(
    (await applyC()).code === 0,
    'Killed Electron releases OS ownership without stale PID cleanup',
  );
  await writeFile(
    join(directory, 'result.json'),
    JSON.stringify({ success: true, checks }, null, 2),
  );
  console.log(
    'C8_ELECTRON_OWNERSHIP_RESULT ' + JSON.stringify({ success: true, checks, directory }),
  );
} catch (error) {
  await writeFile(
    join(directory, 'result.json'),
    JSON.stringify({ success: false, checks, error: String(error) }, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  for (const child of children) await terminated(child);
}

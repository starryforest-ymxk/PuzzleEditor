import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir, cpus, totalmem, platform, release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'vite';

// 只运行本仓库的生产构建；临时 Chromium 配置不接触用户项目和偏好。
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const label = process.argv[2] ?? 'current';
const legacy = process.argv.includes('--legacy');
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple benchmark label');
const directory = await mkdtemp(join(tmpdir(), 'puzzle-batch6-bench-'));
const output = join(root, 'overview/dev/verification', `batch6-${label}.json`);
await mkdir(join(directory, 'user-data'));
await build({
  configFile: false,
  logLevel: 'error',
  resolve: {
    alias: [
      ...(legacy
        ? [
            {
              find: /^.*\/hooks\/useBlackboardData$/,
              replacement: join(root, 'tests/performance/legacyBlackboardData.ts'),
            },
          ]
        : []),
      { find: '@', replacement: root },
    ],
  },
  build: {
    outDir: directory,
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: join(root, 'tests/performance/renderer.tsx'),
      formats: ['iife'],
      name: 'PerformanceCheck',
      fileName: () => 'renderer.js',
      cssFileName: 'style',
    },
  },
  define: { 'process.env.NODE_ENV': '"production"' },
});
await writeFile(
  join(directory, 'index.html'),
  '<!doctype html><meta charset="utf-8"><title>Isolated performance verification</title><link rel="stylesheet" href="style.css"><script defer src="renderer.js"></script>',
  'utf8',
);
const metadata = {
  label,
  implementation: legacy ? 'batch5-reference-scans' : 'current',
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: `${platform()} ${release()}`,
  cpu: cpus()[0].model,
  memoryGiB: totalmem() / 2 ** 30,
  fixtureSha256: createHash('sha256')
    .update(await readFile(join(root, 'tests/performance/fixtures.ts')))
    .digest('hex'),
  rendererSha256: createHash('sha256')
    .update(await readFile(join(root, 'tests/performance/renderer.tsx')))
    .digest('hex'),
  directory,
};
await writeFile(
  join(directory, 'preload.mjs'),
  `
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('performanceHarness', {
 report: result => ipcRenderer.send('bench:result', result),
 progress: message => ipcRenderer.send('bench:progress', message),
 gc: () => ipcRenderer.invoke('bench:gc')
});`,
  'utf8',
);
await writeFile(
  join(directory, 'main.mjs'),
  `
import { app, BrowserWindow, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';
app.setPath('userData', ${JSON.stringify(join(directory, 'user-data'))});
app.commandLine.appendSwitch('enable-precise-memory-info');
app.whenReady().then(async () => {
 const window = new BrowserWindow({ show: false, width: 1280, height: 900, useContentSize: true, webPreferences: { preload: ${JSON.stringify(join(directory, 'preload.mjs'))}, sandbox: false, backgroundThrottling: false, contextIsolation: true, nodeIntegration: false } });
 await window.webContents.debugger.attach('1.3');
 ipcMain.handle('bench:gc', async () => { await window.webContents.debugger.sendCommand('HeapProfiler.collectGarbage'); return (await window.webContents.debugger.sendCommand('Runtime.getHeapUsage')).usedSize; });
 ipcMain.on('bench:progress', (_, message) => console.log(message));
 ipcMain.once('bench:result', async (_, result) => {
  const data = { ...${JSON.stringify(metadata)}, versions: process.versions, ...result };
  await writeFile(${JSON.stringify(output)}, JSON.stringify(data, null, 2), 'utf8');
  console.log('PERFORMANCE_RESULT ' + JSON.stringify({ success: result.success, error: result.error, output: ${JSON.stringify(output)}, sizes: Object.fromEntries(Object.entries(result.results ?? {}).map(([key,value])=>[key,value.size])) }));
  window.destroy(); app.exit(result.success ? 0 : 1);
 });
 window.webContents.on('render-process-gone', (_, details) => { console.error(details); app.exit(1); });
 await window.loadFile(${JSON.stringify(join(directory, 'index.html'))});
}).catch(error => { console.error(error); app.exit(1); });`,
  'utf8',
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [join(directory, 'main.mjs')], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});
console.log(`Production benchmark ${label}: ${directory}`);
const deadline = setTimeout(() => {
  console.error('Benchmark timed out');
  child.kill();
}, 180000);
child.on('error', (error) => {
  clearTimeout(deadline);
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  clearTimeout(deadline);
  process.exitCode = code ?? 1;
});

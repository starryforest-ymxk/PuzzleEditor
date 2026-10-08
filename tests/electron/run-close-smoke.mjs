import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'vite';

// 使用完整生产页面和真实关闭协调器；每种退出场景独占进程、项目、偏好目录。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'puzzle-close-electron-'));
const manual = process.argv.includes('--manual');
await build({ logLevel: 'error' });
const fixture = JSON.parse(
  await readFile(join(root, 'overview/dev/verification/batch6-browser-saved.puzzle.json'), 'utf8'),
);
fixture.project.meta.name = 'Close Verification';
const rootId = fixture.project.stageTree.rootId;
fixture.project.stageTree.stages[rootId].name = 'Close Test Root';
fixture.project.stageTree.stages[rootId].assetName = 'CloseTestRoot';
fixture.editorState = {
  currentStageId: rootId,
  currentNodeId: null,
  currentGraphId: null,
  view: 'EDITOR',
};
console.log('Close verification evidence: ' + directory);
const results = [];
for (const scenario of manual
  ? ['manual']
  : ['empty', 'clean', 'save', 'discard', 'failed-save', 'save-as', 'quit']) {
  const isolated = join(directory, scenario);
  const userData = join(isolated, 'appdata', 'app');
  const documents = join(isolated, 'documents');
  const prefsDir = join(isolated, 'appdata', 'StarryTree', 'PuzzleEditor');
  await Promise.all([
    mkdir(userData, { recursive: true }),
    mkdir(documents, { recursive: true }),
    mkdir(prefsDir, { recursive: true }),
  ]);
  const projectPath = join(
    isolated,
    scenario === 'save-as' ? 'import.json' : 'project.puzzle.json',
  );
  const savePath = scenario === 'save-as' ? join(isolated, 'saved-copy.puzzle.json') : projectPath;
  await writeFile(projectPath, JSON.stringify(fixture), 'utf8');
  await writeFile(
    join(prefsDir, 'preferences.json'),
    JSON.stringify({
      projectsDirectory: isolated,
      exportDirectory: isolated,
      restoreLastProject: scenario !== 'empty',
      lastProjectPath: scenario === 'empty' ? null : projectPath,
      recentProjects: [],
      autoSave: { enabled: false, intervalMinutes: 1 },
      translation: { provider: 'local', autoTranslate: false },
    }),
    'utf8',
  );
  const config = { scenario, root, isolated, userData, documents, projectPath, savePath, rootId };
  const configPath = join(isolated, 'config.json');
  await writeFile(configPath, JSON.stringify(config), 'utf8');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const code = await new Promise((done, reject) => {
    const child = spawn(
      require('electron'),
      [join(root, 'tests/electron/closeSmoke.main.mjs'), configPath],
      { env, stdio: 'inherit', windowsHide: !manual },
    );
    const deadline = manual ? null : setTimeout(() => child.kill(), 45000);
    child.once('error', (error) => {
      if (deadline) clearTimeout(deadline);
      reject(error);
    });
    child.once('exit', (code) => {
      if (deadline) clearTimeout(deadline);
      done(code);
    });
  });
  if (code !== 0) throw new Error(`Close scenario ${scenario} failed (${code})`);
  results.push(JSON.parse(await readFile(join(isolated, 'result.json'), 'utf8')));
}
await writeFile(join(directory, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
console.log(`Electron close verification passed (${results.length} scenarios).`);

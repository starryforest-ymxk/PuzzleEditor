/** 真实 Codex 仅扫描隔离项目 Skill，不创建线程/任务，不使用用户配置或业务工程。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { removeOwnedDirectory } from './cli-package-io.mjs';
const bundle = path.resolve(process.argv[2] ?? '');
const codex = process.argv[3];
if (!codex) throw new Error('Pass a verified Codex executable and a complete CLI package.');
const directory = await fs.mkdtemp(path.join(tmpdir(), 'puzzle-codex-skill-'));
const work = path.join(directory, 'project'),
  home = path.join(directory, 'home'),
  codexHome = path.join(directory, 'codex-home');
for (const target of [work, home, codexHome]) await fs.mkdir(target);
const env = {
  ...process.env,
  USERPROFILE: home,
  CODEX_HOME: codexHome,
  LOCALAPPDATA: path.join(directory, 'local'),
  APPDATA: path.join(directory, 'roaming'),
};
let child;
try {
  const run = (args) => {
    const result = spawnSync(
      path.join(bundle, 'runtime/node.exe'),
      [path.join(bundle, 'app/cli.js'), ...args],
      { env, cwd: work, windowsHide: true, encoding: 'utf8', timeout: 30000 },
    );
    if (result.status !== 0) throw new Error(result.stdout || result.stderr);
    return JSON.parse(result.stdout).data;
  };
  run(['skills', 'install', '--agent', 'codex', '--scope', 'project', '--project-root', work]);
  child = spawn(codex, ['app-server', '--stdio'], {
    env,
    cwd: work,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let pending = '',
    sequence = 0;
  const requests = new Map();
  child.stdout.on('data', (bytes) => {
    pending += bytes.toString();
    let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      const request = requests.get(message.id);
      if (request) {
        requests.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
    }
  });
  child.stderr.on('data', () => undefined);
  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        requests.delete(id);
        reject(new Error('Codex read-only request timed out: ' + method));
      }, 20000);
      requests.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  const initialized = await call('initialize', {
    clientInfo: { name: 'puzzle-skill-verification', version: '1.0.0' },
    capabilities: { experimentalApi: true },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');
  const listed = await call('skills/list', { cwds: [work], forceReload: true });
  const entry = listed.data.find((item) => item.cwd.toLowerCase() === work.toLowerCase());
  const skill = entry?.skills.find((item) => item.name === 'puzzle-editor');
  if (
    !skill ||
    entry.errors.length ||
    !skill.enabled ||
    !skill.path.toLowerCase().startsWith(work.toLowerCase())
  )
    throw new Error('Codex did not discover the managed project Skill: ' + JSON.stringify(entry));
  const text = await fs.readFile(skill.path, 'utf8');
  if (!text.includes('references/cli-guide.md'))
    throw new Error('Discovered Skill cannot route to its reference.');
  // 按已发现 Skill 的领域另存流程执行虚构工程；不冒充模型自动触发测试。
  run([
    'create',
    '--name',
    'Skill Smoke',
    '--root-asset-name',
    'SkillRoot',
    '--out',
    'source.puzzle.json',
  ]);
  const inspected = run(['inspect', 'source.puzzle.json']);
  await fs.writeFile(
    path.join(work, 'plan.json'),
    JSON.stringify({
      apiVersion: '1.0.0',
      sourceHash: inspected.source.sha256,
      scope: { project: true },
      commands: [{ op: 'project.update', changes: { description: 'Skill domain flow' } }],
    }),
  );
  run(['preview', 'source.puzzle.json', '--plan', 'plan.json', '--receipt-out', 'receipt.json']);
  run([
    'apply',
    'source.puzzle.json',
    '--plan',
    'plan.json',
    '--receipt',
    'receipt.json',
    '--out',
    'edited.puzzle.json',
  ]);
  run(['validate', 'edited.puzzle.json']);
  run(['export', 'edited.puzzle.json', '--out', 'edited.export.json']);
  const result = {
    ok: true,
    verifiedAt: new Date().toISOString(),
    codex: initialized.userAgent,
    name: skill.name,
    scope: skill.scope,
    enabled: skill.enabled,
    actualHostDiscovery: true,
    domainWorkflow: true,
    automaticModelInvocationTested: false,
    currentUserConfigurationChanged: false,
  };
  if (process.argv[4])
    await fs.writeFile(path.resolve(process.argv[4]), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  if (child) {
    child.stdin.end();
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once('close', resolve);
    });
  }
  await removeOwnedDirectory(tmpdir(), directory, 'puzzle-codex-skill-');
}

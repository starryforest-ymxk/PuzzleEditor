/** 真正的 CLI 子进程使用独立 HKCU 键与临时目录；绝不改当前用户 PATH 或 Skill。 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { CLI_PHASE } from '../../contracts/automation/capabilities';
import { ProjectLease } from '../../dist-node/projectOwnership.js';
import { packagePathSchema } from '../../contracts/automation/toolingSchemas';
import { publicSkillFiles } from '../../services/cliTooling/referenceFiles';

let directory: string, source: string, root: string;
let firstRecord: unknown;
const registry = 'Software\\PuzzleEditorCLI\\Tests\\' + randomUUID() + '\\Environment';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const binary = path.resolve('dist-cli/cli.js');
const env = () => ({
  ...process.env,
  PUZZLE_EDITOR_TEST_REGISTRY_KEY: registry,
  LOCALAPPDATA: directory,
  USERPROFILE: path.join(directory, 'home'),
  APPDATA: path.join(directory, 'preferences'),
});
function run(
  args: string[],
  executable = process.execPath,
  entry = binary,
  extraEnv: Record<string, string> = {},
) {
  const child = spawnSync(executable, [entry, ...args], {
    env: { ...env(), ...extraEnv },
    cwd: directory,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  });
  expect(child.stderr).toBe('');
  return { code: child.status, ...JSON.parse(child.stdout) };
}
async function manifest() {
  const files: { path: string; size: number; sha256: string }[] = [];
  async function collect(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(file);
      else if (entry.name !== 'manifest.json') {
        const bytes = await fs.readFile(file);
        files.push({
          path: path.relative(source, file).replaceAll('\\', '/'),
          size: bytes.length,
          sha256: hash(bytes),
        });
      }
    }
  }
  await collect(source);
  const lock = JSON.parse(await fs.readFile('cli/runtime-lock.json', 'utf8'));
  await fs.writeFile(
    path.join(source, 'manifest.json'),
    JSON.stringify({
      name: 'Tooling Test',
      version: '1.0.0-beta',
      phase: CLI_PHASE,
      createdAt: randomUUID(),
      runtime: { ...lock, version: process.version.slice(1) },
      files,
    }),
  );
}
beforeAll(async () => {
  directory = await fs.mkdtemp(path.join(tmpdir(), 'puzzle-tooling 中文 '));
  source = path.join(directory, 'portable');
  root = path.join(directory, 'installed');
  for (const dir of ['app', 'runtime']) await fs.mkdir(path.join(source, dir), { recursive: true });
  await fs.copyFile(process.execPath, path.join(source, 'runtime/node.exe'));
  for (const name of ['cli.js', 'package.json'])
    await fs.copyFile(path.join('dist-cli', name), path.join(source, 'app', name));
  for (const name of ['install-cli.ps1', 'uninstall-cli.ps1'])
    await fs.copyFile(path.join('scripts', name), path.join(source, name));
  const skillFiles = await publicSkillFiles(path.resolve('.'));
  await fs.writeFile(path.join(source, 'AGENTS.md'), skillFiles['references/cli-guide.md']);
  for (const [name, text] of Object.entries(skillFiles)) {
    const destination = path.join(source, 'agent-skills/puzzle-editor', name);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, text);
  }
  await fs.writeFile(path.join(source, 'capabilities.json'), JSON.stringify(run(['describe'])));
  await manifest();
}, 30000);
afterAll(async () => {
  // 清理仅此测试创建的命名空间；递归操作先验证绝对边界。
  if (
    !directory ||
    path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
    !path.basename(directory).startsWith('puzzle-tooling ')
  )
    throw new Error('Unsafe test cleanup');
  await fs.rm(directory, { recursive: true, force: true });
  const cleanup = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Remove-Item -LiteralPath ("HKCU:\\" + $env:PUZZLE_EDITOR_TEST_REGISTRY_KEY) -Recurse -Force -ErrorAction SilentlyContinue',
    ],
    { env: env(), windowsHide: true },
  );
  expect([0, 1]).toContain(cleanup.status);
});
describe.skipIf(process.platform !== 'win32')('C12 tool installation processes', () => {
  it('reports real build versions', () => {
    const r = run(['--version']);
    expect(r.code).toBe(0);
    expect(r.data.phase).toBe(CLI_PHASE);
    expect(r.data.nodeVersion).toBe(process.version);
  });
  it('read-only status and dry-run do not create a root', async () => {
    expect(run(['setup', 'status', '--install-root', root]).data.installed).toBe(false);
    expect(
      run(['setup', 'install', '--source', source, '--install-root', root, '--dry-run']).code,
    ).toBe(0);
    expect(await fs.stat(root).catch(() => null)).toBe(null);
  });
  it('rejects damaged package before activation', async () => {
    const original = await fs.readFile(path.join(source, 'AGENTS.md'));
    await fs.appendFile(path.join(source, 'AGENTS.md'), 'corrupt');
    expect(run(['setup', 'install', '--source', source, '--install-root', root]).code).toBe(4);
    await fs.writeFile(path.join(source, 'AGENTS.md'), original);
  });
  it('rejects duplicated manifest paths and a junction source before writes', async () => {
    const file = path.join(source, 'manifest.json'),
      bytes = await fs.readFile(file),
      value = JSON.parse(bytes.toString());
    value.files.push(value.files[0]);
    await fs.writeFile(file, JSON.stringify(value));
    expect(run(['setup', 'install', '--source', source, '--install-root', root]).code).toBe(4);
    await fs.writeFile(file, bytes);
    const junction = path.join(directory, 'junction-source');
    await fs.symlink(source, junction, 'junction');
    expect(run(['setup', 'install', '--source', junction, '--install-root', root]).code).toBe(4);
    await fs.unlink(junction);
  });
  it('installs, verifies and repeats without changes', { timeout: 30000 }, () => {
    expect(run(['setup', 'install', '--source', source, '--install-root', root]).code).toBe(0);
    expect(run(['setup', 'status', '--install-root', root]).data.installed).toBe(true);
    const repeat = run(['setup', 'install', '--source', source, '--install-root', root]);
    expect(repeat.data.changed, JSON.stringify(repeat)).toBe(false);
  });
  it('OS ownership blocks a concurrent installation', async () => {
    const lease = await ProjectLease.acquire(path.join(root, 'installation.json'), 'test');
    try {
      expect(run(['setup', 'install', '--source', source, '--install-root', root]).code).toBe(4);
    } finally {
      await lease.release();
    }
    firstRecord = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
  });
  it('refuses a modified managed launcher', async () => {
    const file = path.join(root, 'bin/puzzle.cmd'),
      bytes = await fs.readFile(file);
    await fs.appendFile(file, 'foreign');
    expect(run(['setup', 'uninstall', '--install-root', root]).code).toBe(4);
    await fs.writeFile(file, bytes);
  });
  it('upgrades only after package verification, keeping the old version', async () => {
    const before = run(['setup', 'status', '--install-root', root]).data.activeVersion;
    await manifest();
    const r = run(['setup', 'install', '--source', source, '--install-root', root]);
    expect(r.code, JSON.stringify(r)).toBe(0);
    expect(r.data.activeVersion).not.toBe(before);
    expect(run(['setup', 'status', '--install-root', root]).data.versions).toHaveLength(2);
  });
  it('recovers a known interrupted activation to the old verified version', async () => {
    const after = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
    const currentPath = run(['setup', 'status', '--install-root', root]).data.path;
    const journal = {
      schemaVersion: 1,
      owner: 'PuzzleEditorCLI',
      kind: 'install',
      committed: false,
      before: firstRecord,
      after,
      registryKey: registry,
      beforePath: currentPath,
      afterPath: currentPath,
      newVersion: after.versions[1],
      tombstone: null,
    };
    await fs.writeFile(path.join(root, 'installation-transaction.json'), JSON.stringify(journal));
    expect(run(['setup', 'recover', '--install-root', root]).code).toBe(0);
    expect(run(['setup', 'status', '--install-root', root]).data.versions).toHaveLength(1);
  });
  it('refuses recovery when PATH differs from both recorded snapshots', async () => {
    const after = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
    const journalFile = path.join(root, 'installation-transaction.json');
    await fs.writeFile(
      journalFile,
      JSON.stringify({
        schemaVersion: 1,
        owner: 'PuzzleEditorCLI',
        kind: 'install',
        committed: false,
        before: after,
        after,
        registryKey: registry,
        beforePath: { value: 'foreign-before', kind: 'String' },
        afterPath: { value: 'foreign-after', kind: 'String' },
        newVersion: null,
        tombstone: null,
      }),
    );
    expect(run(['setup', 'recover', '--install-root', root]).code).toBe(4);
    expect(JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'))).toEqual(
      after,
    );
    await fs.unlink(journalFile);
  });
  it('uninstall preview is read-only', () => {
    expect(run(['setup', 'uninstall', '--install-root', root, '--dry-run']).code).toBe(0);
    expect(run(['setup', 'status', '--install-root', root]).data.installed).toBe(true);
  });
  it('an installed runtime refuses to delete itself', () => {
    const active = run(['setup', 'status', '--install-root', root]).data.activeVersion;
    expect(
      run(
        ['setup', 'uninstall'],
        path.join(root, 'versions', active, 'runtime/node.exe'),
        path.join(root, 'versions', active, 'app/cli.js'),
      ).code,
    ).toBe(4);
  });
  it('unknown files block deletion', async () => {
    const active = run(['setup', 'status', '--install-root', root]).data.activeVersion;
    const file = path.join(root, 'versions', active, 'foreign.txt');
    await fs.writeFile(file, 'keep');
    expect(run(['setup', 'uninstall', '--install-root', root]).code).toBe(4);
    expect(await fs.readFile(file, 'utf8')).toBe('keep');
    await fs.unlink(file);
  });
  it('removes owned files and PATH, preserving unrelated user configuration', async () => {
    await fs.writeFile(path.join(root, 'config.json'), '{}');
    expect(run(['setup', 'uninstall', '--install-root', root]).code).toBe(0);
    expect(run(['setup', 'status', '--install-root', root]).data.installed).toBe(false);
    expect(await fs.readFile(path.join(root, 'config.json'), 'utf8')).toBe('{}');
    expect(run(['setup', 'status', '--install-root', root]).data.path.value).toBe(null);
  });
  it('preserves a long unexpanded PATH and its registry type', () => {
    const value =
      '%LOCALAPPDATA%\\Other;' +
      Array.from({ length: 150 }, (_, i) => 'C:\\Other Paths\\Directory ' + i).join(';');
    const seed = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "$k=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($env:PUZZLE_EDITOR_TEST_REGISTRY_KEY); $k.SetValue('Path',$env:PUZZLE_TOOLING_PATH,[Microsoft.Win32.RegistryValueKind]::ExpandString); $k.Dispose()",
      ],
      { env: { ...env(), PUZZLE_TOOLING_PATH: value }, windowsHide: true },
    );
    expect(seed.status).toBe(0);
    expect(run(['setup', 'install', '--source', source, '--install-root', root]).code).toBe(0);
    expect(run(['setup', 'status', '--install-root', root]).data.path.value).toBe(
      value + ';' + path.join(root, 'bin'),
    );
    expect(run(['setup', 'uninstall', '--install-root', root]).code).toBe(0);
    expect(run(['setup', 'status', '--install-root', root]).data.path).toEqual({
      value,
      kind: 'ExpandString',
    });
  });
  it('distinguishes an originally empty PATH from an absent value', () => {
    const seed = spawnSync(
      path.join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      [
        '-NoProfile',
        '-Command',
        "$k=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($env:PUZZLE_EDITOR_TEST_REGISTRY_KEY); $k.SetValue('Path','',[Microsoft.Win32.RegistryValueKind]::String); $k.Dispose()",
      ],
      { env: env(), windowsHide: true },
    );
    expect(seed.status).toBe(0);
    expect(run(['setup', 'install', '--source', source, '--install-root', root]).code).toBe(0);
    expect(run(['setup', 'uninstall', '--install-root', root]).code).toBe(0);
    expect(run(['setup', 'status', '--install-root', root]).data.path).toEqual({
      value: '',
      kind: 'String',
    });
  });
});
describe('Tooling path contract', () => {
  it.each([
    '../outside',
    '/absolute',
    'app\\cli.js',
    'app/../cli.js',
    'app/con.txt',
    'app/file.',
    'C:/file',
    'a//b',
    'a\u0000b',
  ])('rejects unsafe package path %s', (value) =>
    expect(packagePathSchema.safeParse(value).success).toBe(false),
  );
});
describe('C13 read-only configuration', () => {
  it('rejects invalid UTF-8 configuration without changing it', async () => {
    const file = path.join(directory, 'bad-utf8.json'),
      bytes = Buffer.from([0xff, 0xfe, 1]);
    await fs.writeFile(file, bytes);
    expect(run(['config', 'show', '--config', file]).error.code).toBe('INVALID_UTF8');
    expect(await fs.readFile(file)).toEqual(bytes);
  });
  it('missing config remains absent', async () => {
    const file = path.join(directory, 'missing/config.json');
    expect(run(['config', 'path', '--config', file]).data.exists).toBe(false);
    expect(run(['config', 'show', '--config', file]).data.raw).toBe(null);
    expect(await fs.stat(path.dirname(file)).catch(() => null)).toBe(null);
  });
  it('resolves file-relative paths and reports environment precedence', async () => {
    const file = path.join(directory, 'config.json');
    const text = JSON.stringify({
      schemaVersion: 1,
      desktopExecutable: 'desktop/Puzzle Editor.exe',
    });
    await fs.writeFile(file, text);
    const r = run(['config', 'show', '--config', file]);
    expect(r.data.effective.desktopExecutable).toBe(
      path.join(directory, 'desktop/Puzzle Editor.exe'),
    );
    expect(r.data.sources.desktopExecutable).toBe('config-file');
    const override = run(['config', 'show'], process.execPath, binary, {
      PUZZLE_EDITOR_CLI_CONFIG: file,
      PUZZLE_EDITOR_DESKTOP_EXECUTABLE: 'override.exe',
    });
    expect(override.data.config.source).toBe('environment');
    expect(override.data.sources.desktopExecutable).toBe('environment');
    expect(await fs.readFile(file, 'utf8')).toBe(text);
  });
  it.each([
    '{"schemaVersion":2}',
    '{"schemaVersion":1,"allowOverwrite":true}',
    '{"schemaVersion":1,"schemaVersion":1}',
    '{',
  ])('rejects invalid optional configuration without mutation: %s', async (text) => {
    const file = path.join(directory, 'invalid.json');
    await fs.writeFile(file, text);
    expect(run(['config', 'show', '--config', file]).code).toBe(text === '{' ? 3 : 2);
    expect(run(['config', 'path', '--config', file]).data.exists).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe(text);
    expect(run(['describe']).code).toBe(0);
  });
});
describe('C14 Skill lifecycle', () => {
  const targetArgs = (scope = 'user') => [
    '--agent',
    'codex',
    '--scope',
    scope,
    '--install-root',
    root,
    ...(scope === 'project' ? ['--project-root', directory] : []),
  ];
  it('reads the same maintained guide and Skill offline', async () => {
    const result = run(['skills', 'read', 'puzzle-editor']);
    expect(result.code).toBe(0);
    expect(result.data.files['references/cli-guide.md']).toBe(
      (await publicSkillFiles(path.resolve('.')))['references/cli-guide.md'],
    );
    expect(run(['skills', 'list']).data.skills[0].name).toBe('puzzle-editor');
  });
  it('previews user installation without creating a Skill target', async () => {
    expect(run(['skills', 'install', ...targetArgs(), '--dry-run']).code).toBe(0);
    expect(await fs.stat(path.join(directory, 'home/.agents')).catch(() => null)).toBe(null);
  });
  it('installs and repeats idempotently', () => {
    const r = run(['skills', 'install', ...targetArgs()]);
    expect(r.code, JSON.stringify(r)).toBe(0);
    expect(run(['skills', 'status', ...targetArgs()]).data).toMatchObject({
      installed: true,
      managed: true,
      hostDiscovery: 'not-verified',
    });
    expect(run(['skills', 'install', ...targetArgs()]).data.changed).toBe(false);
  });
  it('upgrades a legacy four-file Skill in the same phase by content fingerprints', async () => {
    const current = run(['skills', 'status', ...targetArgs()]).data;
    const record = JSON.parse(await fs.readFile(current.record, 'utf8'));
    const oldNames = new Set([
      'SKILL.md',
      'agents/openai.yaml',
      'references/cli-guide.md',
      'compatibility.json',
    ]);
    for (const file of record.files)
      if (!oldNames.has(file.path)) await fs.unlink(path.join(current.target, file.path));
    await fs.rmdir(path.join(current.target, 'references/examples'));
    record.files = record.files.filter((file: { path: string }) => oldNames.has(file.path));
    const legacy = '# Earlier public guide\n';
    await fs.writeFile(path.join(current.target, 'references/cli-guide.md'), legacy);
    const guide = record.files.find(
      (file: { path: string }) => file.path === 'references/cli-guide.md',
    );
    Object.assign(guide, { size: Buffer.byteLength(legacy), sha256: hash(Buffer.from(legacy)) });
    await fs.writeFile(current.record, JSON.stringify(record));
    const legacyStatus = run(['skills', 'status', ...targetArgs()]);
    expect(legacyStatus.code, JSON.stringify(legacyStatus)).toBe(0);
    expect(legacyStatus.data.updateAvailable).toBe(true);
    expect(run(['skills', 'install', ...targetArgs(), '--dry-run']).code).toBe(0);
    expect(run(['skills', 'install', ...targetArgs()]).data.changed).toBe(true);
    const after = run(['skills', 'status', ...targetArgs()]);
    expect(after.data.updateAvailable).toBe(false);
    expect(
      await fs.readFile(path.join(after.data.target, 'references/commands-session.md'), 'utf8'),
    ).toContain('session save');
    expect(run(['skills', 'install', ...targetArgs()]).data.changed).toBe(false);
  });
  it('recovers an interrupted Skill removal and resumes committed cleanup', async () => {
    const status = run(['skills', 'status', ...targetArgs()]).data;
    const record = JSON.parse(await fs.readFile(status.record, 'utf8'));
    for (const committed of [false, true]) {
      const suffix = randomUUID(),
        backup = status.target + '.old-' + suffix;
      await fs.rename(status.target, backup);
      await fs.unlink(status.record);
      await fs.writeFile(
        status.record + '.transaction.json',
        JSON.stringify({ before: record, after: null, committed, suffix }),
      );
      if (committed) await fs.unlink(path.join(backup, 'compatibility.json'));
      const result = run(['skills', 'recover', ...targetArgs()]);
      expect(result.code, JSON.stringify(result)).toBe(0);
      expect(run(['skills', 'status', ...targetArgs()]).data.installed).toBe(!committed);
      if (committed) expect(run(['skills', 'install', ...targetArgs()]).code).toBe(0);
    }
  });
  it('refuses user-modified content during update/removal', async () => {
    const file = path.join(directory, 'home/.agents/skills/puzzle-editor/SKILL.md'),
      text = await fs.readFile(file);
    await fs.appendFile(file, 'User change');
    expect(run(['skills', 'install', ...targetArgs()]).code).toBe(4);
    expect(run(['skills', 'uninstall', ...targetArgs()]).code).toBe(4);
    await fs.writeFile(file, text);
  });
  it('supports project scope and preserves external same-name skills', async () => {
    const external = path.join(directory, '.agents/skills/puzzle-editor');
    await fs.mkdir(external, { recursive: true });
    await fs.writeFile(path.join(external, 'SKILL.md'), 'External');
    expect(run(['skills', 'install', ...targetArgs('project')]).code).toBe(4);
    expect(run(['skills', 'status', ...targetArgs('project')]).data.managed).toBe(false);
    await fs.unlink(path.join(external, 'SKILL.md'));
    await fs.rmdir(external);
    expect(run(['skills', 'install', ...targetArgs('project')]).code).toBe(0);
    expect(run(['skills', 'uninstall', ...targetArgs('project')]).code).toBe(0);
  });
  it('removes only owned user Skill, leaving neighbors', async () => {
    const neighbor = path.join(directory, 'home/.agents/skills/other');
    await fs.mkdir(neighbor);
    await fs.writeFile(path.join(neighbor, 'SKILL.md'), 'Keep');
    expect(run(['skills', 'uninstall', ...targetArgs(), '--dry-run']).code).toBe(0);
    expect(run(['skills', 'uninstall', ...targetArgs()]).code).toBe(0);
    expect(await fs.readFile(path.join(neighbor, 'SKILL.md'), 'utf8')).toBe('Keep');
  });
  it('requires explicit scope, supported agent and project target', () => {
    for (const args of [
      ['skills', 'install'],
      ['skills', 'install', '--agent', 'other', '--scope', 'user'],
      ['skills', 'install', '--agent', 'codex', '--scope', 'project'],
      ['skills', 'read', 'other'],
    ])
      expect(run(args).code).toBe(2);
  });
});
describe('C15 doctor', () => {
  const options = () => ['--install-root', path.join(directory, 'doctor-root')];
  it('healthy portable mode permits optional absences and makes no directories', async () => {
    const r = run(['doctor', '--offline', ...options()]);
    expect(r.code, JSON.stringify(r)).toBe(0);
    expect(r.data.healthy).toBe(true);
    expect(r.data.checks.find((c: { code: string }) => c.code === 'ONLINE_SESSION').status).toBe(
      'skip',
    );
    expect(await fs.stat(path.join(directory, 'doctor-root')).catch(() => null)).toBe(null);
  });
  it('aggregates failures and continues independent checks', async () => {
    const file = path.join(directory, 'doctor-config.json');
    await fs.writeFile(file, '{"schemaVersion":1,"allowOverwrite":true}');
    const r = run(['doctor', '--config', file, '--project', 'missing.puzzle.json', ...options()]);
    expect(r.code).toBe(3);
    for (const code of ['CONFIG', 'PROJECT', 'COMMAND_PATH', 'SESSION_DIRECTORY'])
      expect(r.data.checks.some((c: { code: string }) => c.code === code)).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe('{"schemaVersion":1,"allowOverwrite":true}');
  });
  it('checks an explicit valid project without changing its bytes', async () => {
    const file = path.join(directory, 'doctor.puzzle.json');
    expect(
      run(['create', '--name', 'Doctor', '--root-asset-name', 'DoctorRoot', '--out', file]).code,
    ).toBe(0);
    const before = await fs.readFile(file);
    const r = run(['doctor', '--project', file, ...options()]);
    expect(r.code, JSON.stringify(r)).toBe(0);
    expect(r.data.checks.find((c: { code: string }) => c.code === 'PROJECT').status).toBe('pass');
    expect(await fs.readFile(file)).toEqual(before);
  });
  it('explicit unavailable online session fails without registration secrets', () => {
    const r = run([
      'doctor',
      '--online',
      '--instance',
      randomUUID(),
      '--session',
      '1',
      ...options(),
    ]);
    expect(r.code).toBe(3);
    expect(r.data.checks.find((c: { code: string }) => c.code === 'ONLINE_SESSION').status).toBe(
      'fail',
    );
    expect(JSON.stringify(r)).not.toContain('"secret"');
  });
  it('observes an external command without editing PATH', async () => {
    const shadow = path.join(directory, 'shadow');
    await fs.mkdir(shadow);
    await fs.writeFile(path.join(shadow, 'puzzle.cmd'), '@echo off');
    const r = run(['doctor', ...options()], process.execPath, binary, { PATH: shadow });
    expect(r.code).toBe(0);
    expect(r.data.checks.find((c: { code: string }) => c.code === 'COMMAND_PATH').status).toBe(
      'warn',
    );
  });
  it('rejects ambiguous online arguments', () => {
    for (const args of [
      ['--online'],
      ['--instance', randomUUID()],
      ['--online', '--offline', '--instance', randomUUID(), '--session', '0'],
    ])
      expect(run(['doctor', ...args]).code).toBe(2);
  });
});

/** 从 ZIP 解压到仓库外，清除 Node PATH 后直接运行 Windows 启动器并核对真实文件。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { hash, removeOwnedDirectory } from './cli-package-io.mjs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const zip = path.resolve(process.argv[2] ?? '');
if (process.platform !== 'win32' || !process.argv[2] || !zip.endsWith('.zip'))
  throw new Error('Usage: node scripts/verify-cli-package.mjs <package.zip> [evidence.json]');
const system = process.env.SystemRoot ?? 'C:\\Windows';
const powershell = path.join(system, 'System32/WindowsPowerShell/v1.0/powershell.exe');
const isolated = await fs.mkdtemp(path.join(tmpdir(), 'puzzle-cli-release-'));
const testRoot = path.join(isolated, '中文 独立发行');
const checks = [];
const testRegistry = 'Software\\PuzzleEditorCLI\\Tests\\' + randomUUID() + '\\Environment';
const expect = (ok, message) => {
  if (!ok) throw new Error(message);
  checks.push(message);
};
try {
  const unzip = spawnSync(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $env:PUZZLE_CLI_ZIP -DestinationPath $env:PUZZLE_CLI_TEST",
    ],
    {
      windowsHide: true,
      encoding: 'utf8',
      env: { ...process.env, PUZZLE_CLI_ZIP: zip, PUZZLE_CLI_TEST: testRoot },
    },
  );
  expect(unzip.status === 0, 'ZIP extraction outside repository');
  const [folder] = await fs.readdir(testRoot);
  const app = path.join(testRoot, folder);
  const manifest = JSON.parse(await fs.readFile(path.join(app, 'manifest.json'), 'utf8'));
  for (const entry of manifest.files) {
    const file = path.resolve(app, entry.path);
    const relative = path.relative(app, file);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Manifest path escaped package.');
    const bytes = await fs.readFile(file);
    expect(
      bytes.length === entry.size && hash(bytes) === entry.sha256,
      `Package hash: ${entry.path}`,
    );
  }
  expect(
    !(await fs.readdir(app)).some((name) =>
      ['node_modules', 'src', 'store', 'services'].includes(name),
    ),
    'No source or development dependencies',
  );
  const work = path.join(isolated, '中文 工程');
  await fs.mkdir(work);
  const env = {
    ...process.env,
    PATH: path.join(system, 'System32'),
    APPDATA: path.join(isolated, 'prefs'),
    LOCALAPPDATA: path.join(isolated, 'prefs'),
    USERPROFILE: path.join(isolated, 'home'),
    PUZZLE_EDITOR_TEST_REGISTRY_KEY: testRegistry,
  };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  const missingNode = spawnSync(path.join(system, 'System32/where.exe'), ['node'], {
    cwd: work,
    env,
    windowsHide: true,
  });
  expect(missingNode.status !== 0, 'Global Node unavailable on isolated PATH');
  let launcher = path.join(app, 'puzzle.cmd');
  const run = (args, expectedCode = 0) => {
    // 验证参数全由本脚本生成；避免让 cmd 元字符或变量展开混入命令。
    if ([launcher, ...args].some((value) => /["%!\r\n]/.test(value)))
      throw new Error('Unsupported test command quoting.');
    const command = `""${launcher}" ${args.map((value) => `"${value}"`).join(' ')}"`;
    const result = spawnSync(path.join(system, 'System32/cmd.exe'), ['/d', '/s', '/c', command], {
      cwd: work,
      env,
      windowsHide: true,
      windowsVerbatimArguments: true,
      encoding: 'utf8',
      timeout: 20000,
    });
    expect(
      result.status === expectedCode && !result.stderr,
      `Launcher ${args.slice(0, 2).join(' ')} exit ${expectedCode}: ${result.stderr || result.stdout.slice(0, 80)}`,
    );
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok === (expectedCode === 0), `JSON result: ${args[0]}`);
    return parsed;
  };
  const described = run(['describe', '--json']).data;
  expect(
    described.phase === manifest.phase,
    `Standalone ${manifest.phase} capabilities match manifest`,
  );
  run([
    'create',
    '--name',
    'Isolated Package',
    '--root-asset-name',
    'PackageRoot',
    '--out',
    '源 文件.puzzle.json',
    '--json',
  ]);
  const source = path.join(work, '源 文件.puzzle.json');
  const original = await fs.readFile(source);
  const inspected = run(['inspect', '源 文件.puzzle.json', '--json']);
  await fs.writeFile(
    path.join(work, 'plan.json'),
    JSON.stringify({
      apiVersion: '1.0.0',
      sourceHash: inspected.data.source.sha256,
      scope: { project: true },
      commands: [
        { op: 'project.update', changes: { description: 'Domain path remains available' } },
      ],
    }),
    'utf8',
  );
  run(['preview', '源 文件.puzzle.json', '--plan', 'plan.json', '--receipt-out', 'receipt.json']);
  run([
    'apply',
    '源 文件.puzzle.json',
    '--plan',
    'plan.json',
    '--receipt',
    'receipt.json',
    '--out',
    'domain.puzzle.json',
  ]);
  const raw = JSON.parse((await fs.readFile(source)).toString('utf8'));
  raw.project.meta.description = 'Authorized fixture raw edit';
  const candidate = '\uFEFF' + JSON.stringify(raw, null, 3) + '\r\n';
  await fs.writeFile(path.join(work, 'candidate.json'), candidate, 'utf8');
  run([
    'json',
    'preview',
    '源 文件.puzzle.json',
    '--candidate',
    'candidate.json',
    '--out',
    'raw.puzzle.json',
    '--receipt-out',
    'raw-receipt.json',
  ]);
  const rawArgs = [
    'json',
    'apply',
    '源 文件.puzzle.json',
    '--candidate',
    'candidate.json',
    '--out',
    'raw.puzzle.json',
    '--receipt',
    'raw-receipt.json',
  ];
  expect(
    run(rawArgs, 6).error.code === 'RAW_JSON_AUTHORIZATION_REQUIRED',
    'Missing raw declaration rejected',
  );
  run([...rawArgs, '--allow-raw-json-write']);
  expect(
    (await fs.readFile(path.join(work, 'raw.puzzle.json'))).equals(Buffer.from(candidate)),
    'Exact candidate bytes in packaged raw apply',
  );
  expect(
    run([...rawArgs, '--allow-raw-json-write']).data.status === 'already-applied',
    'Packaged retry preserves one output',
  );
  run(['validate', 'raw.puzzle.json']);
  run(['export', 'raw.puzzle.json', '--out', 'runtime.export.json']);
  // 新包的兼容转换必须经过真实启动器；旧包仍能使用其自身支持的验证范围。
  if (
    described.capabilities.some((item) => item.operation === 'import apply' && item.implemented)
  ) {
    const runtime = await fs.readFile(path.join(work, 'runtime.export.json'));
    const preview = run([
      'import',
      'preview',
      'runtime.export.json',
      '--out',
      'converted.puzzle.json',
      '--receipt-out',
      'import-receipt.json',
    ]);
    const args = [
      'import',
      'apply',
      'runtime.export.json',
      '--out',
      'converted.puzzle.json',
      '--receipt',
      'import-receipt.json',
    ];
    const converted = run(args);
    expect(
      converted.data.output.sha256 === preview.data.candidateHash,
      'Packaged import reconstructs preview bytes',
    );
    expect(run(args).data.status === 'already-applied', 'Packaged import retry is idempotent');
    run(['validate', 'converted.puzzle.json']);
    run(['export', 'converted.puzzle.json', '--out', 'converted.export.json']);
    expect(
      JSON.stringify(
        JSON.parse(await fs.readFile(path.join(work, 'converted.export.json'), 'utf8')).data,
      ) === JSON.stringify(JSON.parse(runtime).data),
      'Packaged conversion retains runtime data',
    );
    expect(
      (await fs.readFile(path.join(work, 'runtime.export.json'))).equals(runtime),
      'Packaged import source remains unchanged',
    );
  }
  expect((await fs.readFile(source)).equals(original), 'Source remains unchanged');
  // C8 在独立副本上验证覆盖；最高权限声明仅供此隔离测试夹具使用。
  if (described.authorizationCapabilities.overwrite_project.implemented) {
    await fs.copyFile(source, path.join(work, '覆盖.puzzle.json'));
    run([
      'preview',
      '覆盖.puzzle.json',
      '--plan',
      'plan.json',
      '--in-place',
      '--receipt-out',
      'overwrite-receipt.json',
    ]);
    const args = [
      'apply',
      '覆盖.puzzle.json',
      '--plan',
      'plan.json',
      '--receipt',
      'overwrite-receipt.json',
      '--in-place',
    ];
    run(args, 6);
    expect(
      (await fs.readFile(path.join(work, '覆盖.puzzle.json'))).equals(original),
      'Missing overwrite permission leaves original bytes',
    );
    const applied = run([...args, '--allow-overwrite']);
    expect(
      (await fs.readFile(applied.data.backup.path)).equals(original),
      'Packaged overwrite backup matches original bytes',
    );
    expect(
      run([...args, '--allow-overwrite']).data.status === 'already-applied',
      'Packaged domain overwrite retry is idempotent',
    );
    run([
      'json',
      'preview',
      '覆盖.puzzle.json',
      '--candidate',
      'candidate.json',
      '--in-place',
      '--receipt-out',
      'raw-overwrite-receipt.json',
    ]);
    const rawOverwrite = [
      'json',
      'apply',
      '覆盖.puzzle.json',
      '--candidate',
      'candidate.json',
      '--in-place',
      '--receipt',
      'raw-overwrite-receipt.json',
    ];
    run([...rawOverwrite, '--allow-raw-json-write'], 6);
    run([...rawOverwrite, '--allow-overwrite'], 6);
    run([...rawOverwrite, '--allow-overwrite', '--allow-raw-json-write']);
    expect(
      (await fs.readFile(path.join(work, '覆盖.puzzle.json'))).equals(Buffer.from(candidate)),
      'Packaged raw overwrite retains exact BOM and bytes',
    );
    expect(
      run([...rawOverwrite, '--allow-overwrite', '--allow-raw-json-write']).data.status ===
        'already-applied',
      'Packaged raw overwrite retry is idempotent',
    );
    run(['validate', '覆盖.puzzle.json']);
  }
  expect(!(await fs.readdir(isolated)).includes('prefs'), 'No editor preferences created');
  // 配套能力通过真实 ZIP/启动器验收；PATH 仅写独立 HKCU 测试键。
  if (Number(manifest.phase.slice(1)) >= 16) {
    const installRoot = path.join(isolated, '全局 安装');
    run(['version']);
    expect(run(['config', 'show']).data.raw === null, 'Absent config remains absent');
    const guide = run(['skills', 'read', 'puzzle-editor']).data.files['references/cli-guide.md'];
    expect(
      guide === (await fs.readFile(path.join(app, 'AGENTS.md'), 'utf8')),
      'Skill and AGENTS share one guide',
    );
    run(['doctor', '--offline', '--project', source]);
    const entry = spawnSync(
      powershell,
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(app, 'install-cli.ps1'),
        '--install-root',
        installRoot,
        '--dry-run',
      ],
      { env, cwd: work, encoding: 'utf8', windowsHide: true, timeout: 30000 },
    );
    expect(
      entry.status === 0 && JSON.parse(entry.stdout).ok,
      'Packaged install PowerShell entry dry-run',
    );
    expect(
      !(await fs.stat(installRoot).then(
        () => true,
        () => false,
      )),
      'Install dry-run creates no root',
    );
    run(['setup', 'install', '--source', app, '--install-root', installRoot]);
    launcher = path.join(installRoot, 'bin/puzzle.cmd');
    const info = run(['version']).data;
    expect(
      info.cliEntry.startsWith(installRoot),
      'Stable command runs the installed bundled runtime',
    );
    expect(
      run(['config', 'show']).data.installation.mode === 'installed',
      'Installed config mode detected',
    );
    const fresh = spawnSync(
      powershell,
      [
        '-NoProfile',
        '-Command',
        '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $k=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($env:PUZZLE_EDITOR_TEST_REGISTRY_KEY); $raw=$k.GetValue("Path"); $k.Dispose(); $env:PATH=$env:SystemRoot+"\\System32;"+$raw; & puzzle version; exit $LASTEXITCODE',
      ],
      { env, cwd: work, encoding: 'utf8', windowsHide: true, timeout: 30000 },
    );
    expect(
      fresh.status === 0 && JSON.parse(fresh.stdout).data.cliEntry === info.cliEntry,
      'New process resolves puzzle from persistent isolated registry PATH',
    );
    const skillArgs = ['--agent', 'codex', '--scope', 'project', '--project-root', work];
    run(['skills', 'install', ...skillArgs, '--dry-run']);
    run(['skills', 'install', ...skillArgs]);
    expect(
      run(['skills', 'status', ...skillArgs]).data.managed,
      'Packaged project Skill ownership',
    );
    run(['skills', 'uninstall', ...skillArgs]);
    run(['doctor', '--offline', '--project', source]);
    const activeAgentGuide = path.join(path.dirname(path.dirname(info.cliEntry)), 'AGENTS.md');
    const activeGuideBytes = await fs.readFile(activeAgentGuide);
    await fs.appendFile(activeAgentGuide, 'Corruption fixture');
    const brokenDoctor = run(['doctor', '--offline'], 3);
    expect(
      brokenDoctor.data.checks.some((check) => check.code === 'PACKAGE' && check.status === 'fail'),
      'Doctor reports actual package corruption while aggregating checks',
    );
    await fs.writeFile(activeAgentGuide, activeGuideBytes);
    const upgraded = path.join(isolated, 'upgrade-source');
    await fs.cp(app, upgraded, { recursive: true });
    const upgradeManifest = { ...manifest, createdAt: new Date().toISOString() };
    await fs.writeFile(
      path.join(upgraded, 'manifest.json'),
      JSON.stringify(upgradeManifest, null, 2) + '\n',
    );
    run(['setup', 'install', '--source', upgraded]);
    expect(
      run(['setup', 'status']).data.versions.length === 2,
      'Verified upgrade retains previous version',
    );
    run(['setup', 'uninstall', '--dry-run']);
    const required = run(['setup', 'uninstall'], 4);
    expect(
      required.error.code === 'EXTERNAL_UNINSTALLER_REQUIRED',
      'Installed launcher refuses self deletion with an explicit external entry',
    );
    const removal = spawnSync(required.data.executable, required.data.args, {
      env,
      cwd: work,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    });
    expect(
      removal.status === 0 && !removal.stderr && JSON.parse(removal.stdout).ok,
      'External PowerShell uninstaller removes managed files without CMD self-deletion errors',
    );
    launcher = path.join(app, 'puzzle.cmd');
    const status = run(['setup', 'status', '--install-root', installRoot]).data;
    expect(
      !status.installed && status.path.value === null,
      'Launcher uninstall removes owned versions and isolated PATH',
    );
    expect(
      !(await fs.stat(path.join(work, '.agents/skills/puzzle-editor')).then(
        () => true,
        () => false,
      )),
      'Skill target removed without touching project',
    );
    expect(
      (await fs.readFile(source)).equals(original),
      'Management leaves source project bytes unchanged',
    );
  }
  const evidence = {
    verifiedAt: new Date().toISOString(),
    zip,
    zipSha256: hash(await fs.readFile(zip)),
    runtime: manifest.runtime,
    checks,
    success: true,
  };
  if (process.argv[3])
    await fs.writeFile(
      path.resolve(process.argv[3]),
      JSON.stringify(evidence, null, 2) + '\n',
      'utf8',
    );
  console.log(
    JSON.stringify({ success: true, checks: checks.length, zipSha256: evidence.zipSha256 }),
  );
} finally {
  spawnSync(
    powershell,
    [
      '-NoProfile',
      '-Command',
      'Remove-Item -LiteralPath ("HKCU:\\"+$env:PUZZLE_EDITOR_TEST_REGISTRY_KEY) -Recurse -Force -ErrorAction SilentlyContinue',
    ],
    { env: { ...process.env, PUZZLE_EDITOR_TEST_REGISTRY_KEY: testRegistry }, windowsHide: true },
  );
  await removeOwnedDirectory(tmpdir(), isolated, 'puzzle-cli-release-');
}

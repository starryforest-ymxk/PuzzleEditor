/** 固定官方运行时并生成自足发行包；只创建新输出，不修改系统 PATH 或用户工程。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, inside, removeOwnedDirectory } from './cli-package-io.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = path.join(root, 'release');
// 批次从实际构建的能力表读取，避免源码升级后发行目录、清单和检查仍绑定旧批次。
const builtDescribe = spawnSync(
  process.execPath,
  [path.join(root, 'dist-cli/cli.js'), 'describe'],
  {
    encoding: 'utf8',
    windowsHide: true,
  },
);
if (builtDescribe.status !== 0) throw new Error('Build the CLI before packaging.');
const builtCapabilities = JSON.parse(builtDescribe.stdout);
const phase = builtCapabilities.data?.phase;
if (!builtCapabilities.ok || typeof phase !== 'string' || !/^C\d+$/.test(phase))
  throw new Error('Built CLI does not expose a valid phase.');
const packageRoot = path.resolve(root, process.argv[2] ?? `release/cli/${phase}`);
const json = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const powershell = path.join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
function shell(script, env) {
  const result = spawnSync(
    powershell,
    ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference = 'Stop'; " + script],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ...env },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'PowerShell failed.');
}

async function main() {
  if (process.platform !== 'win32' || !inside(release, packageRoot))
    throw new Error('Windows packaging requires a new output directory within release/.');
  const pkg = await json(path.join(root, 'package.json'));
  const lock = await json(path.join(root, 'cli/runtime-lock.json'));
  const name = `PuzzleEditor-CLI-${pkg.version}-win-x64`;
  const target = path.join(packageRoot, name);
  const zip = target + '.zip';
  // 实际父目录也必须在 release 内，不能借 junction 将写入重定向到无关目录。
  await fs.mkdir(release, { recursive: true });
  await fs.mkdir(packageRoot, { recursive: true });
  if (!inside(await fs.realpath(release), await fs.realpath(packageRoot)))
    throw new Error('Resolved package output escapes release/.');
  for (const file of [target, zip, zip + '.sha256.txt']) {
    try {
      await fs.lstat(file);
      throw new Error(`Output already exists: ${file}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const cache = path.join(release, 'cli-cache');
  await fs.mkdir(cache, { recursive: true });
  const archive = path.join(cache, lock.archive);
  try {
    await fs.access(archive);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await globalThis.fetch(lock.url, {
      signal: globalThis.AbortSignal.timeout(120000),
    });
    if (!response.ok)
      throw new Error(`Runtime download failed: ${response.status}`, { cause: error });
    await fs.writeFile(archive, Buffer.from(await response.arrayBuffer()), { flag: 'wx' });
  }
  if (hash(await fs.readFile(archive)) !== lock.sha256)
    throw new Error('Cached runtime archive does not match the pinned SHA-256.');
  const unpack = await fs.mkdtemp(path.join(cache, 'unpack-'));
  try {
    shell(
      'Expand-Archive -LiteralPath $env:PUZZLE_CLI_ARCHIVE -DestinationPath $env:PUZZLE_CLI_UNPACK',
      {
        PUZZLE_CLI_ARCHIVE: archive,
        PUZZLE_CLI_UNPACK: unpack,
      },
    );
    const runtimeRoot = path.join(unpack, `node-v${lock.version}-${lock.platform}`);
    const node = path.join(runtimeRoot, 'node.exe');
    const version = spawnSync(node, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (version.status !== 0 || version.stdout.trim() !== 'v' + lock.version)
      throw new Error('Extracted runtime version differs from the lock.');
    for (const child of ['app', 'runtime', 'licenses'])
      await fs.mkdir(path.join(target, child), { recursive: true });
    await fs.copyFile(node, path.join(target, 'runtime/node.exe'));
    await fs.copyFile(
      path.join(runtimeRoot, 'LICENSE'),
      path.join(target, 'licenses/Node-LICENSE.txt'),
    );
    await fs.copyFile(
      path.join(root, 'node_modules/zod/LICENSE'),
      path.join(target, 'licenses/Zod-LICENSE.txt'),
    );
    for (const file of ['cli.js', 'package.json'])
      await fs.copyFile(path.join(root, 'dist-cli', file), path.join(target, 'app', file));
    await fs.copyFile(
      path.join(root, 'overview/dev/CLI_Distribution_Guide.md'),
      path.join(target, 'AGENTS.md'),
    );
    await fs.copyFile(
      path.join(root, 'cli/runtime-lock.json'),
      path.join(target, 'runtime-lock.json'),
    );
    for (const file of ['install-cli.ps1', 'uninstall-cli.ps1'])
      await fs.copyFile(path.join(root, 'scripts', file), path.join(target, file));
    // 仅复制对外 Skill 所需入口与元数据，避免源码目录里的临时文件或开发记录进入包。
    for (const file of ['SKILL.md', 'agents/openai.yaml']) {
      const destination = path.join(target, 'agent-skills/puzzle-editor', file);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(root, 'agent-skills/puzzle-editor', file), destination);
    }
    const references = path.join(target, 'agent-skills/puzzle-editor/references');
    await fs.mkdir(references, { recursive: true });
    await fs.copyFile(
      path.join(root, 'overview/dev/CLI_Distribution_Guide.md'),
      path.join(references, 'cli-guide.md'),
    );
    await fs.writeFile(
      path.join(target, 'puzzle.cmd'),
      '@echo off\r\nsetlocal DisableDelayedExpansion\r\n"%~dp0runtime\\node.exe" "%~dp0app\\cli.js" %*\r\nexit /b %errorlevel%\r\n',
      { encoding: 'utf8', flag: 'wx' },
    );
    // 入门说明只有一个维护来源；包内将完整指南链接解析到随包提供的 AGENTS.md。
    const quickStart = await fs.readFile(
      path.join(root, 'overview/dev/CLI_Quick_Start.md'),
      'utf8',
    );
    await fs.writeFile(
      path.join(target, 'README.md'),
      quickStart.replaceAll('(./CLI_Distribution_Guide.md)', '(./AGENTS.md)'),
      'utf8',
    );
    const describe = spawnSync(node, [path.join(target, 'app/cli.js'), 'describe', '--json'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const capabilities = JSON.parse(describe.stdout);
    if (describe.status !== 0 || !capabilities.ok || capabilities.data.phase !== phase)
      throw new Error('Packaged CLI capabilities differ from the build.');
    await fs.writeFile(path.join(target, 'capabilities.json'), describe.stdout, 'utf8');
    const collect = async (directory) =>
      (
        await Promise.all(
          (await fs.readdir(directory, { withFileTypes: true })).map((entry) =>
            entry.isDirectory()
              ? collect(path.join(directory, entry.name))
              : [path.join(directory, entry.name)],
          ),
        )
      ).flat();
    const files = (await collect(target)).sort();
    const manifest = {
      name,
      version: pkg.version,
      phase,
      createdAt: new Date().toISOString(),
      runtime: lock,
      files: await Promise.all(
        files.map(async (file) => {
          const bytes = await fs.readFile(file);
          return {
            path: path.relative(target, file).replaceAll('\\', '/'),
            size: bytes.length,
            sha256: hash(bytes),
          };
        }),
      ),
    };
    await fs.writeFile(
      path.join(target, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf8',
    );
    shell(
      'Compress-Archive -LiteralPath $env:PUZZLE_CLI_PACKAGE -DestinationPath $env:PUZZLE_CLI_ZIP -CompressionLevel Optimal',
      { PUZZLE_CLI_PACKAGE: target, PUZZLE_CLI_ZIP: zip },
    );
    const sha256 = hash(await fs.readFile(zip));
    await fs.writeFile(zip + '.sha256.txt', `${sha256}  ${path.basename(zip)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    console.log(JSON.stringify({ package: target, zip, sha256, files: manifest.files.length }));
  } finally {
    await removeOwnedDirectory(cache, unpack, 'unpack-');
  }
}
await main();

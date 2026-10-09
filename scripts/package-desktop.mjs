/** 桌面构建保留资源编辑；只从校验后的官方工具归档提取 Windows 文件，避免 macOS 符号链接要求。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build, Platform, Arch } from 'electron-builder';
import { extractFile } from '@electron/asar';
import { inside } from './cli-package-io.mjs';
import {
  verifyWindowsIcon,
  windowsIconFilename,
  windowsIconInstallerInclude,
} from './windows-icons.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(
  root,
  process.argv[2] ?? 'release/desktop/build-' + new Date().toISOString().replaceAll(':', '-'),
);
const acceptance = process.argv.includes('--acceptance');
const checksum =
  'e8b408d9df413c2dd7b346684d07b5a37b4f880dbc73bf8f63af50f62fe90fc958e39a6c32d1ee2f0bf7bd1724895af7671d5c6cdc8b94147c493c0275c1f0b4';
const sha = (bytes) => createHash('sha512').update(bytes).digest('hex');
if (process.platform !== 'win32' || !inside(path.join(root, 'release'), output))
  throw new Error('Windows desktop packaging requires a new directory inside release/.');
try {
  await fs.lstat(output);
  throw new Error('Desktop release output already exists.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await fs.mkdir(path.dirname(output), { recursive: true });
if (!inside(await fs.realpath(path.join(root, 'release')), await fs.realpath(path.dirname(output))))
  throw new Error('Resolved desktop output parent escapes release/.');
const cache =
  process.env.ELECTRON_BUILDER_CACHE ??
  path.join(process.env.LOCALAPPDATA, 'electron-builder/Cache');
const toolParent = path.join(cache, 'winCodeSign');
const tool = path.join(toolParent, 'winCodeSign-2.6.0');
await fs.mkdir(toolParent, { recursive: true });
let archive;
for (const file of await fs.readdir(toolParent)) {
  if (file.endsWith('.7z')) {
    const candidate = path.join(toolParent, file);
    if (sha(await fs.readFile(candidate)) === checksum) {
      archive = candidate;
      break;
    }
  }
}
if (!archive) {
  const response = await globalThis.fetch(
    'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z',
    { signal: globalThis.AbortSignal.timeout(120000) },
  );
  if (!response.ok) throw new Error('Unable to download official Windows resource tools.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha(bytes) !== checksum) throw new Error('Windows resource tool archive checksum mismatch.');
  archive = path.join(toolParent, 'puzzle-verified-winCodeSign-2.6.0.7z');
  await fs.writeFile(archive, bytes, { flag: 'wx' });
}
// 标准工具目录只允许普通目录；不沿 junction/symlink 向其他位置写入。
try {
  if ((await fs.lstat(tool)).isSymbolicLink()) throw new Error('Unsafe resource tool directory.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const extract = spawnSync(
  path.join(root, 'node_modules/7zip-bin/win/x64/7za.exe'),
  ['x', archive, '-o' + tool, '-xr!darwin', '-xr!linux', '-y'],
  { windowsHide: true, encoding: 'utf8' },
);
if (extract.status !== 0)
  throw new Error('Verified Windows resource tool extraction failed: ' + extract.stderr);
for (const file of ['rcedit-x64.exe', 'rcedit-ia32.exe', 'windows-10/x64/signtool.exe'])
  await fs.access(path.join(tool, file));
const packageInfo = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const productName = acceptance ? 'Puzzle Editor C16 Acceptance' : packageInfo.build.productName;
const checks = [];
const iconBytes = await fs.readFile(path.join(root, 'public/icon.ico'));
const iconFilename = windowsIconFilename(iconBytes);
await fs.mkdir(output);
const iconInclude = path.join(output, 'windows-shortcut-icons.nsh');
await fs.writeFile(iconInclude, windowsIconInstallerInclude(iconFilename), 'utf8');
await build({
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  config: {
    ...(acceptance
      ? {
          appId: 'com.starrytree.puzzleeditor.c16.acceptance',
          productName,
        }
      : {}),
    directories: { output },
    // 独立 ICO 与 NSIS 钩子使用同一文件名来源；升级时包括被保留的快捷方式。
    extraResources: [{ from: path.join(root, 'public/icon.ico'), to: iconFilename }],
    nsis: {
      ...(acceptance
        ? {
            guid: 'ac41efc7-6b75-47bd-b6cb-9381a3c770ee',
            runAfterFinish: false,
            shortcutName: productName,
            uninstallDisplayName: productName,
          }
        : {}),
      include: iconInclude,
    },
    win: { signAndEditExecutable: true },
    afterSign: async ({ appOutDir }) => {
      const executable = path.join(appOutDir, productName + '.exe');
      const icon = verifyWindowsIcon(executable, path.join(root, 'public/icon.ico'));
      if (icon.productName !== productName) throw new Error('EXE product metadata mismatch.');
      const embedded = extractFile(path.join(appOutDir, 'resources/app.asar'), 'dist/icon.png');
      if (!embedded.equals(await fs.readFile(path.join(root, 'public/icon.png'))))
        throw new Error('Packaged window icon differs from the original PNG.');
      if (!(await fs.readFile(path.join(appOutDir, 'resources', iconFilename))).equals(iconBytes))
        throw new Error('Packaged standalone shortcut icon differs from the original ICO.');
      checks.push({ ...icon, packagedPngMatches: true, standaloneIcon: iconFilename });
    },
  },
});
if (!checks.length) throw new Error('Desktop resource verification was not executed.');
await fs.writeFile(
  path.join(output, 'icon-verification.json'),
  JSON.stringify(
    {
      tool: {
        version: '2.6.0',
        archiveSha512: checksum,
        source: 'electron-builder-binaries official release',
      },
      resourceEditing: true,
      checks,
    },
    null,
    2,
  ) + '\n',
);

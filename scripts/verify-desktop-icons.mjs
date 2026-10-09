/** 成品和临时快捷方式图标验收；所有写入位于隔离临时目录，不修改用户快捷方式。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { verifyWindowsIcon, windowsIconFilename } from './windows-icons.mjs';
import { hash, removeOwnedDirectory } from './cli-package-io.mjs';

const output = path.resolve(process.argv[2] ?? '');
const evidence = process.argv[3] ? path.resolve(process.argv[3]) : null;
const root = process.cwd();
const directory = await fs.mkdtemp(path.join(tmpdir(), 'puzzle-icon-'));
try {
  const exe = path.join(output, 'win-unpacked/Puzzle Editor.exe');
  const ico = path.join(root, 'public/icon.ico');
  const originalIco = await fs.readFile(ico);
  const shortcutIcon = path.join(
    output,
    'win-unpacked/resources',
    windowsIconFilename(originalIco),
  );
  if (!(await fs.readFile(shortcutIcon)).equals(originalIco))
    throw new Error('Standalone shortcut icon bytes do not match the original ICO.');
  const installer = path.join(output, 'Puzzle Editor Setup 1.0.0-beta.exe');
  const shortcut = path.join(directory, 'Puzzle Editor.lnk');
  const created = spawnSync(
    path.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `
$ErrorActionPreference = 'Stop'
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($env:PUZZLE_ICON_SHORTCUT)
$shortcut.TargetPath = $env:PUZZLE_ICON_EXE
$shortcut.IconLocation = $env:PUZZLE_SHORTCUT_ICON + ',0'
$shortcut.Save()
`,
    ],
    {
      env: {
        ...process.env,
        PUZZLE_ICON_EXE: exe,
        PUZZLE_ICON_SHORTCUT: shortcut,
        PUZZLE_SHORTCUT_ICON: shortcutIcon,
      },
      windowsHide: true,
      encoding: 'utf8',
    },
  );
  if (created.status !== 0) throw new Error(created.stderr);
  const checks = [
    verifyWindowsIcon(exe, ico, shortcut, shortcutIcon),
    verifyWindowsIcon(installer, ico),
  ];
  let defaultRejected = false;
  try {
    verifyWindowsIcon(path.join(root, 'node_modules/electron/dist/electron.exe'), ico);
  } catch {
    defaultRejected = true;
  }
  if (!defaultRejected) throw new Error('Default Electron icon must be rejected.');
  const result = {
    ok: true,
    checks,
    defaultElectronRejected: true,
    standaloneIcoMatches: true,
    originalAssets: {
      icoSha256: hash(await fs.readFile(ico)),
      pngSha256: hash(await fs.readFile(path.join(root, 'public/icon.png'))),
    },
    userInstallationChanged: false,
  };
  if (evidence) await fs.writeFile(evidence, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await removeOwnedDirectory(tmpdir(), directory, 'puzzle-icon-');
}

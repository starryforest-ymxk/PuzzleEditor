/** 独立 appId/产品名真实安装与升级；不操作用户现有 Puzzle Editor 安装和快捷方式。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { verifyWindowsIcon, windowsIconFilename } from './windows-icons.mjs';
import { hash, removeOwnedDirectory } from './cli-package-io.mjs';
const output = path.resolve(process.argv[2] ?? '');
const name = 'Puzzle Editor C16 Acceptance';
const guid = 'ac41efc7-6b75-47bd-b6cb-9381a3c770ee';
const installer = path.join(output, name + ' Setup 1.0.0-beta.exe');
const directory = await fs.mkdtemp(path.join(tmpdir(), 'puzzle-nsis-acceptance-中文 space-'));
const target = path.join(directory, 'app'),
  executable = path.join(target, name + '.exe');
const sourceIcon = path.resolve('public/icon.ico');
const iconBytes = await fs.readFile(sourceIcon);
const shortcutIcon = path.join(target, 'resources', windowsIconFilename(iconBytes));
const powershell = path.join(
  process.env.SystemRoot,
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const checks = [];
const assert = (value, message) => {
  if (!value) throw new Error(message);
  checks.push(message);
};
const query = () => {
  const result = spawnSync(
    powershell,
    [
      '-NoProfile',
      '-Command',
      '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $desktop=Join-Path ([Environment]::GetFolderPath("Desktop")) ($env:PUZZLE_NSIS_NAME+".lnk"); $start=Join-Path ([Environment]::GetFolderPath("Programs")) ($env:PUZZLE_NSIS_NAME+".lnk"); @{ desktop=$desktop; start=$start; desktopExists=(Test-Path -LiteralPath $desktop); startExists=(Test-Path -LiteralPath $start); registryExists=(Test-Path -LiteralPath ("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\"+$env:PUZZLE_NSIS_GUID)) } | ConvertTo-Json -Compress',
    ],
    {
      env: { ...process.env, PUZZLE_NSIS_NAME: name, PUZZLE_NSIS_GUID: guid },
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
};
const primary = 'D:\\Program Files\\Puzzle Editor\\Puzzle Editor.exe';
const primaryHash = await fs.readFile(primary).then(hash, () => null);
let installed = false;
let legacyShellWasStale = false;
async function uninstall() {
  const uninstaller = path.join(target, 'Uninstall ' + name + '.exe');
  if (
    !installed ||
    !(await fs.stat(uninstaller).then(
      () => true,
      () => false,
    ))
  )
    return;
  const actual = await fs.realpath(uninstaller);
  if (
    !actual.startsWith((await fs.realpath(directory)) + path.sep) ||
    path.basename(actual) !== 'Uninstall ' + name + '.exe'
  )
    throw new Error('Unsafe acceptance uninstaller path');
  const result = spawnSync(actual, ['/S', '/currentuser'], { windowsHide: true, timeout: 120000 });
  assert(result.status === 0, 'Acceptance uninstaller exited successfully');
  for (
    let i = 0;
    i < 40 &&
    (await fs.stat(executable).then(
      () => true,
      () => false,
    ));
    i++
  )
    await delay(250);
  const state = query();
  assert(
    !state.desktopExists && !state.startExists && !state.registryExists,
    'Acceptance shortcuts and uninstall registration were removed',
  );
  assert(
    !(await fs.stat(executable).then(
      () => true,
      () => false,
    )),
    'Acceptance application EXE removed',
  );
  installed = false;
}
try {
  const initial = query();
  assert(
    !initial.desktopExists && !initial.startExists && !initial.registryExists,
    'Acceptance namespace is unused before installation',
  );
  for (let pass = 0; pass < 3; pass++) {
    const result = spawnSync(
      installer,
      ['/S', '/currentuser', ...(pass ? ['--updated'] : []), '/D=' + target],
      {
        windowsHide: true,
        timeout: 180000,
      },
    );
    installed = await fs.stat(executable).then(
      () => true,
      () => false,
    );
    assert(
      result.status === 0 && installed,
      [
        'Real NSIS user installation created its own EXE',
        'Real NSIS upgrade replaced old EXE and preserved-shortcut icons',
        'Real NSIS reinstall respected the removed desktop shortcut',
      ][pass],
    );
    const state = query();
    assert(
      (pass === 2 ? !state.desktopExists : state.desktopExists) &&
        state.startExists &&
        state.registryExists,
      pass === 2
        ? 'Upgrade did not recreate a removed desktop shortcut'
        : 'Real NSIS created desktop/start-menu shortcuts and own registration',
    );
    assert(
      (await fs.readFile(shortcutIcon)).equals(iconBytes),
      'Installed standalone ICO matches all original bytes',
    );
    if (state.desktopExists) verifyWindowsIcon(executable, sourceIcon, state.desktop, shortcutIcon);
    verifyWindowsIcon(executable, sourceIcon, state.start, shortcutIcon);
    assert(true, 'Installed shortcuts use the standalone ICO and matching Shell icon images');
    if (pass === 0) {
      await fs.copyFile(
        path.resolve('release/desktop/C10/win-unpacked/Puzzle Editor.exe'),
        executable,
      );
      let rejected = false;
      try {
        verifyWindowsIcon(executable, sourceIcon);
      } catch {
        rejected = true;
      }
      assert(rejected, 'C10 default-icon EXE is rejected before the upgrade');
      // 真实旧升级默认会保留快捷方式；构造旧来源并预热 Shell，而不只替换 EXE。
      const fixture = spawnSync(
        powershell,
        [
          '-NoProfile',
          '-Command',
          `
$ErrorActionPreference='Stop'
$wsh=New-Object -ComObject WScript.Shell
@($env:PUZZLE_NSIS_DESKTOP,$env:PUZZLE_NSIS_START) | ForEach-Object {
  $sc=$wsh.CreateShortcut($_)
  $sc.IconLocation=$env:PUZZLE_NSIS_EXE+',0'
  $sc.Save()
}
if ((Get-ItemPropertyValue -LiteralPath ('HKCU:\\Software\\'+$env:PUZZLE_NSIS_GUID) -Name KeepShortcuts) -ne 'true') { throw 'KeepShortcuts fixture is not enabled' }
`,
        ],
        {
          env: {
            ...process.env,
            PUZZLE_NSIS_DESKTOP: state.desktop,
            PUZZLE_NSIS_START: state.start,
            PUZZLE_NSIS_EXE: executable,
            PUZZLE_NSIS_GUID: guid,
          },
          encoding: 'utf8',
          windowsHide: true,
        },
      );
      assert(fixture.status === 0, 'Old shortcuts point at EXE with KeepShortcuts enabled');
      try {
        verifyWindowsIcon(
          executable,
          path.resolve('node_modules/electron/dist/electron.exe'),
          state.desktop,
        );
      } catch (error) {
        // 故意回退旧 EXE/旧来源时允许记录缓存滞后；修复后的每一轮仍严格比较图像。
        if (!error.message.includes('Shell shortcut image differs from original PuzzleEditor icon'))
          throw error;
        legacyShellWasStale = true;
      }
      assert(
        true,
        'Legacy shortcut Shell query completed before upgrade; stale pre-repair images are recorded',
      );
    }
    if (pass === 1) await fs.unlink(state.desktop);
  }
  await uninstall();
  assert(
    (await fs.readFile(primary).then(hash, () => null)) === primaryHash,
    'Existing user Puzzle Editor installation is unchanged',
  );
  const result = {
    ok: true,
    checks,
    verifiedAt: new Date().toISOString(),
    separateProductNamespace: true,
    c10BinaryUpgradeFixture: true,
    preservedOldShortcutFixture: true,
    legacyShellWasStale,
    deletedDesktopShortcutRespected: true,
    actualUserInstallationUpgraded: false,
  };
  if (process.argv[3])
    await fs.writeFile(path.resolve(process.argv[3]), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await uninstall();
  await removeOwnedDirectory(tmpdir(), directory, 'puzzle-nsis-acceptance-');
}

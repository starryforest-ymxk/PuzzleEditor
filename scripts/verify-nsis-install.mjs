/** 独立 appId/产品名真实安装与升级；不操作用户现有 Puzzle Editor 安装和快捷方式。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { verifyWindowsIcon } from './windows-icons.mjs';
import { hash, removeOwnedDirectory } from './cli-package-io.mjs';
const output = path.resolve(process.argv[2] ?? '');
const name = 'Puzzle Editor C16 Acceptance';
const guid = 'ac41efc7-6b75-47bd-b6cb-9381a3c770ee';
const installer = path.join(output, name + ' Setup 1.0.0-beta.exe');
const directory = await fs.mkdtemp(path.join(tmpdir(), 'puzzle-nsis-acceptance-'));
const target = path.join(directory, 'app'),
  executable = path.join(target, name + '.exe');
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
  for (let pass = 0; pass < 2; pass++) {
    const result = spawnSync(installer, ['/S', '/currentuser', '/D=' + target], {
      windowsHide: true,
      windowsVerbatimArguments: true,
      timeout: 180000,
    });
    installed = await fs.stat(executable).then(
      () => true,
      () => false,
    );
    assert(
      result.status === 0 && installed,
      pass
        ? 'Real NSIS upgrade/reinstall replaced the old-icon fixture'
        : 'Real NSIS user installation created its own EXE',
    );
    const state = query();
    assert(
      state.desktopExists && state.startExists && state.registryExists,
      'Real NSIS created desktop/start-menu shortcuts and own registration',
    );
    verifyWindowsIcon(executable, path.resolve('public/icon.ico'), state.desktop);
    verifyWindowsIcon(executable, path.resolve('public/icon.ico'), state.start);
    assert(true, 'Installed EXE and both real shortcuts use original Puzzle Editor icon');
    if (pass === 0) {
      await fs.copyFile(
        path.resolve('release/desktop/C10/win-unpacked/Puzzle Editor.exe'),
        executable,
      );
      let rejected = false;
      try {
        verifyWindowsIcon(executable, path.resolve('public/icon.ico'));
      } catch {
        rejected = true;
      }
      assert(rejected, 'C10 default-icon EXE is rejected before the upgrade');
    }
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
    actualUserInstallationUpgraded: false,
  };
  if (process.argv[3])
    await fs.writeFile(path.resolve(process.argv[3]), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await uninstall();
  await removeOwnedDirectory(tmpdir(), directory, 'puzzle-nsis-acceptance-');
}

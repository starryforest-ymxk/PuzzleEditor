/** 用户环境适配只处理 PATH 增量；保留原值类型和未展开变量，不使用 setx。 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

export interface UserPathState {
  value: string | null;
  kind: 'String' | 'ExpandString';
}
export function installationRoot(explicit?: string, entry = process.argv[1] ?? ''): string {
  if (explicit) return path.resolve(explicit);
  const packageRoot = path.dirname(path.dirname(path.resolve(entry)));
  if (
    /^C\d+-[a-f0-9]{16}$/u.test(path.basename(packageRoot)) &&
    path.basename(path.dirname(packageRoot)) === 'versions'
  )
    return path.dirname(path.dirname(packageRoot));
  if (!process.env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is required for user installation.');
  return path.resolve(process.env.LOCALAPPDATA, 'StarryTree/PuzzleEditorCLI');
}
export const userHome = () => path.resolve(process.env.USERPROFILE ?? homedir());
export function registryLocation() {
  const isolated = process.env.PUZZLE_EDITOR_TEST_REGISTRY_KEY;
  if (
    isolated &&
    !/^Software\\PuzzleEditorCLI\\Tests\\[a-f0-9-]{36}\\Environment$/iu.test(isolated)
  )
    throw new Error('The test registry override must remain inside the isolated test namespace.');
  return { key: isolated ?? 'Environment', scope: isolated ? 'isolated-test' : 'user' };
}
export function userPath(expected?: UserPathState, next?: UserPathState): UserPathState {
  if (process.platform !== 'win32')
    throw new Error('User PATH installation is currently Windows-only.');
  const location = registryLocation();
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$pathMutex = $null
if ($env:PUZZLE_PATH_CHANGE) {
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $pathMutex = [Threading.Mutex]::new($false, ('Local\\PuzzleEditorCLI-PATH-' + $sid + '-' + $env:PUZZLE_PATH_KEY.Replace('\\','_')))
  try { if (-not $pathMutex.WaitOne(10000)) { $pathMutex.Dispose(); throw 'User PATH is busy' } }
  catch [Threading.AbandonedMutexException] { }
}
try {
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($env:PUZZLE_PATH_KEY, $false)
$value = $null; $kind = 'ExpandString'
try {
  if ($key -and ($key.GetValueNames() -contains 'Path')) {
    $value = $key.GetValue('Path', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $kind = $key.GetValueKind('Path').ToString()
  }
} finally { if ($key) { $key.Dispose() } }
if ($env:PUZZLE_PATH_CHANGE) {
  $change = $env:PUZZLE_PATH_CHANGE | ConvertFrom-Json
  if ($value -cne $change.expected.value -or $kind -cne $change.expected.kind) { throw 'User PATH changed concurrently' }
  $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($env:PUZZLE_PATH_KEY)
  try {
    if ($null -eq $change.next.value) { $key.DeleteValue('Path', $false) }
    else { $key.SetValue('Path', $change.next.value, [Enum]::Parse([Microsoft.Win32.RegistryValueKind], $change.next.kind)) }
  } finally { $key.Dispose() }
  if ($env:PUZZLE_PATH_KEY -eq 'Environment') {
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class PuzzleEnvironmentNotify { [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, UIntPtr w, string l, uint f, uint t, out UIntPtr r); }'
    $notificationResult = [UIntPtr]::Zero
    [void][PuzzleEnvironmentNotify]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 2, 1000, [ref]$notificationResult)
  }
  $value = $change.next.value; $kind = $change.next.kind
}
@{ value=$value; kind=$kind } | ConvertTo-Json -Compress
} finally { if ($pathMutex) { $pathMutex.ReleaseMutex(); $pathMutex.Dispose() } }
`;
  const result = spawnSync(
    path.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      env: {
        ...process.env,
        PUZZLE_PATH_KEY: location.key,
        PUZZLE_PATH_CHANGE: next ? JSON.stringify({ expected, next }) : '',
      },
      windowsHide: true,
      encoding: 'utf8',
      timeout: 15000,
    },
  );
  if (result.status !== 0)
    throw Object.assign(new Error('User PATH access failed: ' + result.stderr.trim()), {
      code: 'PATH_IO_FAILED',
    });
  const value: unknown = JSON.parse(result.stdout);
  if (
    !value ||
    typeof value !== 'object' ||
    !('value' in value) ||
    !('kind' in value) ||
    !(value.value === null || typeof value.value === 'string') ||
    !['String', 'ExpandString'].includes(String(value.kind))
  )
    throw new Error('User PATH has an unsupported registry type.');
  return value as UserPathState;
}
export const pathEquals = (left: string, right: string) =>
  path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
export function pathContains(value: string | null, bin: string) {
  return (value ?? '')
    .split(';')
    .some((entry) => entry.trim() && pathEquals(entry.replace(/^"|"$/gu, ''), bin));
}
export function addPath(state: UserPathState, bin: string): UserPathState {
  return pathContains(state.value, bin)
    ? state
    : {
        ...state,
        value: (state.value ? state.value + (state.value.endsWith(';') ? '' : ';') : '') + bin,
      };
}
export function removePath(state: UserPathState, bin: string): UserPathState {
  const parts = (state.value ?? '').split(';');
  let index = -1;
  for (let cursor = parts.length - 1; cursor >= 0; cursor--)
    if (parts[cursor].trim() && pathEquals(parts[cursor].replace(/^"|"$/gu, ''), bin)) {
      index = cursor;
      break;
    }
  if (index < 0) return state;
  parts.splice(index, 1);
  return parts.length
    ? { ...state, value: parts.join(';') }
    : { value: null, kind: 'ExpandString' };
}
export async function commandCandidates() {
  const result: string[] = [];
  for (const directory of (process.env.PATH ?? '').split(';').filter(Boolean)) {
    const expanded = directory
      .replace(/%([^%]+)%/gu, (_match, name: string) => process.env[name] ?? '%' + name + '%')
      .replace(/^"|"$/gu, '');
    for (const name of ['puzzle.exe', 'puzzle.cmd', 'puzzle.bat', 'puzzle.ps1']) {
      const file = path.resolve(expanded, name);
      if (
        await fs.stat(file).then(
          (stat) => stat.isFile(),
          () => false,
        )
      )
        result.push(file);
    }
  }
  return result;
}

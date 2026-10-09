/** 实际提取 Windows 关联图标并核对像素；不能以 ICO 配置存在代替 EXE 成品验证。 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export function verifyWindowsIcon(executable, sourceIcon, shortcut) {
  if (process.platform !== 'win32') throw new Error('Windows icon verification requires Windows.');
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
function IconHash([string]$file) {
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($file)
  if ($null -eq $icon) { throw 'Missing associated icon' }
  $bitmap = $icon.ToBitmap()
  $stream = [System.IO.MemoryStream]::new()
  try {
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream.ToArray()))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
  } finally { $stream.Dispose(); $bitmap.Dispose(); $icon.Dispose() }
}
$expected = IconHash $env:PUZZLE_ICON_SOURCE
$actual = IconHash $env:PUZZLE_ICON_EXE
if ($actual -ne $expected) { throw 'Executable icon differs from original PuzzleEditor icon' }
$info = [Diagnostics.FileVersionInfo]::GetVersionInfo($env:PUZZLE_ICON_EXE)
$shortcutResult = $null
if ($env:PUZZLE_ICON_SHORTCUT) {
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($env:PUZZLE_ICON_SHORTCUT)
  if ($sc.TargetPath -ne $env:PUZZLE_ICON_EXE -or $sc.IconLocation -ne ($env:PUZZLE_ICON_EXE + ',0')) { throw 'Shortcut target or icon is incorrect' }
  $shortcutResult = @{ path = $env:PUZZLE_ICON_SHORTCUT; target = $sc.TargetPath; icon = $sc.IconLocation }
}
@{ executable = $env:PUZZLE_ICON_EXE; expected = $expected; actual = $actual; productName = $info.ProductName; shortcut = $shortcutResult } | ConvertTo-Json -Depth 5 -Compress
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
        PUZZLE_ICON_EXE: path.resolve(executable),
        PUZZLE_ICON_SOURCE: path.resolve(sourceIcon),
        PUZZLE_ICON_SHORTCUT: shortcut ? path.resolve(shortcut) : '',
      },
      windowsHide: true,
      encoding: 'utf8',
      timeout: 30000,
    },
  );
  if (result.status !== 0) throw new Error(result.stderr || 'Windows icon verification failed.');
  return JSON.parse(result.stdout);
}

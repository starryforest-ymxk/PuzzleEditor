/** 实际提取 Windows 关联图标并核对像素；不能以 ICO 配置存在代替 EXE 成品验证。 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

// 图标内容决定独立资源名；安装升级不再沿用曾缓存 Electron 图标的 EXE 路径。
export function windowsIconFilename(bytes) {
  return 'puzzle-editor-' + createHash('sha256').update(bytes).digest('hex').slice(0, 16) + '.ico';
}

export function windowsIconInstallerInclude(filename) {
  if (!/^puzzle-editor-[a-f0-9]{16}\.ico$/.test(filename))
    throw new Error('Invalid installed icon filename.');
  const update = (link) =>
    [
      '  ${if} ${FileExists} "' + link + '"',
      '    ClearErrors',
      '    CreateShortCut "' +
        link +
        '" "$appExe" "" "$INSTDIR\\resources\\' +
        filename +
        '" 0 "" "" "${APP_DESCRIPTION}"',
      '    IfErrors 0 +2',
      '      Abort "Unable to update the Puzzle Editor shortcut icon."',
      '    WinShell::SetLnkAUMI "' + link + '" "${APP_ID}"',
      '    System::Call \'shell32::SHChangeNotify(i 0x2000, i 0x1005, w "' + link + '", p 0)\'',
      '  ${endif}',
    ].join('\n');
  // customInstall 在标准创建/保留逻辑之后执行；只更新启用且存在的应用快捷方式。
  return [
    '; 原路径升级也更新保留的快捷方式，并发送带 Unicode 路径的同步刷新通知。',
    '!macro customInstall',
    '!ifndef DO_NOT_CREATE_START_MENU_SHORTCUT',
    update('$newStartMenuLink'),
    '!endif',
    '!ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT',
    '  ${ifNot} ${isNoDesktopShortcut}',
    update('$newDesktopLink'),
    '  ${endif}',
    '!endif',
    '!macroend',
    '',
  ].join('\n');
}

export function verifyWindowsIcon(executable, sourceIcon, shortcut, shortcutIcon = executable) {
  if (process.platform !== 'win32') throw new Error('Windows icon verification requires Windows.');
  const referenceDirectory = shortcut
    ? mkdtempSync(path.join(tmpdir(), 'puzzle-icon-reference-'))
    : null;
  const referenceShortcut = referenceDirectory ? path.join(referenceDirectory, 'expected.lnk') : '';
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PuzzleShortcutShell {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct Info {
    public IntPtr hIcon; public int iIcon; public uint attributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string name;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)] public string type;
  }
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, ExactSpelling=true)]
  public static extern IntPtr SHGetFileInfoW(string path, uint attributes, out Info info, uint size, uint flags);
  [DllImport("user32.dll")]
  public static extern bool DestroyIcon(IntPtr icon);
}
'@
function BitmapHash($bitmap) {
  $stream = [System.IO.MemoryStream]::new()
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return ([BitConverter]::ToString($sha.ComputeHash($stream.ToArray()))).Replace('-', '').ToLowerInvariant()
  } finally { $sha.Dispose(); $stream.Dispose() }
}
function ShellIcon([string]$file, [uint32]$flags) {
  $shellInfo = [PuzzleShortcutShell+Info]::new()
  $result = [PuzzleShortcutShell]::SHGetFileInfoW($file, 0, [ref]$shellInfo, [uint32][Runtime.InteropServices.Marshal]::SizeOf($shellInfo), $flags)
  if ($result -eq [IntPtr]::Zero -or $shellInfo.hIcon -eq [IntPtr]::Zero) { throw 'Shell icon lookup failed' }
  $icon = [System.Drawing.Icon]::FromHandle($shellInfo.hIcon)
  $bitmap = $icon.ToBitmap()
  try { return @{ hash=(BitmapHash $bitmap); index=$shellInfo.iIcon; width=$bitmap.Width; height=$bitmap.Height } }
  finally { $bitmap.Dispose(); $icon.Dispose(); [void][PuzzleShortcutShell]::DestroyIcon($shellInfo.hIcon) }
}
function IconHash([string]$file) {
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($file)
  if ($null -eq $icon) { throw 'Missing associated icon' }
  $bitmap = $icon.ToBitmap()
  try { return BitmapHash $bitmap }
  finally { $bitmap.Dispose(); $icon.Dispose() }
}
$expected = IconHash $env:PUZZLE_ICON_SOURCE
$actual = IconHash $env:PUZZLE_ICON_EXE
if ($actual -ne $expected) { throw 'Executable icon differs from original PuzzleEditor icon' }
$info = [Diagnostics.FileVersionInfo]::GetVersionInfo($env:PUZZLE_ICON_EXE)
$shortcutResult = $null
if ($env:PUZZLE_ICON_SHORTCUT) {
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($env:PUZZLE_ICON_SHORTCUT)
  if ($sc.TargetPath -ne $env:PUZZLE_ICON_EXE -or $sc.IconLocation -ne ($env:PUZZLE_SHORTCUT_ICON + ',0')) { throw 'Shortcut target or icon is incorrect' }
  if ((IconHash $env:PUZZLE_SHORTCUT_ICON) -ne $expected) { throw 'Shortcut resource differs from original PuzzleEditor icon' }
  # ICO 文件与快捷方式可能具有不同图标索引；用原 ICO 的隔离参考快捷方式比较实际图像。
  $reference = $wsh.CreateShortcut($env:PUZZLE_ICON_REFERENCE)
  $reference.TargetPath = $env:PUZZLE_ICON_EXE
  $reference.IconLocation = $env:PUZZLE_ICON_SOURCE + ',0'
  $reference.Save()
  $shellChecks = @()
  foreach ($flags in @(0x100, 0x101)) {
    $actualShell = ShellIcon $env:PUZZLE_ICON_SHORTCUT $flags
    $expectedShell = ShellIcon $env:PUZZLE_ICON_REFERENCE $flags
    if ($actualShell.hash -ne $expectedShell.hash) { throw 'Shell shortcut image differs from original PuzzleEditor icon' }
    $shellChecks += $actualShell
  }
  $shortcutResult = @{ path = $env:PUZZLE_ICON_SHORTCUT; target = $sc.TargetPath; icon = $sc.IconLocation; shellImages = $shellChecks }
}
@{ executable = $env:PUZZLE_ICON_EXE; expected = $expected; actual = $actual; productName = $info.ProductName; shortcut = $shortcutResult } | ConvertTo-Json -Depth 5 -Compress
`;
  try {
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
          PUZZLE_SHORTCUT_ICON: path.resolve(shortcutIcon),
          PUZZLE_ICON_REFERENCE: referenceShortcut,
        },
        windowsHide: true,
        encoding: 'utf8',
        timeout: 30000,
      },
    );
    if (result.status !== 0) throw new Error(result.stderr || 'Windows icon verification failed.');
    return JSON.parse(result.stdout);
  } finally {
    // 只删除本函数新建的单个参考文件和空目录，不递归清理任何系统缓存。
    if (referenceDirectory) {
      if (existsSync(referenceShortcut)) unlinkSync(referenceShortcut);
      rmdirSync(referenceDirectory);
    }
  }
}

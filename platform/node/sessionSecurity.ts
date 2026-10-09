/** Windows 会话边界：只修改本工具新建目录及自身管道，随后读回 ACL；失败禁止发布。 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { ProjectFileError } from './projectOwnership.js';

const run = promisify(execFile);
const aclScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
function CheckAcl($acl, $pipe) {
  if ($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'Unexpected security owner' }
  if (-not $acl.AreAccessRulesProtected) { throw 'Inherited access is not permitted' }
  $allowed = $false
  foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
    if ($rule.AccessControlType -eq 'Allow') {
      if ($rule.IdentityReference.Value -ne $sid.Value) { throw 'Access granted to another identity' }
      $allowed = $true
    }
  }
  if (-not $allowed) { throw 'Current user access missing' }
  if ($pipe) {
    $networkDenied = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -eq 'S-1-5-2' -and $_.AccessControlType -eq 'Deny' })
    if ($networkDenied.Count -ne 1) { throw 'Network access is not denied' }
  }
}
if ($env:PUZZLE_ACL_PIPE) {
  $client = [System.IO.Pipes.NamedPipeClientStream]::new('.', $env:PUZZLE_ACL_PIPE, [System.IO.Pipes.PipeAccessRights]::FullControl, [System.IO.Pipes.PipeOptions]::None, [System.Security.Principal.TokenImpersonationLevel]::Anonymous, [System.IO.HandleInheritability]::None)
  try {
    $client.Connect(3000)
    if ($env:PUZZLE_ACL_VERIFY_PIPE -ne '1') {
    $acl = [System.IO.Pipes.PipeSecurity]::new()
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $acl.AddAccessRule([System.IO.Pipes.PipeAccessRule]::new($sid, [System.IO.Pipes.PipeAccessRights]::FullControl, 'Allow'))
    $acl.AddAccessRule([System.IO.Pipes.PipeAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new('S-1-5-2'), [System.IO.Pipes.PipeAccessRights]::FullControl, 'Deny'))
    $client.SetAccessControl($acl)
    }
    CheckAcl ($client.GetAccessControl()) $true
  } finally { $client.Dispose() }
} else {
  $directory = $env:PUZZLE_ACL_DIRECTORY
  $parent = [System.IO.DirectoryInfo]::new($directory)
  while ($parent) {
    if ($parent.Exists -and ($parent.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'Reparse directories are not permitted' }
    $parent = $parent.Parent
  }
  if (-not [System.IO.Directory]::Exists($directory)) {
    if ($env:PUZZLE_ACL_CREATE -ne '1') { Write-Output 'absent'; exit 0 }
    $acl = [System.Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow'))
    [System.IO.Directory]::CreateDirectory($directory, $acl) | Out-Null
  }
  CheckAcl ([System.IO.Directory]::GetAccessControl($directory)) $false
  foreach ($filePath in [System.IO.Directory]::GetFiles($directory)) {
    try {
      if ([System.IO.File]::GetAttributes($filePath) -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Reparse files are not permitted' }
      $acl = [System.IO.File]::GetAccessControl($filePath)
    } catch {
      $failure = $_.Exception
      while ($failure.InnerException) { $failure = $failure.InnerException }
      # 多实例发布/关闭可使枚举后的文件消失；仅容忍明确 NotFound，权限拒绝仍失败关闭。
      if ($failure -is [System.IO.FileNotFoundException] -or $failure -is [System.IO.DirectoryNotFoundException]) { continue }
      throw
    }
    if ($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'Unexpected file owner' }
    foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
      if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -ne $sid.Value) { throw 'Unsafe discovery file access' }
    }
  }
}
Write-Output $sid.Value
`;

async function check(environment: Record<string, string>) {
  if (process.platform !== 'win32')
    throw new ProjectFileError('SESSION_PLATFORM_UNSUPPORTED', 'Live sessions require Windows.');
  try {
    const { stdout } = await run(
      join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      ),
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(aclScript, 'utf16le').toString('base64'),
      ],
      {
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 65536,
        env: {
          ...process.env,
          PUZZLE_ACL_PIPE: '',
          PUZZLE_ACL_DIRECTORY: '',
          PUZZLE_ACL_CREATE: '',
          PUZZLE_ACL_VERIFY_PIPE: '',
          ...environment,
        },
      },
    );
    return stdout.trim();
  } catch {
    throw new ProjectFileError(
      'SESSION_ACCESS_UNVERIFIED',
      'Unable to verify current-user session access. The live bridge is disabled.',
    );
  }
}
export function sessionDirectory(): string {
  return resolve(
    process.env.PUZZLE_EDITOR_SESSION_DIR ??
      join(process.env.LOCALAPPDATA ?? '', 'PuzzleEditor', 'sessions-v1'),
  );
}
export async function verifySessionDirectory(create = false): Promise<string | null> {
  const path = sessionDirectory();
  return (await check({ PUZZLE_ACL_DIRECTORY: path, PUZZLE_ACL_CREATE: create ? '1' : '' })) ===
    'absent'
    ? null
    : path;
}
export async function protectSessionPipe(pipeName: string): Promise<void> {
  await check({ PUZZLE_ACL_PIPE: pipeName });
  // 再开一个连接只读核验，确保后续 libuv 管道实例没有恢复默认 ACL。
  await check({ PUZZLE_ACL_PIPE: pipeName, PUZZLE_ACL_VERIFY_PIPE: '1' });
}

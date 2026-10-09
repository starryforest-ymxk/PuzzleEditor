# Windows 不允许删除正在运行的 Node；复制到独占临时目录后调用相同卸载服务。
$ErrorActionPreference = 'Stop'
$cliArgs = @($args)
if ($cliArgs.Count -ge 2 -and $cliArgs[0] -eq 'setup' -and $cliArgs[1] -eq 'uninstall') {
    $cliArgs = @($cliArgs | Select-Object -Skip 2)
}
if ($cliArgs -notcontains '--install-root') {
    $parent = Split-Path $PSScriptRoot -Parent
    if ((Split-Path $parent -Leaf) -eq 'versions') {
        $cliArgs += @('--install-root', (Split-Path $parent -Parent))
    }
}
$tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempParent ('puzzle-cli-uninstall-' + [Guid]::NewGuid().ToString())
$exitCode = 1
try {
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    Get-ChildItem -LiteralPath $PSScriptRoot | Copy-Item -Destination $tempRoot -Recurse
    & (Join-Path $tempRoot 'runtime/node.exe') (Join-Path $tempRoot 'app/cli.js') setup uninstall @cliArgs
    $exitCode = $LASTEXITCODE
} finally {
    $resolved = [IO.Path]::GetFullPath($tempRoot)
    if ((Split-Path $resolved -Parent) -ne $tempParent.TrimEnd('\') -or (Split-Path $resolved -Leaf) -notmatch '^puzzle-cli-uninstall-[a-f0-9-]{36}$') {
        throw 'Unsafe temporary cleanup path'
    }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
exit $exitCode

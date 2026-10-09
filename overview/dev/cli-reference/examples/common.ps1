# 示例共用的调用与 UTF-8 写入边界；不提供工程授权，不忽略非零退出码。
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
function Invoke-Puzzle([string[]]$CliArgs) {
    $output = & $Puzzle @CliArgs
    $code = $LASTEXITCODE
    $result = ($output -join "`n") | ConvertFrom-Json
    if ($code -ne 0 -or -not $result.ok) { throw ($output -join "`n") }
    return $result
}
function Write-Json([string]$Path, $Value) {
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
}

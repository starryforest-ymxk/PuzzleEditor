# 仅对新建的教学副本演练。参数只声明已有聊天许可，不能自行产生许可。
param(
    [ValidateSet('mark-restore', 'overwrite', 'raw', 'raw-overwrite')][string]$Mode = 'mark-restore',
    [string]$Puzzle = 'puzzle',
    [string]$WorkDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('puzzle-authorized-' + [guid]::NewGuid())),
    [switch]$AllowOverwrite,
    [switch]$AllowRawJsonWrite
)
$ErrorActionPreference = 'Stop'
if ($Mode.Contains('overwrite') -and -not $AllowOverwrite) { throw 'Existing scoped overwrite chat authorization and -AllowOverwrite are required.' }
if ($Mode.StartsWith('raw') -and -not $AllowRawJsonWrite) { throw 'Existing scoped raw JSON chat authorization and -AllowRawJsonWrite are required.' }
if (Test-Path -LiteralPath $WorkDirectory) { throw 'Choose a new example directory.' }
New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
. (Join-Path $PSScriptRoot 'common.ps1')
$source = Join-Path $WorkDirectory 'Sample.puzzle.json'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'sample.puzzle.json') -Destination $source
$target = $source
if ($Mode -eq 'mark-restore') {
    foreach ($operation in @('variable.delete', 'variable.restore')) {
        $context = Invoke-Puzzle -CliArgs @('inspect', $source, '--json')
        $planPath = Join-Path $WorkDirectory ($operation + '.plan.json')
        $receipt = Join-Path $WorkDirectory ($operation + '.receipt.json')
        $target = Join-Path $WorkDirectory ($operation + '.puzzle.json')
        Write-Json $planPath @{
            apiVersion = '1.0.0'; sourceHash = $context.data.source.sha256; scope = @{ globals = @('variable') }
            commands = @(@{ op = $operation; owner = @{ type = 'global' }; target = @{ id = 'implemented' } })
        }
        $preview = Invoke-Puzzle -CliArgs @('preview', $source, '--plan', $planPath, '--receipt-out', $receipt)
        $applied = Invoke-Puzzle -CliArgs @('apply', $source, '--plan', $planPath, '--receipt', $receipt, '--out', $target)
        $source = $target
    }
} elseif ($Mode.StartsWith('raw')) {
    $read = Invoke-Puzzle -CliArgs @('json', 'read', $source, '--json')
    $candidate = Join-Path $WorkDirectory 'candidate.puzzle.json'
    $read.data.file.project.meta.description = 'Authorized raw tutorial'
    Write-Json $candidate $read.data.file
    $receipt = Join-Path $WorkDirectory 'raw-receipt.json'
    $modeArgs = @('--in-place')
    if ($Mode -eq 'raw') { $target = Join-Path $WorkDirectory 'Reviewed.puzzle.json'; $modeArgs = @('--out', $target) }
    $preview = Invoke-Puzzle -CliArgs (@('json', 'preview', $source, '--candidate', $candidate, '--receipt-out', $receipt) + $modeArgs)
    $applyArgs = @('json', 'apply', $source, '--candidate', $candidate, '--receipt', $receipt, '--allow-raw-json-write') + $modeArgs
    if ($Mode -eq 'raw-overwrite') { $applyArgs += '--allow-overwrite' }
    $applied = Invoke-Puzzle -CliArgs $applyArgs
} else {
    $context = Invoke-Puzzle -CliArgs @('inspect', $source, '--json')
    $planPath = Join-Path $WorkDirectory 'plan.json'
    $receipt = Join-Path $WorkDirectory 'receipt.json'
    Write-Json $planPath @{
        apiVersion = '1.0.0'; sourceHash = $context.data.source.sha256; scope = @{ project = $true }
        commands = @(@{ op = 'project.update'; changes = @{ description = 'Authorized overwrite tutorial' } })
    }
    $preview = Invoke-Puzzle -CliArgs @('preview', $source, '--plan', $planPath, '--in-place', '--receipt-out', $receipt)
    $applied = Invoke-Puzzle -CliArgs @('apply', $source, '--plan', $planPath, '--receipt', $receipt, '--in-place', '--allow-overwrite')
}
$validation = Invoke-Puzzle -CliArgs @('validate', $target, '--json')
[pscustomobject]@{ mode = $Mode; output = $target; validated = $validation.ok; result = $applied.data } | ConvertTo-Json -Depth 30

# 仅对随包虚构工程运行一个领域示例；权限声明必须对应已有聊天授权。
param(
    [Parameter(Mandatory = $true)][string]$Operation,
    [string]$Puzzle = 'puzzle',
    [string]$WorkDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('puzzle-domain-' + [guid]::NewGuid())),
    [switch]$AllowPermanentDelete
)
$ErrorActionPreference = 'Stop'
if ($Operation.EndsWith('.purge') -and -not $AllowPermanentDelete) { throw 'This example requires existing scoped chat authorization and -AllowPermanentDelete.' }
if (Test-Path -LiteralPath $WorkDirectory) { throw 'Choose a new example directory.' }
$plans = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'operations.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$selected = $plans.PSObject.Properties[$Operation]
if (-not $selected) { throw 'Unknown operation. Read the operation reference.' }
New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
$source = Join-Path $WorkDirectory 'Sample.puzzle.json'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'sample.puzzle.json') -Destination $source
. (Join-Path $PSScriptRoot 'common.ps1')
$context = Invoke-Puzzle -CliArgs @('inspect', $source, '--json')
$plan = $selected.Value
$plan.sourceHash = $context.data.source.sha256
$planPath = Join-Path $WorkDirectory 'plan.json'
$receipt = Join-Path $WorkDirectory 'receipt.json'
$target = Join-Path $WorkDirectory 'Result.puzzle.json'
[IO.File]::WriteAllText($planPath, ($plan | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
$preview = Invoke-Puzzle -CliArgs @('preview', $source, '--plan', $planPath, '--receipt-out', $receipt, '--json')
$applyArgs = @('apply', $source, '--plan', $planPath, '--receipt', $receipt, '--out', $target, '--json')
if ($AllowPermanentDelete) { $applyArgs += '--allow-permanent-delete' }
$applied = Invoke-Puzzle -CliArgs $applyArgs
$validation = Invoke-Puzzle -CliArgs @('validate', $target, '--json')
[pscustomobject]@{ operation = $Operation; source = $source; output = $target; validated = $validation.ok; aliases = $preview.data.receipt.allocations } | ConvertTo-Json -Depth 10

# 在新目录运行完整领域另存流程，不修改任何既有工程。
param(
    [string]$Puzzle = 'puzzle',
    [string]$WorkDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('puzzle-quick-start-' + [guid]::NewGuid()))
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $WorkDirectory) { throw 'Choose a new, nonexistent example directory.' }
New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
. (Join-Path $PSScriptRoot 'common.ps1')
$source = Join-Path $WorkDirectory 'Demo.puzzle.json'
$planPath = Join-Path $WorkDirectory 'edit-plan.json'
$receiptPath = Join-Path $WorkDirectory 'preview.json'
$outputPath = Join-Path $WorkDirectory 'Demo-edited.puzzle.json'
$exportPath = Join-Path $WorkDirectory 'Demo.export.json'
$version = Invoke-Puzzle -CliArgs @('version', '--json')
$capabilities = Invoke-Puzzle -CliArgs @('describe', '--json')
$created = Invoke-Puzzle -CliArgs @('create', '--name', 'Demo', '--root-asset-name', 'DemoRoot', '--out', $source, '--json')
$context = Invoke-Puzzle -CliArgs @('inspect', $source, '--json')
$plan = @{
    apiVersion = '1.0.0'
    sourceHash = $context.data.source.sha256
    scope = @{ stages = @(@{ id = $context.data.result.rootStageId }) }
    commands = @(@{
        op = 'stage.update'
        target = @{ id = $context.data.result.rootStageId }
        changes = @{ description = 'Edited through the CLI' }
    })
}
Write-Json $planPath $plan
$preview = Invoke-Puzzle -CliArgs @('preview', $source, '--plan', $planPath, '--receipt-out', $receiptPath, '--json')
$applied = Invoke-Puzzle -CliArgs @('apply', $source, '--plan', $planPath, '--receipt', $receiptPath, '--out', $outputPath, '--json')
$validation = Invoke-Puzzle -CliArgs @('validate', $outputPath, '--json')
$exported = Invoke-Puzzle -CliArgs @('export', $outputPath, '--out', $exportPath, '--json')
[pscustomobject]@{ source = $source; output = $outputPath; export = $exportPath; validated = $validation.ok; apiVersion = $version.data.apiVersion } | ConvertTo-Json

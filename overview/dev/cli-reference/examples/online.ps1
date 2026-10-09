# 只连接明确指定的桌面会话。建议先打开随包虚构工程演练；不覆盖其磁盘源文件。
param(
    [Parameter(Mandatory = $true)][string]$Instance,
    [Parameter(Mandatory = $true)][int]$Session,
    [string]$Puzzle = 'puzzle',
    [string]$WorkDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('puzzle-online-' + [guid]::NewGuid()))
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $WorkDirectory) { throw 'Choose a new example directory.' }
New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
. (Join-Path $PSScriptRoot 'common.ps1')
function New-Request([string]$Name) {
    $id = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString() + ':' + [guid]::NewGuid().ToString())
    Write-Json (Join-Path $WorkDirectory ($Name + '-request.json')) @{ requestId = $id }
    return $id
}
$target = @('--instance', $Instance, '--session', $Session.ToString())
$found = Invoke-Puzzle -CliArgs @('session', 'list', '--json')
$status = Invoke-Puzzle -CliArgs (@('session', 'status') + $target + @('--json'))
$inspected = Invoke-Puzzle -CliArgs (@('session', 'inspect') + $target + @('--view', 'project', '--json'))
$tokenPath = Join-Path $WorkDirectory 'token.json'
$planPath = Join-Path $WorkDirectory 'plan.json'
$receiptPath = Join-Path $WorkDirectory 'receipt.json'
Write-Json $tokenPath $status.data.token
Write-Json $planPath @{
    apiVersion = '1.0.0'; sourceHash = $status.data.token.contentHash; scope = @{ project = $true }
    commands = @(@{ op = 'project.update'; changes = @{ description = ('Online example ' + [guid]::NewGuid()) } })
}
$preview = Invoke-Puzzle -CliArgs (@('session', 'preview') + $target + @('--token', $tokenPath, '--plan', $planPath, '--receipt-out', $receiptPath, '--json'))
$applyId = New-Request 'apply'
$applied = Invoke-Puzzle -CliArgs (@('session', 'apply') + $target + @('--plan', $planPath, '--receipt', $receiptPath, '--request-id', $applyId, '--json'))
$history = Invoke-Puzzle -CliArgs (@('history', 'list') + $target + @('--json'))
Write-Json $tokenPath $history.data.token
$undoId = New-Request 'undo'
$undone = Invoke-Puzzle -CliArgs (@('history', 'undo') + $target + @('--token', $tokenPath, '--entry-id', $history.data.history.undoEntryId, '--request-id', $undoId, '--json'))
$history = Invoke-Puzzle -CliArgs (@('history', 'list') + $target + @('--json'))
Write-Json $tokenPath $history.data.token
$redoId = New-Request 'redo'
$redone = Invoke-Puzzle -CliArgs (@('history', 'redo') + $target + @('--token', $tokenPath, '--entry-id', $history.data.history.redoEntryId, '--request-id', $redoId, '--json'))
$validation = Invoke-Puzzle -CliArgs (@('session', 'validate') + $target + @('--json'))
$status = Invoke-Puzzle -CliArgs (@('session', 'status') + $target + @('--json'))
Write-Json $tokenPath $status.data.token
$saveId = New-Request 'save'
$outputPath = Join-Path $WorkDirectory 'Session-saved.puzzle.json'
$saved = Invoke-Puzzle -CliArgs (@('session', 'save') + $target + @('--token', $tokenPath, '--request-id', $saveId, '--out', $outputPath, '--json'))
[pscustomobject]@{ output = $outputPath; validated = $validation.ok; instance = $Instance; session = $Session } | ConvertTo-Json

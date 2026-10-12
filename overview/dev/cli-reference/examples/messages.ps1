param(
  [string]$Puzzle = 'puzzle',
  [Parameter(Mandatory=$true)][string]$Instance,
  [Parameter(Mandatory=$true)][int]$Session,
  [ValidateSet('all','info','warning','error')][string]$Level = 'all',
  [ValidateRange(1,200)][int]$PageSize = 50
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
# 逐页读同一个快照；失败时停止，不把清空/过期误判成没有错误。
$messageRows = @()
$messageCursor = $null
$messageHeader = $null
do {
  $messageArgs = @('session','messages','--instance',$Instance,'--session',[string]$Session,'--level',$Level,'--limit',[string]$PageSize,'--json')
  if ($messageCursor) { $messageArgs += @('--cursor',$messageCursor) }
  $messageText = & $Puzzle @messageArgs
  if ($LASTEXITCODE -ne 0) { throw ($messageText -join "`n") }
  $messageResult = ($messageText -join "`n") | ConvertFrom-Json
  if (!$messageResult.ok) { throw 'Message read failed.' }
  $messagePage = $messageResult.data.result
  if (!$messageHeader) { $messageHeader = $messagePage }
  if ($messageHeader.snapshotId -ne $messagePage.snapshotId) { throw 'Message snapshot changed between pages.' }
  $messageRows += @($messagePage.messages)
  $messageCursor = $messagePage.nextCursor
  if ($messagePage.hasMore -and !$messageCursor) { throw 'Incomplete pagination response.' }
} while ($messagePage.hasMore)
if ($messageRows.Count -ne $messageHeader.totalMatches) { throw 'Message snapshot is incomplete.' }
[pscustomobject]@{
  scope=$messageHeader.scope
  projectAssociation=$messageHeader.projectAssociation
  snapshotId=$messageHeader.snapshotId
  capturedAt=$messageHeader.capturedAt
  expiresAt=$messageHeader.expiresAt
  counts=$messageHeader.counts
  total=$messageHeader.total
  totalMatches=$messageHeader.totalMatches
  messages=$messageRows
} | ConvertTo-Json -Depth 8

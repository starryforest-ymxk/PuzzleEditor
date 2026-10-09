# 全部资产名在这个虚构场景规格中明确给定，不从显示名称推导。
param(
    [string]$Puzzle = 'puzzle',
    [string]$WorkDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('puzzle-advanced-' + [guid]::NewGuid()))
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $WorkDirectory) { throw 'Choose a new example directory.' }
New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
. (Join-Path $PSScriptRoot 'common.ps1')
$plan = @{
    apiVersion = '1.0.0'; scope = @{ project = $true }; commands = @(
        @{ op = 'stage.create'; alias = 'floor'; parent = @{ alias = 'root' }; data = @{ name = 'Floor'; assetName = 'Floor' } },
        @{ op = 'stage.create'; alias = 'room'; parent = @{ alias = 'floor' }; data = @{ name = 'Room'; assetName = 'Room' } },
        @{ op = 'variable.create'; alias = 'score'; owner = @{ type = 'global' }; data = @{ name = 'Score'; assetName = 'Score'; type = 'integer'; value = 0 } },
        @{ op = 'event.create'; alias = 'open'; data = @{ name = 'Open Door'; assetName = 'OpenDoor' } },
        @{ op = 'script.create'; alias = 'effect'; data = @{ name = 'Door Effect'; assetName = 'DoorEffect'; category = 'Performance' } },
        @{ op = 'script.create'; alias = 'check'; data = @{ name = 'Check Door'; assetName = 'CheckDoor'; category = 'Condition' } },
        @{ op = 'puzzle.create'; alias = 'door'; stage = @{ alias = 'room' }; data = @{ name = 'Door'; assetName = 'Door' }; initialState = @{ name = 'Closed'; assetName = 'Closed'; alias = 'closed' } },
        @{ op = 'variable.create'; alias = 'local'; owner = @{ type = 'puzzle'; ref = @{ alias = 'door' } }; data = @{ name = 'Attempts'; assetName = 'Attempts'; type = 'integer'; value = 0 } },
        @{ op = 'state.create'; alias = 'opened'; fsm = @{ puzzle = @{ alias = 'door' } }; data = @{ name = 'Opened'; assetName = 'Opened'; position = @{ x = 300; y = 0 } } },
        @{ op = 'transition.create'; alias = 'go'; fsm = @{ puzzle = @{ alias = 'door' } }; from = @{ alias = 'closed' }; to = @{ alias = 'opened' }; data = @{
            name = 'Unlock'; priority = 0; triggers = @(@{ type = 'OnEvent'; eventId = @{ alias = 'open' } })
            condition = @{ type = 'And'; children = @(
                @{ type = 'Comparison'; operator = '>='; left = @{ type = 'VariableRef'; variableId = @{ alias = 'score' }; scope = 'Global' }; right = @{ type = 'Constant'; value = 0 } },
                @{ type = 'ScriptRef'; scriptId = @{ alias = 'check' } }
            ) }
            parameterModifiers = @(@{ targetVariableId = @{ alias = 'local' }; targetScope = 'NodeLocal'; operation = 'Add'; source = @{ type = 'Constant'; value = 1 } })
            presentation = @{ type = 'Graph'; graphId = @{ alias = 'intro' } }
        } },
        @{ op = 'presentation.create'; alias = 'intro'; data = @{ name = 'Door Sequence' } },
        @{ op = 'presentationNode.create'; alias = 'branch'; graph = @{ alias = 'intro' }; data = @{ name = 'Choose'; type = 'Branch'; position = @{ x = 0; y = 150 }; condition = @{ type = 'Literal'; value = $true } } },
        @{ op = 'presentationNode.create'; alias = 'parallel'; graph = @{ alias = 'intro' }; data = @{ name = 'Parallel'; type = 'Parallel'; position = @{ x = 220; y = 0 } } },
        @{ op = 'presentationNode.create'; alias = 'wait'; graph = @{ alias = 'intro' }; data = @{ name = 'Wait'; type = 'Wait'; duration = 1; position = @{ x = 420; y = 200 } } },
        @{ op = 'presentationNode.create'; alias = 'play'; graph = @{ alias = 'intro' }; data = @{
            name = 'Effect'; type = 'PresentationNode'; position = @{ x = 640; y = 0 }
            presentation = @{ type = 'Script'; scriptId = @{ alias = 'effect' }; parameters = @(
                @{ paramName = 'ScoreValue'; source = @{ type = 'VariableRef'; variableId = @{ alias = 'score' }; scope = 'Global' } },
                @{ paramName = 'Duration'; kind = 'Temporary'; source = @{ type = 'Constant'; value = 1 }; tempVariable = @{ name = 'Duration'; type = 'integer' } }
            ) }
        } },
        @{ op = 'presentationEdge.connect'; graph = @{ alias = 'intro' }; from = @{ alias = 'branch' }; slot = 'true'; to = @{ alias = 'parallel' } },
        @{ op = 'presentationEdge.connect'; graph = @{ alias = 'intro' }; from = @{ alias = 'branch' }; slot = 'false'; to = @{ alias = 'wait' } },
        @{ op = 'presentationEdge.connect'; graph = @{ alias = 'intro' }; from = @{ alias = 'parallel' }; slot = 0; to = @{ alias = 'play' } },
        @{ op = 'presentationEdge.connect'; graph = @{ alias = 'intro' }; from = @{ alias = 'parallel' }; slot = 1; to = @{ alias = 'wait' } },
        @{ op = 'presentationEdge.connect'; graph = @{ alias = 'intro' }; from = @{ alias = 'wait' }; slot = 'next'; to = @{ alias = 'play' } },
        @{ op = 'presentation.setStart'; graph = @{ alias = 'intro' }; node = @{ alias = 'branch' } }
    )
}
$planPath = Join-Path $WorkDirectory 'creation-plan.json'
$source = Join-Path $WorkDirectory 'Advanced.puzzle.json'
Write-Json $planPath $plan
$created = Invoke-Puzzle -CliArgs @('create', '--name', 'Advanced Demo', '--root-asset-name', 'AdvancedRoot', '--plan', $planPath, '--out', $source, '--json')
$validation = Invoke-Puzzle -CliArgs @('validate', $source, '--json')
$exportPath = Join-Path $WorkDirectory 'Advanced.export.json'
$exported = Invoke-Puzzle -CliArgs @('export', $source, '--out', $exportPath, '--json')
$read = Invoke-Puzzle -CliArgs @('json', 'read', $exportPath, '--json')
$namesPath = Join-Path $WorkDirectory 'names.json'
Write-Json $namesPath @{
    apiVersion = '1.0.0'; sourceHash = $read.data.source.sha256
    entries = @(@{ entity = @{ type = 'stage'; id = $read.data.file.data.stageTree.rootId }; assetName = 'ImportedRoot' })
}
$convertedPath = Join-Path $WorkDirectory 'Converted.puzzle.json'
$receiptPath = Join-Path $WorkDirectory 'import-receipt.json'
$preview = Invoke-Puzzle -CliArgs @('import', 'preview', $exportPath, '--names', $namesPath, '--out', $convertedPath, '--receipt-out', $receiptPath, '--json')
$converted = Invoke-Puzzle -CliArgs @('import', 'apply', $exportPath, '--names', $namesPath, '--out', $convertedPath, '--receipt', $receiptPath, '--json')
$validatedImport = Invoke-Puzzle -CliArgs @('validate', $convertedPath, '--json')
[pscustomobject]@{ output = $source; export = $exportPath; converted = $convertedPath; validated = $validation.ok; aliases = $created.data.aliases } | ConvertTo-Json -Depth 10

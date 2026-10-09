# 安装入口只转发给共同服务；默认不需要管理员或全局 Node。
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'runtime/node.exe') (Join-Path $PSScriptRoot 'app/cli.js') setup install --source $PSScriptRoot @args
exit $LASTEXITCODE

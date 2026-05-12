param(
  [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $PSScriptRoot "local-env.ps1") -EnvFile $EnvFile

Set-Location $root
$env:PORT = "8080"
pnpm.cmd --filter @workspace/api-server run build
pnpm.cmd --filter @workspace/api-server run start

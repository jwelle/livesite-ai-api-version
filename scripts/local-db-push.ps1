param(
  [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $PSScriptRoot "local-env.ps1") -EnvFile $EnvFile

Set-Location $root
pnpm.cmd --filter @workspace/db run push

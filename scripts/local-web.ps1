param(
  [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $PSScriptRoot "local-env.ps1") -EnvFile $EnvFile

Set-Location $root
$env:PORT = "8081"
$env:BASE_PATH = "/"
pnpm.cmd --filter @workspace/live-site-ai run dev

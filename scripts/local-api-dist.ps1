param(
  [string]$EnvFile = ".env.local",
  [string]$Port = "8080"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $PSScriptRoot "local-env.ps1") -EnvFile $EnvFile

Set-Location $root
$env:PORT = $Port
node.exe --enable-source-maps "./artifacts/api-server/dist/index.mjs"

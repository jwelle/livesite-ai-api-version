param(
  [string]$EnvFile = ".env.local"
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $root $EnvFile
$portableNode = Join-Path $root ".tools\node-v24.15.0-win-x64"

if (Test-Path (Join-Path $portableNode "node.exe")) {
  $env:PATH = "$portableNode;$env:PATH"
}

if (!(Test-Path $envPath)) {
  Write-Error "Missing $EnvFile. Copy .env.example to $EnvFile and fill in local values."
  exit 1
}

Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if (!$line -or $line.StartsWith("#")) {
    return
  }

  $parts = $line.Split("=", 2)
  if ($parts.Count -ne 2) {
    return
  }

  $name = $parts[0].Trim()
  $value = $parts[1].Trim()
  if (
    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
    ($value.StartsWith("'") -and $value.EndsWith("'"))
  ) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

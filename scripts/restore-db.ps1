# Restore PostgreSQL database for LonghuaCRM (Windows / PowerShell).
# WARNING: overwrites the target database.
#
# Usage:
#   .\scripts\restore-db.ps1 -BackupFile backups\longhua-20260101-120000.dump
#   .\scripts\restore-db.ps1 -BackupFile backups\longhua.dump -Docker

param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [switch]$Docker
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  Write-Error "Backup file not found: $BackupFile"
}

$confirm = Read-Host "This will REPLACE the database. Continue? [y/N]"
if ($confirm -notin @('y', 'Y')) {
  Write-Host "Aborted."
  exit 0
}

if ($Docker) {
  $Container = if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { "longhua-postgres" }
  $DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "longhua" }
  $DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
  $Remote = "/tmp/restore.dump"
  docker cp $BackupFile "${Container}:${Remote}"
  docker exec $Container pg_restore -U $DbUser -d $DbName --clean --if-exists $Remote
  docker exec $Container rm -f $Remote
  Write-Host "Restore completed from $BackupFile"
  exit 0
}

$RootDir = Split-Path -Parent $PSScriptRoot
if (-not $env:DATABASE_URL) {
  $EnvFile = Join-Path $RootDir ".env"
  if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
      if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"')
        Set-Item -Path "env:$name" -Value $value
      }
    }
  }
}

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL is not set."
}

pg_restore -d $env:DATABASE_URL --clean --if-exists $BackupFile
Write-Host "Restore completed from $BackupFile"

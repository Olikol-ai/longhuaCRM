# Backup PostgreSQL database for LonghuaCRM (Windows / PowerShell).
# Usage:
#   .\scripts\backup-db.ps1
#   .\scripts\backup-db.ps1 -Docker

param(
  [switch]$Docker
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $RootDir "backups" }
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutputFile = Join-Path $BackupDir "longhua-$Timestamp.dump"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

if ($Docker) {
  $Container = if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { "longhua-postgres" }
  $DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "longhua" }
  $DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
  $RemotePath = "/tmp/backup-$Timestamp.dump"
  docker exec $Container pg_dump -U $DbUser -d $DbName -Fc -f $RemotePath
  docker cp "${Container}:${RemotePath}" $OutputFile
  docker exec $Container rm -f $RemotePath
  Write-Host "Backup saved: $OutputFile"
  exit 0
}

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
  Write-Error "DATABASE_URL is not set. Use .env, set env var, or pass -Docker."
}

pg_dump $env:DATABASE_URL -Fc -f $OutputFile
Write-Host "Backup saved: $OutputFile"

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path -LiteralPath '.git')) {
        throw 'This workspace is not a Git repository.'
    }
    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
        throw 'Git for Windows is not installed or is not available in PATH.'
    }

    $tracked = @(& git ls-files)
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read tracked Git files.' }

    $sensitivePattern = '(^|/)(\.env($|\.)|storage/|data/|db\.json$|database\.json$|config\.yml$|cloudflared/.*\.(json|pem)$|.*\.(db|db-wal|db-shm)$|.*\.log$)'
    $safePlaceholders = @(
        '.env.example',
        'storage/backups/.gitkeep',
        'storage/cache/maps/.gitkeep',
        'storage/database/.gitkeep',
        'storage/logs/.gitkeep',
        'storage/uploads/events/.gitkeep',
        'storage/uploads/teams/.gitkeep'
    )
    $sensitive = @($tracked | Where-Object {
        $normalized = $_ -replace '\\','/'
        $normalized -match $sensitivePattern -and $normalized -notin $safePlaceholders
    })
    if ($sensitive.Count -gt 0) {
        throw "Sensitive or local runtime files are tracked by Git. Remove them from the Git index and rotate any exposed secrets before publishing: $($sensitive -join ', ')"
    }

    $fontBinaries = @($tracked | Where-Object { ($_ -replace '\\','/') -match '^public/assets/fonts/.+\.(ttf|otf|woff2?)$' })
    if ($fontBinaries.Count -gt 0) {
        throw "Font binaries are tracked but no redistribution review is recorded. Remove unlicensed fonts from Git history before publishing: $($fontBinaries -join ', ')"
    }

    $required = @('README.md','LICENSE','SECURITY.md','CONTRIBUTING.md','THIRD_PARTY_NOTICES.md','.env.example','.github/workflows/ci.yml')
    $missing = @($required | Where-Object { -not (Test-Path -LiteralPath $_) })
    if ($missing.Count -gt 0) { throw "Open-source files are missing: $($missing -join ', ')" }

    Write-Host 'Open-source preflight passed.' -ForegroundColor Green
} finally {
    Pop-Location
}

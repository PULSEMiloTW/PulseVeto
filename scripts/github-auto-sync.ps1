[CmdletBinding()]
param(
    [string]$CommitPrefix = 'chore: automated local sync'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$lockPath = Join-Path $env:TEMP 'pulse-map-veto-github-sync.lock'

if (Test-Path -LiteralPath $lockPath) {
    $age = (Get-Date) - (Get-Item -LiteralPath $lockPath).LastWriteTime
    if ($age.TotalMinutes -lt 30) { exit 0 }
    Remove-Item -LiteralPath $lockPath -Force
}

New-Item -ItemType File -Path $lockPath -Force | Out-Null
Push-Location $projectRoot
try {
    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
        throw 'Git for Windows is not installed or is not available in PATH.'
    }

    & "$PSScriptRoot\open-source-preflight.ps1"
    if ($LASTEXITCODE -ne 0) { throw 'Open-source preflight failed.' }

    $remote = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remote)) {
        throw 'Git remote origin is not configured.'
    }

    $branch = (& git branch --show-current).Trim()
    if ([string]::IsNullOrWhiteSpace($branch)) { throw 'Git is not currently on a branch.' }

    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Type check failed; nothing was published.' }
    & npm run test:unit
    if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed; nothing was published.' }

    $publishPaths = @(
        '.github','cloudflared','docs','prisma','public','scripts','src','tests',
        '.env.example','.gitignore','README.md','LICENSE','SECURITY.md',
        'CONTRIBUTING.md','THIRD_PARTY_NOTICES.md','package.json','package-lock.json',
        'tsconfig.json','vitest.config.ts','vitest.integration.config.ts'
    )
    & git add -A -- @publishPaths
    if ($LASTEXITCODE -ne 0) { throw 'Unable to stage approved project paths.' }

    $staged = @(& git diff --cached --name-only)
    if ($staged.Count -eq 0) {
        Write-Host 'No approved changes to publish.'
        exit 0
    }

    $forbiddenPattern = '(^|/)(\.env($|\.)|storage/|data/|db\.json$|database\.json$|config\.yml$|cloudflared/.*\.(json|pem)$|.*\.(db|db-wal|db-shm)$|.*\.log$|public/assets/fonts/.+\.(ttf|otf|woff2?)$)'
    $forbidden = @($staged | Where-Object { ($_ -replace '\\','/') -match $forbiddenPattern })
    if ($forbidden.Count -gt 0) {
        & git restore --staged -- @forbidden
        throw "Publishing stopped because forbidden files were staged: $($forbidden -join ', ')"
    }

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss K'
    & git commit -m "$CommitPrefix ($stamp)"
    if ($LASTEXITCODE -ne 0) { throw 'Git commit failed.' }

    & git pull --rebase origin $branch
    if ($LASTEXITCODE -ne 0) { throw 'Git pull --rebase failed. Resolve the conflict before automatic sync can continue.' }
    & git push origin $branch
    if ($LASTEXITCODE -ne 0) { throw 'Git push failed. Verify GitHub authentication and branch permissions.' }

    Write-Host "Published $branch to origin successfully." -ForegroundColor Green
} finally {
    Pop-Location
    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}

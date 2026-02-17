param(
  [string]$Branch = "vercel",
  [string]$Remote = "origin",
  [string]$CommitMessage = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Robocopy {
  param(
    [Parameter(Mandatory = $true)][string]$From,
    [Parameter(Mandatory = $true)][string]$To,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & robocopy $From $To @Arguments | Out-Null
  $code = $LASTEXITCODE
  if ($code -gt 7) {
    throw "robocopy failed with exit code $code"
  }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tmp = Join-Path $env:TEMP ("vercel-sync-" + [guid]::NewGuid().ToString("N"))

try {
  Push-Location $root

  git rev-parse --is-inside-work-tree 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Current directory is not a git repository."
  }

  git remote get-url $Remote 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Git remote '$Remote' does not exist."
  }

  Pop-Location

  git clone --quiet --no-hardlinks $root $tmp | Out-Null

  Push-Location $tmp

  $remoteBranchLine = git ls-remote --heads $Remote $Branch
  if ([string]::IsNullOrWhiteSpace($remoteBranchLine)) {
    git checkout --orphan $Branch | Out-Null
    git rm -rf . 2>$null | Out-Null
  }
  else {
    git fetch $Remote $Branch | Out-Null
    git checkout -B $Branch "$Remote/$Branch" | Out-Null
  }

  Get-ChildItem -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
  Pop-Location

  Invoke-Robocopy -From $root -To $tmp -Arguments @(
    "/E",
    "/XD", ".git", "node_modules", "apps\\api\\node_modules", "apps\\web\\node_modules", "apps\\api\\dist", "apps\\web\\dist",
    "/XF", "apps\\api\\.env", "apps\\web\\.env", "*.tsbuildinfo"
  )

  $overlay = Join-Path $root "deployment/vercel-overlay"
  if (-not (Test-Path $overlay)) {
    throw "Missing overlay folder: $overlay"
  }

  Invoke-Robocopy -From $overlay -To $tmp -Arguments @("/E")

  Push-Location $tmp

  git add -A

  $pending = git status --porcelain
  if (-not [string]::IsNullOrWhiteSpace($pending)) {
    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
      $CommitMessage = "chore: sync vercel snapshot " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
    git commit -m $CommitMessage | Out-Null
  }

  git push $Remote $Branch --force | Out-Null
  Pop-Location

  Write-Host "Vercel branch '$Branch' synced and pushed to '$Remote'."
}
finally {
  if (Test-Path $tmp) {
    Remove-Item -Recurse -Force $tmp
  }
}

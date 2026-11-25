<#
  One-time setup for Windows / VS Code.
  Run from the project root:
      powershell -ExecutionPolicy Bypass -File .\setup.ps1
#>
$root = $PSScriptRoot
Write-Host "== IPL Insight setup ==" -ForegroundColor Cyan

function Fail($msg) { Write-Host $msg -ForegroundColor Red; exit 1 }

# --- Find Python 3.10 - 3.13 (the saved models need scikit-learn 1.6.1, which has no wheels for 3.14+) ---
$candidates = @( @("py", "-3.12"), @("py", "-3.13"), @("py", "-3.11"), @("py", "-3.10"), @("python") )
$pyExe = $null; $pyArgs = @()
foreach ($c in $candidates) {
  $exe = $c[0]
  $extra = @()
  if ($c.Length -gt 1) { $extra = $c[1..($c.Length - 1)] }
  try {
    $ver = & $exe @extra --version 2>$null
    if ($LASTEXITCODE -eq 0 -and "$ver" -match "Python 3\.(1[0-3])\.") { $pyExe = $exe; $pyArgs = $extra; break }
  } catch { }
}
if (-not $pyExe) {
  Fail "Python 3.10-3.13 was not found. Install Python 3.12 from https://www.python.org/downloads/ (tick 'Add python.exe to PATH'), then run this script again."
}
Write-Host ("Using: " + (& $pyExe @pyArgs --version))

# --- Backend ---
Set-Location "$root\backend"
if (-not (Test-Path ".venv\Scripts\python.exe")) {
  Write-Host "Creating virtual environment (backend\.venv)..."
  & $pyExe @pyArgs -m venv .venv
  if ($LASTEXITCODE -ne 0) { Fail "Could not create the virtual environment." }
}
Write-Host "Installing backend packages (this can take a few minutes)..."
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { Fail "Installing backend requirements failed. See the messages above and the README troubleshooting section." }
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

# --- Frontend ---
Set-Location "$root\frontend"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js was not found. Install the LTS version from https://nodejs.org/ and run this script again."
}
Write-Host "Installing frontend packages..."
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

Set-Location $root
Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Start everything with:  powershell -ExecutionPolicy Bypass -File .\start-all.ps1"
if (-not (Test-Path "backend\data\ball_by_ball_dataset.csv")) {
  Write-Host "Note: backend\data\ball_by_ball_dataset.csv is not present, so the historical analytics pages will ask for it. Predictions work without it." -ForegroundColor Yellow
}

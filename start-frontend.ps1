# Starts the React dev server on http://localhost:5173

Set-Location "$PSScriptRoot\frontend"
if (-not (Test-Path "node_modules")) { Write-Host "Run setup.ps1 first." -ForegroundColor Red; exit 1 }
npm run dev

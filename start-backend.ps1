# Starts the FastAPI backend on http://localhost:8000  (API docs at /docs)

Set-Location "$PSScriptRoot\backend"
if (-not (Test-Path ".venv\Scripts\python.exe")) { Write-Host "Run setup.ps1 first." -ForegroundColor Red; exit 1 }
Write-Host "Starting API on http://localhost:8000 (loading models takes a few seconds)..." -ForegroundColor Cyan
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

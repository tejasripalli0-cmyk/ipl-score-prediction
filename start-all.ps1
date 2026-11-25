# Opens the backend and frontend in two PowerShell windows, then opens the site.
$here = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$here\start-backend.ps1`""
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$here\start-frontend.ps1`""
Start-Sleep -Seconds 8
Start-Process "http://localhost:5173"

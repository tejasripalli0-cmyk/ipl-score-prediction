# Runs the backend test-suite (needs the dev requirements) and the frontend smoke tests.

Set-Location "$PSScriptRoot\backend"
& .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
& .\.venv\Scripts\python.exe -m pytest -q
Set-Location "$PSScriptRoot\frontend"
npm test

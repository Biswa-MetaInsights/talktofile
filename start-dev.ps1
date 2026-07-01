# Talktofile — Dev Startup Script
# Run from the talktofile/ root directory

Write-Host "Starting Talktofile in development mode..." -ForegroundColor Cyan

# Check .env
if (-not (Test-Path "backend\.env")) {
    Write-Host "ERROR: backend\.env not found. Copy backend\.env.example to backend\.env and fill in your API key." -ForegroundColor Red
    exit 1
}

# Start backend
Write-Host "Starting backend on http://localhost:9099 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; .\venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 9099"

Start-Sleep 2

# Start frontend
Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"

Write-Host ""
Write-Host "Talktofile is starting up!" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:9099" -ForegroundColor White
Write-Host "  API Docs: http://localhost:9099/api/docs" -ForegroundColor White

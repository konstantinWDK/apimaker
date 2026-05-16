# Script to start the DoApi backend on Windows (PowerShell)

$BACKEND_DIR = Get-Location
Write-Host "Starting DoApi Backend..."

# Check if .venv exists
if (!(Test-Path ".venv")) {
    Write-Host "Error: .venv directory not found."
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..."
& ".\.venv\Scripts\Activate.ps1"

# Seed admin user if needed
Write-Host "Checking admin user..."
python -m app.scripts.seed_admin

Write-Host "Starting server at http://127.0.0.1:8000"
Write-Host "Documentation at http://127.0.0.1:8000/docs"

# Run uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

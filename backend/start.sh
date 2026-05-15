#!/bin/bash

# Script to start the API Maker backend using the virtual environment

# Get the directory where this script is located
BACKEND_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$BACKEND_DIR"

echo "🚀 Starting API Maker Backend..."

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo "❌ Error: .venv directory not found in $BACKEND_DIR"
    echo "Please create it first using: python3 -m venv .venv && source .venv/bin/activate && pip install -e ."
    exit 1
fi

# Activate virtual environment and run uvicorn
echo "📦 Activating virtual environment..."
source .venv/bin/activate

echo "⚙️ Running migrations (optional)..."
# python3 -m alembic upgrade head || echo "⚠️ Warning: Migrations failed or not configured."

echo "🔥 Starting server at http://127.0.0.1:8000"
echo "📚 Documentation at http://127.0.0.1:8000/docs"
echo "------------------------------------------------"

# Run uvicorn
# --reload: auto-restarts on code changes
# --host 0.0.0.0: allows external access if needed
# app.main:app: point to the FastAPI instance
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

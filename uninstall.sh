#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    else
        echo ""
    fi
}

stop_port() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti "tcp:$port" | xargs -r kill || true
    elif command -v fuser >/dev/null 2>&1; then
        fuser -k "${port}/tcp" >/dev/null 2>&1 || true
    fi
}

echo -e "${RED}WARNING: This will delete configuration, users, local databases and installed dependencies.${NC}"
read -r -p "Are you sure you want to continue? Type y to confirm: " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Operation cancelled."
    exit 0
fi

DOCKER_CMD="$(compose_cmd)"

echo -e "${BLUE}Stopping Docker services of this project...${NC}"
if [ -n "$DOCKER_CMD" ]; then
    $DOCKER_CMD --profile postgres --profile mysql down --volumes --remove-orphans || true
else
    echo -e "${YELLOW}Docker Compose not available; skipping container shutdown.${NC}"
fi

echo -e "${BLUE}Stopping local processes on ports 8000 and 5173...${NC}"
stop_port 8000
stop_port 5173

echo -e "${BLUE}Cleaning up files...${NC}"

echo "  - Backend..."
rm -rf backend/.venv
rm -f backend/app/data/*.db
rm -f backend/app/data/*.json
rm -f backend/app/data/*.sqlite
rm -f backend/.env
find backend -name "__pycache__" -type d -prune -exec rm -rf {} +
find backend -name ".pytest_cache" -type d -prune -exec rm -rf {} +

echo "  - Frontend..."
rm -rf frontend/node_modules
rm -rf frontend/dist
rm -rf frontend/.vite

echo "  - Root..."
rm -f .env
rm -f start.sh
rm -f start.bat
rm -rf .pytest_cache
find . -maxdepth 2 -name "*.log" -delete

echo -e "${GREEN}The project has been restored to its initial state.${NC}"
echo "You can now run ./install.sh to start a new installation."

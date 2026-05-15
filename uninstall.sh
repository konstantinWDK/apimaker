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

echo -e "${RED}AVISO: Esto eliminara configuracion, usuarios, bases de datos locales y dependencias instaladas.${NC}"
read -r -p "Estas seguro de que quieres continuar? Escribe y para confirmar: " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Operacion cancelada."
    exit 0
fi

DOCKER_CMD="$(compose_cmd)"

echo -e "${BLUE}Deteniendo servicios Docker de este proyecto...${NC}"
if [ -n "$DOCKER_CMD" ]; then
    $DOCKER_CMD --profile postgres --profile mysql down --volumes --remove-orphans || true
else
    echo -e "${YELLOW}Docker Compose no disponible; se omite parada de contenedores.${NC}"
fi

echo -e "${BLUE}Deteniendo procesos locales en puertos 8000 y 5173...${NC}"
stop_port 8000
stop_port 5173

echo -e "${BLUE}Limpiando archivos...${NC}"

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

echo "  - Raiz..."
rm -f .env
rm -f start.sh
rm -f start.bat
rm -rf .pytest_cache
find . -maxdepth 2 -name "*.log" -delete

echo -e "${GREEN}El proyecto ha sido restaurado a su estado inicial.${NC}"
echo "Ahora puedes ejecutar ./install.sh para comenzar una nueva instalacion."

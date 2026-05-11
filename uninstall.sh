#!/bin/bash

# API Maker - Clean/Uninstall Script
# Deja el proyecto como recién clonado

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}⚠️  AVISO: Esto eliminará toda la configuración, usuarios y bases de datos.${NC}"
read -p "¿Estás seguro de que quieres continuar? (y/n) " CONFIRM

if [[ $CONFIRM != "y" ]]; then
    echo "Operación cancelada."
    exit 0
fi

echo -e "${BLUE}🛑 Deteniendo procesos...${NC}"
# Detener Docker
if command -v docker-compose &> /dev/null; then
    docker-compose down --volumes --remove-orphans || true
fi

# Matar procesos locales
pkill -f "uvicorn" || true
pkill -f "vite" || true
pkill -f "node" || true

echo -e "${BLUE}🧹 Limpiando archivos...${NC}"

# Backend
echo "  - Limpiando Backend..."
rm -rf backend/.venv
rm -rf backend/app/data/*.db
rm -rf backend/app/data/*.json
rm -rf backend/app/data/*.sqlite
rm -rf backend/.env
find backend -name "__pycache__" -type d -exec rm -rf {} +
find backend -name ".pytest_cache" -type d -exec rm -rf {} +

# Frontend
echo "  - Limpiando Frontend..."
rm -rf frontend/node_modules
rm -rf frontend/dist
rm -rf frontend/.vite
find frontend -name "node_modules" -type d -exec rm -rf {} +

# Raíz
echo "  - Limpiando archivos temporales..."
rm -rf .pytest_cache
rm -rf .DS_Store
find . -name "*.log" -delete

echo -e "${GREEN}✅ El proyecto ha sido restaurado a su estado inicial.${NC}"
echo "Ahora puedes ejecutar ./install.sh para comenzar una nueva instalación."

#!/bin/bash

# API Maker - Advanced Installer (Linux/macOS)
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   🚀 API Maker - Configuración        ${NC}"
echo -e "${BLUE}=======================================${NC}"

# 1. Dependencias
echo -e "${BLUE}📦 Instalando dependencias...${NC}"
cd backend
if [ ! -d ".venv" ]; then
    python3 -m venv .venv || python -m venv .venv
fi
source .venv/bin/activate
pip install -e ".[dev]"
cd ..

cd frontend
npm install
cd ..

# 2. Configuración de Administrador
echo ""
echo -e "${YELLOW}👤 CONFIGURACIÓN DEL ADMINISTRADOR${NC}"
read -p "Introduce el nombre de usuario [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

# Leer contraseña de forma segura
echo -n "Introduce la contraseña para $ADMIN_USER [admin]: "
read -s ADMIN_PASS
echo ""
ADMIN_PASS=${ADMIN_PASS:-admin}

# 3. Configuración de Base de Datos
echo ""
echo -e "${YELLOW}🗄️  CONFIGURACIÓN DE BASE DE DATOS${NC}"
echo "1) SQLite (Local, sin configuración)"
echo "2) PostgreSQL (Remota/Local, requiere datos)"
read -p "Elige una opción [1]: " DB_OPTION
DB_OPTION=${DB_OPTION:-1}

DB_TYPE="sqlite"
if [ "$DB_OPTION" == "2" ]; then
    DB_TYPE="postgresql"
    read -p "Host de Postgres [localhost]: " PG_HOST
    PG_HOST=${PG_HOST:-localhost}
    read -p "Puerto [5432]: " PG_PORT
    PG_PORT=${PG_PORT:-5432}
    read -p "Usuario de Postgres [postgres]: " PG_USER
    PG_USER=${PG_USER:-postgres}
    echo -n "Contraseña de Postgres: "
    read -s PG_PASS
    echo ""
    read -p "Nombre de la base de datos [apimaker]: " PG_DB
    PG_DB=${PG_DB:-apimaker}
    
    DB_URL="postgresql+psycopg2://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/$PG_DB"
    export APIMAKER_DATABASE_URL=$DB_URL
    
    # Crear archivo de configuración para el backend
    mkdir -p backend/app/data
    cat <<EOF > backend/app/data/admin_config.json
{
  "dev": {
    "database_type": "postgresql",
    "postgres_url": "$DB_URL",
    "host": "$PG_HOST",
    "port": $PG_PORT,
    "username": "$PG_USER",
    "password": "$PG_PASS",
    "database": "$PG_DB"
  },
  "prod": {
    "database_type": "postgresql",
    "postgres_url": "$DB_URL"
  }
}
EOF
    echo -e "${GREEN}✅ Configuración de Postgres guardada.${NC}"
fi

# 4. Seeding
echo -e "${BLUE}🌱 Inicializando base de datos y usuario...${NC}"
cd backend
./.venv/bin/python app/scripts/seed_admin.py --username "$ADMIN_USER" --password "$ADMIN_PASS"
cd ..

# 5. Datos de prueba
read -p "¿Quieres importar el proyecto de ejemplo Pokedex? (y/n) [y]: " IMPORT_POKEDEX
IMPORT_POKEDEX=${IMPORT_POKEDEX:-y}

if [ "$IMPORT_POKEDEX" == "y" ]; then
    echo -e "${BLUE}🦖 Importando Pokedex...${NC}"
    cd backend
    ./.venv/bin/python migrate_json_to_db.py || echo "Aviso: No se pudo importar el JSON inicial."
    ./.venv/bin/python repair_pokedex.py || echo "Aviso: No se pudo reparar el proyecto Pokedex."
    cd ..
fi

# 6. Docker
echo ""
echo -e "${YELLOW}🐳 DOCKER${NC}"
read -p "¿Quieres levantar la app ahora mismo con Docker? (y/n) [n]: " USE_DOCKER
USE_DOCKER=${USE_DOCKER:-n}

if [ "$USE_DOCKER" == "y" ]; then
    echo -e "${BLUE}🚀 Construyendo y levantando contenedores...${NC}"
    docker-compose up -d --build
    echo -e "${GREEN}✅ ¡Listo! Accede a http://localhost:5173${NC}"
    exit 0
fi

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}✅ INSTALACIÓN COMPLETADA CON ÉXITO${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo "Para arrancar la aplicación manualmente:"
echo -e "1. Backend:  ${BLUE}cd backend && ./start.sh${NC}"
echo -e "2. Frontend: ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo -e "Acceso: ${YELLOW}$ADMIN_USER${NC}"
echo "URL: http://localhost:5173"
echo ""

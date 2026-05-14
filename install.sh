#!/bin/bash

# API Maker - Advanced Installer (Linux/macOS)
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   🚀 API Maker - Configuración        ${NC}"
echo -e "${BLUE}=======================================${NC}"

# ─── 1. Dependencias ──────────────────────────────────────
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

# ─── 2. Admin ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}👤 CONFIGURACIÓN DEL ADMINISTRADOR${NC}"
read -p "Introduce el nombre de usuario [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

echo -n "Introduce la contraseña para $ADMIN_USER [admin]: "
read -s ADMIN_PASS
echo ""
ADMIN_PASS=${ADMIN_PASS:-admin}

# ─── 3. Base de Datos (AHORA PRIMERO) ─────────────────────
echo ""
echo -e "${YELLOW}🗄️  CONFIGURACIÓN DE BASE DE DATOS${NC}"
echo "1) SQLite (local, rápida)"
echo "2) PostgreSQL"
echo "3) MySQL / MariaDB"
read -p "Elige una opción [1]: " DB_CHOICE
DB_CHOICE=${DB_CHOICE:-1}

DB_TYPE="sqlite"
DB_URL=""
NEED_DOCKER_DB=false

if [ "$DB_CHOICE" == "1" ]; then
    DB_TYPE="sqlite"
    DB_URL="sqlite:///./app/data/apimaker.db"
fi

if [ "$DB_CHOICE" == "2" ]; then
    DB_TYPE="postgresql"
    echo ""
    echo "1) Usar PostgreSQL existente"
    echo "2) Crear nuevo PostgreSQL en Docker"
    read -p "Elige una opción [2]: " DB_SUB
    DB_SUB=${DB_SUB:-2}
    
    if [ "$DB_SUB" == "1" ]; then
        read -p "Host [localhost]: " PG_HOST; PG_HOST=${PG_HOST:-localhost}
        read -p "Puerto [5432]: " PG_PORT; PG_PORT=${PG_PORT:-5432}
        read -p "Usuario [postgres]: " PG_USER; PG_USER=${PG_USER:-postgres}
        echo -n "Contraseña: "; read -s PG_PASS; echo ""
        read -p "Nombre BD [apimaker]: " PG_DB; PG_DB=${PG_DB:-apimaker}
    else
        NEED_DOCKER_DB=true
        PG_HOST="localhost"; PG_PORT=5432; PG_USER="apimaker"; PG_DB="apimaker"
        PG_PASS=$(openssl rand -base64 12 2>/dev/null || echo "apimaker_secret_$(date +%s)")
        echo -e "${CYAN}   → Se generará un contenedor PostgreSQL.${NC}"
    fi
    DB_URL="postgresql+psycopg2://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/$PG_DB"
fi

if [ "$DB_CHOICE" == "3" ]; then
    DB_TYPE="mysql"
    echo ""
    echo "1) Usar MySQL/MariaDB existente"
    echo "2) Crear nuevo MySQL en Docker"
    read -p "Elige una opción [2]: " DB_SUB
    DB_SUB=${DB_SUB:-2}
    
    if [ "$DB_SUB" == "1" ]; then
        read -p "Host [localhost]: " MY_HOST; MY_HOST=${MY_HOST:-localhost}
        read -p "Puerto [3306]: " MY_PORT; MY_PORT=${MY_PORT:-3306}
        read -p "Usuario [root]: " MY_USER; MY_USER=${MY_USER:-root}
        echo -n "Contraseña: "; read -s MY_PASS; echo ""
        read -p "Nombre BD [apimaker]: " MY_DB; MY_DB=${MY_DB:-apimaker}
    else
        NEED_DOCKER_DB=true
        MY_HOST="localhost"; MY_PORT=3306; MY_USER="apimaker"; MY_DB="apimaker"
        MY_PASS=$(openssl rand -base64 12 2>/dev/null || echo "apimaker_secret_$(date +%s)")
        echo -e "${CYAN}   → Se generará un contenedor MySQL.${NC}"
    fi
    DB_URL="mysql+pymysql://$MY_USER:$MY_PASS@$MY_HOST:$MY_PORT/$MY_DB"
fi

# ─── 4. Despliegue ────────────────────────────────────────
echo ""
echo -e "${YELLOW}🐳 DESPLIEGUE${NC}"
read -p "¿Quieres levantar la app con Docker? (y/n) [n]: " USE_DOCKER
USE_DOCKER=${USE_DOCKER:-n}

# ─── 5. Generar .env y Levantar DB si es necesario ────────
DB_URL_DOCKER=$DB_URL
if [ "$USE_DOCKER" == "y" ]; then
    if [ "$DB_TYPE" == "postgresql" ] && [ "$NEED_DOCKER_DB" == "true" ]; then DB_URL_DOCKER="postgresql+psycopg2://$PG_USER:$PG_PASS@postgres:5432/$PG_DB"; fi
    if [ "$DB_TYPE" == "mysql" ] && [ "$NEED_DOCKER_DB" == "true" ]; then DB_URL_DOCKER="mysql+pymysql://$MY_USER:$MY_PASS@mysql:3306/$MY_DB"; fi
fi

echo "APIMAKER_ENVIRONMENT=development" > .env
echo "APIMAKER_DATABASE_URL=$DB_URL_DOCKER" >> .env
echo "APIMAKER_JWT_SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo 'secret')" >> .env

if [ "$NEED_DOCKER_DB" == "true" ]; then
    echo -e "${BLUE}🧹 Limpiando instalaciones previas de base de datos...${NC}"
    docker compose --profile postgres --profile mysql down -v > /dev/null 2>&1
    
    if [ "$DB_TYPE" == "postgresql" ]; then
        echo "POSTGRES_USER=$PG_USER" >> .env
        echo "POSTGRES_PASSWORD=$PG_PASS" >> .env
        echo "POSTGRES_DB=$PG_DB" >> .env
        echo -e "${BLUE}🚀 Levantando PostgreSQL en Docker...${NC}"
        docker compose --profile postgres up -d \
          -e POSTGRES_USER="$PG_USER" \
          -e POSTGRES_PASSWORD="$PG_PASS" \
          -e POSTGRES_DB="$PG_DB" \
          postgres
    fi
    if [ "$DB_TYPE" == "mysql" ]; then
        echo "MYSQL_USER=$MY_USER" >> .env
        echo "MYSQL_PASSWORD=$MY_PASS" >> .env
        echo "MYSQL_DATABASE=$MY_DB" >> .env
        echo "MYSQL_ROOT_PASSWORD=${MY_PASS}_root" >> .env
        echo -e "${BLUE}🚀 Levantando MySQL en Docker...${NC}"
        docker compose --profile mysql up -d \
          -e MYSQL_USER="$MY_USER" \
          -e MYSQL_PASSWORD="$MY_PASS" \
          -e MYSQL_DATABASE="$MY_DB" \
          -e MYSQL_ROOT_PASSWORD="${MY_PASS}_root" \
          mysql
    fi
    echo -e "${CYAN}⌛ Esperando base de datos...${NC}"
    sleep 10
fi

# ─── 6. Seed y Demo ───────────────────────────────────────
echo -e "${BLUE}🌱 Inicializando base de datos...${NC}"
cd backend
export APIMAKER_DATABASE_URL=$DB_URL
./.venv/bin/python app/scripts/seed_admin.py --username "$ADMIN_USER" --password "$ADMIN_PASS"
cd ..

read -p "¿Importar proyecto Pokedex? (y/n) [y]: " IMPORT_DEMO
IMPORT_DEMO=${IMPORT_DEMO:-y}
if [ "$IMPORT_DEMO" == "y" ]; then
    cd backend
    export APIMAKER_DATABASE_URL=$DB_URL
    ./.venv/bin/python migrate_json_to_db.py
    ./.venv/bin/python repair_pokedex.py
    cd ..
fi

# ─── 7. Docker Final ──────────────────────────────────────
if [ "$USE_DOCKER" == "y" ]; then
    PROFILES=""
    if [ "$DB_TYPE" == "postgresql" ] && [ "$NEED_DOCKER_DB" == "true" ]; then PROFILES="--profile postgres"; fi
    if [ "$DB_TYPE" == "mysql" ] && [ "$NEED_DOCKER_DB" == "true" ]; then PROFILES="--profile mysql"; fi
    
    echo -e "${BLUE}🚀 Levantando servicios con Docker...${NC}"
    docker compose $PROFILES up -d --build
fi

echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}✅ INSTALACIÓN COMPLETADA${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "   Acceso:    ${BLUE}http://localhost:5173${NC}"
echo -e "   Usuario:   ${YELLOW}$ADMIN_USER${NC}"
echo -e "   Password:  ${YELLOW}$ADMIN_PASS${NC}"
echo -e "   Base Datos: ${CYAN}$DB_TYPE${NC}"
if [ "$NEED_DOCKER_DB" == "true" ]; then
    echo -e "${CYAN}   [!] BD ejecutándose en Docker.${NC}"
fi
echo ""



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

# ─── 3. Base de Datos ─────────────────────────────────────
echo ""
echo -e "${YELLOW}🗄️  CONFIGURACIÓN DE BASE DE DATOS${NC}"
echo "1) SQLite (Local — rápido, ideal para desarrollo)"
echo "2) PostgreSQL (Remota/Local — recomendado para producción)"
read -p "Elige una opción [1]: " DB_OPTION
DB_OPTION=${DB_OPTION:-1}

DB_TYPE="sqlite"
DB_URL=""

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

# ─── 4. Seed ──────────────────────────────────────────────
echo -e "${BLUE}🌱 Inicializando base de datos y usuario...${NC}"
cd backend
./.venv/bin/python app/scripts/seed_admin.py --username "$ADMIN_USER" --password "$ADMIN_PASS"
cd ..

# ─── 5. Demo ──────────────────────────────────────────────
read -p "¿Quieres importar el proyecto de ejemplo Pokedex? (y/n) [y]: " IMPORT_POKEDEX
IMPORT_POKEDEX=${IMPORT_POKEDEX:-y}

if [ "$IMPORT_POKEDEX" == "y" ]; then
    echo -e "${BLUE}🦖 Importando Pokedex...${NC}"
    cd backend
    ./.venv/bin/python migrate_json_to_db.py || echo "Aviso: No se pudo importar el JSON inicial."
    ./.venv/bin/python repair_pokedex.py || echo "Aviso: No se pudo reparar el proyecto Pokedex."
    cd ..
fi

# ─── 6. Docker ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}🐳 DESPLIEGUE CON DOCKER${NC}"
echo "¿Quieres levantar la app ahora mismo con Docker?"
read -p "  (y/n) [n]: " USE_DOCKER
USE_DOCKER=${USE_DOCKER:-n}

if [ "$USE_DOCKER" == "y" ]; then
    COMPOSE_FILES="-f docker-compose.yml"

    if [ "$DB_TYPE" == "postgresql" ]; then
        echo ""
        echo -e "${YELLOW}📦 Base de Datos PostgreSQL${NC}"
        echo "1) Usar mi PostgreSQL existente (el que configuraste antes)"
        echo "2) Crear uno nuevo en un contenedor Docker (auto-configurado)"
        read -p "Elige una opción [1]: " PG_OPTION
        PG_OPTION=${PG_OPTION:-1}

        if [ "$PG_OPTION" == "2" ]; then
            COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prod.yml"
            # Generar credenciales seguras
            DB_USER="apimaker"
            DB_PASS=$(openssl rand -base64 12 2>/dev/null || echo "apimaker_secret_$(date +%s)")
            DB_NAME="apimaker"
            
            export POSTGRES_USER=$DB_USER
            export POSTGRES_PASSWORD=$DB_PASS
            export POSTGRES_DB=$DB_NAME
            export APIMAKER_DATABASE_URL="postgresql://$DB_USER:$DB_PASS@postgres:5432/$DB_NAME"
            
            # Guardar .env para usos futuros
            cat <<EOF > .env
# Generado por el instalador de API Maker
APIMAKER_ENVIRONMENT=production
APIMAKER_DATABASE_URL=$APIMAKER_DATABASE_URL
APIMAKER_JWT_SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "change-me-in-production")
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_DB=$DB_NAME
EOF
            echo -e "${GREEN}✅ PostgreSQL en contenedor configurado.${NC}"
            echo -e "${CYAN}   Usuario: $DB_USER${NC}"
            echo -e "${CYAN}   Contraseña: $DB_PASS${NC}"
            echo -e "${CYAN}   Base de datos: $DB_NAME${NC}"
            echo -e "${CYAN}   (guardado en .env)${NC}"
        else
            # Usar PostgreSQL existente
            export APIMAKER_DATABASE_URL=$DB_URL
            echo -e "${GREEN}✅ Usando PostgreSQL existente: $PG_HOST:$PG_PORT/$PG_DB${NC}"
        fi
    else
        echo -e "${GREEN}✅ Usando SQLite (el backend compartirá el archivo de datos).${NC}"
    fi

    echo -e "${BLUE}🚀 Construyendo y levantando contenedores...${NC}"
    if docker compose version >/dev/null 2>&1; then
        docker compose $COMPOSE_FILES up -d --build
    else
        docker-compose $COMPOSE_FILES up -d --build
    fi
    
    echo ""
    echo -e "${GREEN}=======================================${NC}"
    echo -e "${GREEN}✅ INSTALACIÓN COMPLETADA CON ÉXITO${NC}"
    echo -e "${GREEN}=======================================${NC}"
    echo ""
    echo -e "   Frontend:  ${BLUE}http://localhost:5173${NC}"
    echo -e "   Backend:   ${BLUE}http://localhost:8000${NC}"
    echo -e "   Usuario:   ${YELLOW}$ADMIN_USER${NC}"
    if [ "$PG_OPTION" == "2" ] && [ "$DB_TYPE" == "postgresql" ]; then
        echo ""
        echo -e "${CYAN}📋 Credenciales de PostgreSQL:${NC}"
        echo -e "   Host:      localhost (mapeado al contenedor)"
        echo -e "   Puerto:    5432"
        echo -e "   Usuario:   $DB_USER"
        echo -e "   Contraseña: $DB_PASS"
        echo -e "   Base datos: $DB_NAME"
    fi
    exit 0
fi

# ─── Sin Docker ───────────────────────────────────────────
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}✅ INSTALACIÓN COMPLETADA CON ÉXITO${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo "Para arrancar la aplicación manualmente:"
echo -e "1. Backend:  ${BLUE}cd backend && source .venv/bin/activate && uvicorn app.main:app --reload${NC}"
echo -e "2. Frontend: ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo -e "Acceso: ${YELLOW}$ADMIN_USER${NC}"
echo "URL: http://localhost:5173"
echo ""

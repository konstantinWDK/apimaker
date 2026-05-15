#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

fail() {
    echo -e "${RED}ERROR: $*${NC}" >&2
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "Falta $2 ($1). Instalalo y vuelve a ejecutar este script."
}

compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    else
        echo ""
    fi
}

urlencode() {
    python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

random_hex() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$1"
    else
        python3 -c "import secrets; print(secrets.token_hex($1))"
    fi
}

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   API Maker - Configuracion${NC}"
echo -e "${BLUE}=======================================${NC}"

require_cmd python3 "Python 3.11+"
require_cmd npm "Node.js/npm"

DOCKER_CMD="$(compose_cmd)"

echo -e "${BLUE}Instalando dependencias...${NC}"
cd backend
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
mkdir -p app/data
cd ..

cd frontend
npm install
cd ..

echo ""
echo -e "${YELLOW}CONFIGURACION DEL ADMINISTRADOR${NC}"
read -r -p "Introduce el nombre de usuario [admin]: " ADMIN_USER
ADMIN_USER="${ADMIN_USER:-admin}"
read -r -s -p "Introduce la contrasena para $ADMIN_USER [admin]: " ADMIN_PASS
echo ""
ADMIN_PASS="${ADMIN_PASS:-admin}"

echo ""
echo -e "${YELLOW}CONFIGURACION DE BASE DE DATOS${NC}"
echo "1) SQLite (local, rapida)"
echo "2) PostgreSQL"
echo "3) MySQL / MariaDB"
read -r -p "Elige una opcion [1]: " DB_CHOICE
DB_CHOICE="${DB_CHOICE:-1}"

DB_TYPE="sqlite"
DB_URL="sqlite:///./app/data/apimaker.db"
DB_URL_DOCKER="$DB_URL"
NEED_DOCKER_DB=false

case "$DB_CHOICE" in
    1)
        ;;
    2)
        DB_TYPE="postgresql"
        echo ""
        echo "1) Usar PostgreSQL existente"
        echo "2) Crear nuevo PostgreSQL en Docker"
        read -r -p "Elige una opcion [2]: " DB_SUB
        DB_SUB="${DB_SUB:-2}"
        if [ "$DB_SUB" = "1" ]; then
            read -r -p "Host [localhost]: " PG_HOST; PG_HOST="${PG_HOST:-localhost}"
            read -r -p "Puerto [5432]: " PG_PORT; PG_PORT="${PG_PORT:-5432}"
            read -r -p "Usuario [postgres]: " PG_USER; PG_USER="${PG_USER:-postgres}"
            read -r -s -p "Contrasena: " PG_PASS; echo ""
            read -r -p "Nombre BD [apimaker]: " PG_DB; PG_DB="${PG_DB:-apimaker}"
        else
            NEED_DOCKER_DB=true
            PG_HOST="localhost"; PG_PORT="5432"; PG_USER="apimaker"; PG_DB="apimaker"
            if (echo > /dev/tcp/localhost/5432) >/dev/null 2>&1; then
                echo -e "${YELLOW}ADVERTENCIA: El puerto 5432 ya esta en uso.${NC}"
                echo -e "${YELLOW}Para crear la nueva base de datos en Docker necesitamos usar otro puerto.${NC}"
                read -r -p "Introduce el puerto a usar [5433]: " ALT_PORT
                ALT_PORT="${ALT_PORT:-5433}"
                if ! [[ "$ALT_PORT" =~ ^[0-9]+$ ]]; then
                    echo "Puerto invalido. Usando 5433 por defecto."
                    ALT_PORT="5433"
                fi
                PG_PORT="$ALT_PORT"
            fi
            PG_PASS="$(random_hex 12)"
            echo -e "${CYAN}Se generara un contenedor PostgreSQL en el puerto $PG_PORT.${NC}"
        fi
        PG_PASS_ENC="$(urlencode "$PG_PASS")"
        DB_URL="postgresql+psycopg2://$PG_USER:$PG_PASS_ENC@$PG_HOST:$PG_PORT/$PG_DB"
        DB_URL_DOCKER="$DB_URL"
        ;;
    3)
        DB_TYPE="mysql"
        echo ""
        echo "1) Usar MySQL/MariaDB existente"
        echo "2) Crear nuevo MySQL en Docker"
        read -r -p "Elige una opcion [2]: " DB_SUB
        DB_SUB="${DB_SUB:-2}"
        if [ "$DB_SUB" = "1" ]; then
            read -r -p "Host [localhost]: " MY_HOST; MY_HOST="${MY_HOST:-localhost}"
            read -r -p "Puerto [3306]: " MY_PORT; MY_PORT="${MY_PORT:-3306}"
            read -r -p "Usuario [root]: " MY_USER; MY_USER="${MY_USER:-root}"
            read -r -s -p "Contrasena: " MY_PASS; echo ""
            read -r -p "Nombre BD [apimaker]: " MY_DB; MY_DB="${MY_DB:-apimaker}"
        else
            NEED_DOCKER_DB=true
            MY_HOST="localhost"; MY_PORT="3306"; MY_USER="apimaker"; MY_DB="apimaker"
            if (echo > /dev/tcp/localhost/3306) >/dev/null 2>&1; then
                echo -e "${YELLOW}ADVERTENCIA: El puerto 3306 ya esta en uso.${NC}"
                echo -e "${YELLOW}Para crear la nueva base de datos en Docker necesitamos usar otro puerto.${NC}"
                read -r -p "Introduce el puerto a usar [3307]: " ALT_PORT
                ALT_PORT="${ALT_PORT:-3307}"
                if ! [[ "$ALT_PORT" =~ ^[0-9]+$ ]]; then
                    echo "Puerto invalido. Usando 3307 por defecto."
                    ALT_PORT="3307"
                fi
                MY_PORT="$ALT_PORT"
            fi
            MY_PASS="$(random_hex 12)"
            echo -e "${CYAN}Se generara un contenedor MySQL en el puerto $MY_PORT.${NC}"
        fi
        MY_PASS_ENC="$(urlencode "$MY_PASS")"
        DB_URL="mysql+pymysql://$MY_USER:$MY_PASS_ENC@$MY_HOST:$MY_PORT/$MY_DB"
        DB_URL_DOCKER="$DB_URL"
        ;;
    *)
        fail "Opcion de base de datos no valida."
        ;;
esac

echo ""
echo -e "${YELLOW}DESPLIEGUE${NC}"
read -r -p "Quieres levantar la app con Docker? (y/n) [n]: " USE_DOCKER
USE_DOCKER="${USE_DOCKER:-n}"

if [ "$USE_DOCKER" = "y" ]; then
    [ -n "$DOCKER_CMD" ] || fail "Docker Compose no esta disponible."
    if [ "$DB_TYPE" = "postgresql" ] && [ "$NEED_DOCKER_DB" = true ]; then
        DB_URL_DOCKER="postgresql+psycopg2://$PG_USER:$PG_PASS_ENC@postgres:5432/$PG_DB"
    fi
    if [ "$DB_TYPE" = "mysql" ] && [ "$NEED_DOCKER_DB" = true ]; then
        DB_URL_DOCKER="mysql+pymysql://$MY_USER:$MY_PASS_ENC@mysql:3306/$MY_DB"
    fi
fi

{
    echo "APIMAKER_ENVIRONMENT=development"
    echo "APIMAKER_DATABASE_URL=$DB_URL_DOCKER"
    echo "APIMAKER_JWT_SECRET_KEY=$(random_hex 32)"
} > .env

if [ "$NEED_DOCKER_DB" = true ]; then
    [ -n "$DOCKER_CMD" ] || fail "Docker Compose no esta disponible para crear la base de datos."
    echo -e "${BLUE}Limpiando bases de datos Docker previas de este proyecto...${NC}"
    $DOCKER_CMD --profile postgres --profile mysql down -v >/dev/null 2>&1 || true

    if [ "$DB_TYPE" = "postgresql" ]; then
        {
            echo "POSTGRES_USER=$PG_USER"
            echo "POSTGRES_PASSWORD=$PG_PASS"
            echo "POSTGRES_DB=$PG_DB"
            echo "POSTGRES_PORT=$PG_PORT"
        } >> .env
        echo -e "${BLUE}Levantando PostgreSQL en Docker...${NC}"
        $DOCKER_CMD --profile postgres up -d postgres
    fi

    if [ "$DB_TYPE" = "mysql" ]; then
        {
            echo "MYSQL_USER=$MY_USER"
            echo "MYSQL_PASSWORD=$MY_PASS"
            echo "MYSQL_DATABASE=$MY_DB"
            echo "MYSQL_ROOT_PASSWORD=${MY_PASS}_root"
            echo "MYSQL_PORT=$MY_PORT"
        } >> .env
        echo -e "${BLUE}Levantando MySQL en Docker...${NC}"
        $DOCKER_CMD --profile mysql up -d mysql
    fi
    echo -e "${CYAN}Esperando a que la base de datos este lista...${NC}"
    sleep 20
fi

echo -e "${BLUE}Inicializando base de datos...${NC}"
cd backend
export APIMAKER_DATABASE_URL="$DB_URL"
./.venv/bin/python app/scripts/seed_admin.py --username "$ADMIN_USER" --password "$ADMIN_PASS"
cd ..

read -r -p "Importar proyecto Pokedex? (y/n) [y]: " IMPORT_DEMO
IMPORT_DEMO="${IMPORT_DEMO:-y}"
if [ "$IMPORT_DEMO" = "y" ]; then
    cd backend
    export APIMAKER_DATABASE_URL="$DB_URL"
    ./.venv/bin/python migrate_json_to_db.py
    ./.venv/bin/python repair_pokedex.py
    cd ..
fi

if [ "$USE_DOCKER" = "y" ]; then
    PROFILES=""
    if [ "$DB_TYPE" = "postgresql" ] && [ "$NEED_DOCKER_DB" = true ]; then PROFILES="--profile postgres"; fi
    if [ "$DB_TYPE" = "mysql" ] && [ "$NEED_DOCKER_DB" = true ]; then PROFILES="--profile mysql"; fi
    export APIMAKER_DATABASE_URL="$DB_URL_DOCKER"
    echo -e "${BLUE}Levantando servicios con Docker...${NC}"
    $DOCKER_CMD $PROFILES up -d --build

    cat << EOF > start.sh
#!/usr/bin/env bash
cd "\$(dirname "\$0")"
echo "Iniciando API Maker con Docker..."
$DOCKER_CMD $PROFILES up -d
EOF
    cat << EOF > start.bat
@echo off
cd /d "%~dp0"
echo Iniciando API Maker con Docker...
$DOCKER_CMD $PROFILES up -d
pause
EOF
else
    cat << 'EOF' > start.sh
#!/usr/bin/env bash
cd "$(dirname "$0")"
echo -e "\033[0;32mIniciando API Maker...\033[0m"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Presiona Ctrl+C para detener ambos."
(cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!
(cd frontend && npm run dev) &
FRONTEND_PID=$!
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
EOF
    cat << 'EOF' > start.bat
@echo off
cd /d "%~dp0"
echo Iniciando API Maker...
start "API Maker Backend" cmd /c "cd backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
start "API Maker Frontend" cmd /c "cd frontend && npm run dev"
echo Servicios iniciados en nuevas ventanas.
EOF
fi
chmod +x start.sh
echo -e "${CYAN}Se han generado 'start.sh' y 'start.bat' para iniciar la aplicacion comodamente.${NC}"

echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}INSTALACION COMPLETADA${NC}"
echo -e "${GREEN}=======================================${NC}"
echo -e "Acceso:       ${BLUE}http://localhost:5173${NC}"
echo -e "Usuario:      ${YELLOW}$ADMIN_USER${NC}"
echo -e "Password:     ${YELLOW}$ADMIN_PASS${NC}"
echo -e "Base Datos:   ${CYAN}$DB_TYPE${NC}"
if [ "$NEED_DOCKER_DB" = true ]; then
    echo -e "${CYAN}BD ejecutandose en Docker.${NC}"
fi

if [ "$USE_DOCKER" != "y" ]; then
    echo ""
    echo -e "${YELLOW}Para arrancar la aplicacion:${NC}"
    echo -e "Opcion 1: Ejecutar el script generado ${BLUE}./start.sh${NC}"
    echo -e "Opcion 2: Arrancar manualmente abriendo dos terminales:"
    echo -e "  Terminal 1 (Backend):  ${CYAN}cd backend && source .venv/bin/activate && uvicorn app.main:app --reload${NC}"
    echo -e "  Terminal 2 (Frontend): ${CYAN}cd frontend && npm run dev${NC}"
fi

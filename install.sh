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
    command -v "$1" >/dev/null 2>&1 || fail "Missing $2 ($1). Install it and re-run this script."
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
echo -e "${BLUE}   DoApi - Setup${NC}"
echo -e "${BLUE}=======================================${NC}"

require_cmd python3 "Python 3.11+"
require_cmd npm "Node.js/npm"

DOCKER_CMD="$(compose_cmd)"

echo -e "${BLUE}Installing dependencies...${NC}"
cd backend
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
elif [ ! -f ".venv/bin/python" ] && [ ! -f ".venv/bin/python3" ]; then
    echo "Virtual environment seems corrupted, recreating..."
    rm -rf .venv
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
echo -e "${YELLOW}ADMIN CONFIGURATION${NC}"
read -r -p "Enter username [admin]: " ADMIN_USER
ADMIN_USER="${ADMIN_USER:-admin}"
read -r -s -p "Enter password for $ADMIN_USER [admin]: " ADMIN_PASS
echo ""
ADMIN_PASS="${ADMIN_PASS:-admin}"

echo ""
echo -e "${YELLOW}DATABASE CONFIGURATION${NC}"
echo "1) SQLite (local, fast)"
echo "2) PostgreSQL"
echo "3) MySQL / MariaDB"
read -r -p "Choose an option [1]: " DB_CHOICE
DB_CHOICE="${DB_CHOICE:-1}"

DB_TYPE="sqlite"
DB_URL="sqlite:///./app/data/doapi.db"
DB_URL_DOCKER="$DB_URL"
NEED_DOCKER_DB=false

case "$DB_CHOICE" in
    1)
        ;;
    2)
        DB_TYPE="postgresql"
        echo ""
        echo "1) Use existing PostgreSQL"
        echo "2) Create new PostgreSQL in Docker"
        read -r -p "Choose an option [2]: " DB_SUB
        DB_SUB="${DB_SUB:-2}"
        if [ "$DB_SUB" = "1" ]; then
            read -r -p "Host [localhost]: " PG_HOST; PG_HOST="${PG_HOST:-localhost}"
            read -r -p "Port [5432]: " PG_PORT; PG_PORT="${PG_PORT:-5432}"
            read -r -p "User [postgres]: " PG_USER; PG_USER="${PG_USER:-postgres}"
            read -r -s -p "Password: " PG_PASS; echo ""
            read -r -p "Database name [doapi]: " PG_DB; PG_DB="${PG_DB:-doapi}"
        else
            NEED_DOCKER_DB=true
            PG_HOST="localhost"; PG_PORT="5432"; PG_USER="doapi"; PG_DB="doapi"
            if (echo > /dev/tcp/localhost/5432) >/dev/null 2>&1; then
                echo -e "${YELLOW}WARNING: Port 5432 is already in use.${NC}"
                echo -e "${YELLOW}To create the new database in Docker we need to use another port.${NC}"
                read -r -p "Enter the port to use [5433]: " ALT_PORT
                ALT_PORT="${ALT_PORT:-5433}"
                if ! [[ "$ALT_PORT" =~ ^[0-9]+$ ]]; then
                    echo "Invalid port. Using 5433 by default."
                    ALT_PORT="5433"
                fi
                PG_PORT="$ALT_PORT"
            fi
            PG_PASS="$(random_hex 12)"
            echo -e "${CYAN}A PostgreSQL container will be created on port $PG_PORT.${NC}"
        fi
        PG_PASS_ENC="$(urlencode "$PG_PASS")"
        DB_URL="postgresql+psycopg2://$PG_USER:$PG_PASS_ENC@$PG_HOST:$PG_PORT/$PG_DB"
        DB_URL_DOCKER="$DB_URL"
        ;;
    3)
        DB_TYPE="mysql"
        echo ""
        echo "1) Use existing MySQL/MariaDB"
        echo "2) Create new MySQL in Docker"
        read -r -p "Choose an option [2]: " DB_SUB
        DB_SUB="${DB_SUB:-2}"
        if [ "$DB_SUB" = "1" ]; then
            read -r -p "Host [localhost]: " MY_HOST; MY_HOST="${MY_HOST:-localhost}"
            read -r -p "Port [3306]: " MY_PORT; MY_PORT="${MY_PORT:-3306}"
            read -r -p "User [root]: " MY_USER; MY_USER="${MY_USER:-root}"
            read -r -s -p "Password: " MY_PASS; echo ""
            read -r -p "Database name [doapi]: " MY_DB; MY_DB="${MY_DB:-doapi}"
        else
            NEED_DOCKER_DB=true
            MY_HOST="localhost"; MY_PORT="3306"; MY_USER="doapi"; MY_DB="doapi"
            if (echo > /dev/tcp/localhost/3306) >/dev/null 2>&1; then
                echo -e "${YELLOW}WARNING: Port 3306 is already in use.${NC}"
                echo -e "${YELLOW}To create the new database in Docker we need to use another port.${NC}"
                read -r -p "Enter the port to use [3307]: " ALT_PORT
                ALT_PORT="${ALT_PORT:-3307}"
                if ! [[ "$ALT_PORT" =~ ^[0-9]+$ ]]; then
                    echo "Invalid port. Using 3307 by default."
                    ALT_PORT="3307"
                fi
                MY_PORT="$ALT_PORT"
            fi
            MY_PASS="$(random_hex 12)"
            echo -e "${CYAN}A MySQL container will be created on port $MY_PORT.${NC}"
        fi
        MY_PASS_ENC="$(urlencode "$MY_PASS")"
        DB_URL="mysql+pymysql://$MY_USER:$MY_PASS_ENC@$MY_HOST:$MY_PORT/$MY_DB"
        DB_URL_DOCKER="$DB_URL"
        ;;
    *)
        fail "Invalid database option."
        ;;
esac

echo ""
echo -e "${YELLOW}DEPLOYMENT${NC}"
read -r -p "Do you want to run the app with Docker? (y/n) [n]: " USE_DOCKER
USE_DOCKER="${USE_DOCKER:-n}"

if [ "$USE_DOCKER" = "y" ]; then
    [ -n "$DOCKER_CMD" ] || fail "Docker Compose is not available."
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
    echo "APIMAKER_ENCRYPTION_KEY=$(random_hex 32)"
} > .env

if [ "$NEED_DOCKER_DB" = true ]; then
    [ -n "$DOCKER_CMD" ] || fail "Docker Compose is not available to create the database."
    echo -e "${BLUE}Cleaning up previous Docker databases of this project...${NC}"
    $DOCKER_CMD --profile postgres --profile mysql down -v >/dev/null 2>&1 || true

    if [ "$DB_TYPE" = "postgresql" ]; then
        {
            echo "POSTGRES_USER=$PG_USER"
            echo "POSTGRES_PASSWORD=$PG_PASS"
            echo "POSTGRES_DB=$PG_DB"
            echo "POSTGRES_PORT=$PG_PORT"
        } >> .env
        echo -e "${BLUE}Starting PostgreSQL in Docker...${NC}"
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
        echo -e "${BLUE}Starting MySQL in Docker...${NC}"
        $DOCKER_CMD --profile mysql up -d mysql
    fi
    echo -e "${CYAN}Waiting for the database to be ready...${NC}"
    sleep 20
fi

echo -e "${BLUE}Initializing database...${NC}"
cd backend
export APIMAKER_DATABASE_URL="$DB_URL"
./.venv/bin/python app/scripts/seed_admin.py --username "$ADMIN_USER" --password "$ADMIN_PASS"
cd ..

read -r -p "Import Pokedex project? (y/n) [y]: " IMPORT_DEMO
IMPORT_DEMO="${IMPORT_DEMO:-y}"
if [ "$IMPORT_DEMO" = "y" ]; then
    cd backend
    export APIMAKER_DATABASE_URL="$DB_URL"
    ./.venv/bin/python -m app.cli seed-demo --force
    cd ..
fi

if [ "$USE_DOCKER" = "y" ]; then
    PROFILES=""
    if [ "$DB_TYPE" = "postgresql" ] && [ "$NEED_DOCKER_DB" = true ]; then PROFILES="--profile postgres"; fi
    if [ "$DB_TYPE" = "mysql" ] && [ "$NEED_DOCKER_DB" = true ]; then PROFILES="--profile mysql"; fi
    export APIMAKER_DATABASE_URL="$DB_URL_DOCKER"
    echo -e "${BLUE}Starting services with Docker...${NC}"
    $DOCKER_CMD $PROFILES up -d --build

    {
        echo '@echo off'
        echo 'cd /d "%~dp0"'
        echo 'echo Starting DoApi with Docker...'
        echo "$DOCKER_CMD $PROFILES up -d"
        echo 'pause'
    } > start.bat

    {
        echo '#!/usr/bin/env bash'
        echo 'cd "$(dirname "$0")"'
        echo 'echo "Starting DoApi with Docker..."'
        echo "$DOCKER_CMD $PROFILES up -d"
    } > start.sh
else
    {
        echo '@echo off'
        echo 'cd /d "%~dp0"'
        echo 'echo Starting DoApi...'
        echo 'start "Backend" /D "%~dp0backend" cmd /c ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"'
        echo 'start "Frontend" /D "%~dp0frontend" cmd /c "npm run dev"'
        echo 'echo.'
        echo 'echo Both servers started in separate windows.'
        echo 'echo Backend: http://localhost:8000'
        echo 'echo Frontend: http://localhost:5173'
    } > start.bat

    {
        echo '#!/usr/bin/env bash'
        echo 'cd "$(dirname "$0")"'
        echo 'echo "Starting DoApi..."'
        echo ''
        echo '(cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &'
        echo 'BACKEND_PID=$!'
        echo ''
        echo '(cd frontend && npm run dev) &'
        echo 'FRONTEND_PID=$!'
        echo ''
        echo 'echo "Backend: http://localhost:8000"'
        echo 'echo "Frontend: http://localhost:5173"'
        echo 'echo "Press Ctrl+C to stop both servers."'
        echo ''
        echo 'trap "kill \$BACKEND_PID \$FRONTEND_PID 2>/dev/null; exit" INT TERM'
        echo 'wait'
    } > start.sh
fi

echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}INSTALLATION COMPLETE${NC}"
echo -e "${GREEN}=======================================${NC}"
echo -e "URL:          ${BLUE}http://localhost:5173${NC}"
echo -e "User:         ${YELLOW}$ADMIN_USER${NC}"
echo -e "Password:     ${YELLOW}$ADMIN_PASS${NC}"
echo -e "Database:     ${CYAN}$DB_TYPE${NC}"
if [ "$NEED_DOCKER_DB" = true ]; then
    echo -e "${CYAN}DB running in Docker.${NC}"
fi

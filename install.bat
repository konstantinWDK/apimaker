@echo off
setlocal enabledelayedexpansion

echo =======================================
echo    🚀 API Maker - Configuracion
echo =======================================

:: 1. Dependencias
echo [1/5] Instalando dependencias...
cd backend
if not exist .venv (
    python -m venv .venv
)
call .venv\Scripts\activate
pip install -e ".[dev]"
cd ..

cd frontend
call npm install
cd ..

:: 2. Configuracion de Administrador
echo.
echo 👤 CONFIGURACION DEL ADMINISTRADOR
set /p ADMIN_USER="Introduce el nombre de usuario [admin]: "
if "!ADMIN_USER!"=="" set ADMIN_USER=admin

:: En Windows Batch es mas dificil ocultar la contraseña, usaremos una entrada normal o PowerShell
set /p ADMIN_PASS="Introduce la contraseña [admin]: "
if "!ADMIN_PASS!"=="" set ADMIN_PASS=admin

:: 3. Configuracion de Base de Datos
echo.
echo 🗄️ CONFIGURACION DE BASE DE DATOS
echo 1) SQLite (Local)
echo 2) PostgreSQL (Remota)
set /p DB_OPTION="Elige una opcion [1]: "
if "!DB_OPTION!"=="" set DB_OPTION=1

if "!DB_OPTION!"=="2" (
    set /p PG_HOST="Host [localhost]: "
    if "!PG_HOST!"=="" set PG_HOST=localhost
    set /p PG_PORT="Puerto [5432]: "
    if "!PG_PORT!"=="" set PG_PORT=5432
    set /p PG_USER="Usuario [postgres]: "
    if "!PG_USER!"=="" set PG_USER=postgres
    set /p PG_PASS="Contraseña: "
    set /p PG_DB="Nombre BD [apimaker]: "
    if "!PG_DB!"=="" set PG_DB=apimaker
    
    set DB_URL=postgresql+psycopg2://!PG_USER!:!PG_PASS!@!PG_HOST!:!PG_PORT!/!PG_DB!
    
    mkdir backend\app\data 2>nul
    (
      echo {
      echo   "dev": {
      echo     "database_type": "postgresql",
      echo     "postgres_url": "!DB_URL!",
      echo     "host": "!PG_HOST!",
      echo     "port": !PG_PORT!,
      echo     "username": "!PG_USER!",
      echo     "password": "!PG_PASS!",
      echo     "database": "!PG_DB!"
      echo   }
      echo }
    ) > backend\app\data\admin_config.json
)

:: 4. Seeding
echo 🌱 Inicializando base de datos...
cd backend
.venv\Scripts\python.exe app\scripts\seed_admin.py --username !ADMIN_USER! --password !ADMIN_PASS!
cd ..

:: 5. Datos de prueba
set /p IMPORT_POKEDEX="¿Importar proyecto Pokedex? (y/n) [y]: "
if "!IMPORT_POKEDEX!"=="" set IMPORT_POKEDEX=y

if "!IMPORT_POKEDEX!"=="y" (
    echo 🦖 Importando Pokedex...
    cd backend
    .venv\Scripts\python.exe migrate_json_to_db.py
    .venv\Scripts\python.exe repair_pokedex.py
    cd ..
)

echo.
echo ✅ INSTALACION COMPLETADA
echo.
echo Acceso: !ADMIN_USER! / !ADMIN_PASS!
pause

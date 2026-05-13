@echo off
setlocal enabledelayedexpansion

echo =======================================
echo    API Maker - Configuracion
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

:: 2. Admin
echo.
echo ^<^<^< CONFIGURACION DEL ADMINISTRADOR ^>^>^>
set /p ADMIN_USER="Introduce el nombre de usuario [admin]: "
if "!ADMIN_USER!"=="" set ADMIN_USER=admin
set /p ADMIN_PASS="Introduce la contrasena [admin]: "
if "!ADMIN_PASS!"=="" set ADMIN_PASS=admin

:: 3. Base de Datos
echo.
echo ^<^<^< CONFIGURACION DE BASE DE DATOS ^>^>^>
echo 1) SQLite (local, rapida)
echo 2) PostgreSQL existente (conectarse a uno que ya tengas)
echo 3) PostgreSQL nuevo en Docker (crear contenedor automaticamente)
set /p DB_OPTION="Elige una opcion [1]: "
if "!DB_OPTION!"=="" set DB_OPTION=1

set DB_TYPE=sqlite
set NEED_DOCKER_DB=false

if "!DB_OPTION!"=="2" set NEED_DOCKER_DB=false
if "!DB_OPTION!"=="3" set NEED_DOCKER_DB=true

if "!DB_OPTION!"=="2" (
    set /p PG_HOST="Host de Postgres [localhost]: "
    if "!PG_HOST!"=="" set PG_HOST=localhost
    set /p PG_PORT="Puerto [5432]: "
    if "!PG_PORT!"=="" set PG_PORT=5432
    set /p PG_USER="Usuario [postgres]: "
    if "!PG_USER!"=="" set PG_USER=postgres
    set /p PG_PASS="Contrasena: "
    set /p PG_DB="Nombre BD [apimaker]: "
    if "!PG_DB!"=="" set PG_DB=apimaker
)

if "!DB_OPTION!"=="3" (
    set PG_HOST=localhost
    set PG_PORT=5432
    set PG_USER=apimaker
    set PG_PASS=apimaker_secret_%RANDOM%
    set PG_DB=apimaker
    echo Se generara un contenedor PostgreSQL con credenciales seguras.
)

if "!DB_OPTION!"=="2" (
    set DB_TYPE=postgresql
    set DB_URL=postgresql+psycopg2://!PG_USER!:!PG_PASS!@!PG_HOST!:!PG_PORT!/!PG_DB!
    set APIMAKER_DATABASE_URL=!DB_URL!

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
    echo Configuracion de PostgreSQL guardada.
)

if "!DB_OPTION!"=="3" (
    set DB_TYPE=postgresql
    set DB_URL=postgresql+psycopg2://!PG_USER!:!PG_PASS!@!PG_HOST!:!PG_PORT!/!PG_DB!
    set APIMAKER_DATABASE_URL=!DB_URL!

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

    :: Guardar .env
    (
      echo APIMAKER_ENVIRONMENT=development
      echo APIMAKER_DATABASE_URL=!DB_URL!
      echo POSTGRES_USER=!PG_USER!
      echo POSTGRES_PASSWORD=!PG_PASS!
      echo POSTGRES_DB=!PG_DB!
    ) > .env
    echo Archivo .env generado con credenciales de PostgreSQL.
    echo.
    echo ^>^>^> PostgreSQL en contenedor configurado.
    echo     Usuario: !PG_USER!
    echo     Contrasena: !PG_PASS!
    echo     Base de datos: !PG_DB!
)

:: 4. Seed
echo.
echo Inicializando base de datos y usuario...
cd backend
.venv\Scripts\python.exe app\scripts\seed_admin.py --username !ADMIN_USER! --password !ADMIN_PASS!
cd ..

:: 5. Demo
echo.
set /p IMPORT_POKEDEX="Importar proyecto Pokedex? (y/n) [y]: "
if "!IMPORT_POKEDEX!"=="" set IMPORT_POKEDEX=y
if "!IMPORT_POKEDEX!"=="y" (
    echo Importando Pokedex...
    cd backend
    .venv\Scripts\python.exe migrate_json_to_db.py
    .venv\Scripts\python.exe repair_pokedex.py
    cd ..
)

:: 6. Docker
echo.
echo ^<^<^< DESPLIEGUE CON DOCKER ^>^>^>
set /p USE_DOCKER="Levantar la app ahora con Docker? (y/n) [n]: "
if "!USE_DOCKER!"=="" set USE_DOCKER=n

if "!USE_DOCKER!"=="y" (
    set COMPOSE_FILES=-f docker-compose.yml

    if "!NEED_DOCKER_DB!"=="true" (
        set COMPOSE_FILES=!COMPOSE_FILES! -f docker-compose.prod.yml
        echo Usando PostgreSQL en contenedor.
    ) else if "!DB_TYPE!"=="postgresql" (
        set APIMAKER_DATABASE_URL=!DB_URL!
        echo Usando PostgreSQL existente: !PG_HOST!:!PG_PORT!/!PG_DB!
    ) else (
        echo Usando SQLite.
    )

    echo.
    echo Construyendo y levantando contenedores...
    docker compose %COMPOSE_FILES% up -d --build || docker-compose %COMPOSE_FILES% up -d --build

    echo.
    echo =======================================
    echo    INSTALACION COMPLETADA CON EXITO
    echo =======================================
    echo.
    echo Frontend: http://localhost:5173
    echo Backend:  http://localhost:8000
    echo Usuario:  !ADMIN_USER!
    if "!NEED_DOCKER_DB!"=="true" (
        echo.
        echo Credenciales PostgreSQL (contenedor):
        echo   Host:      localhost
        echo   Puerto:    5432
        echo   Usuario:   !PG_USER!
        echo   Password:  !PG_PASS!
        echo   Base:      !PG_DB!
    )
    goto :end
)

echo.
echo =======================================
echo    INSTALACION COMPLETADA CON EXITO
echo =======================================
echo.
echo Para arrancar manualmente:
echo   1. cd backend ^&^& .venv\Scripts\activate ^&^& uvicorn app.main:app --reload
echo   2. cd frontend ^&^& npm run dev
echo.
echo Usuario: !ADMIN_USER!
echo URL: http://localhost:5173

:end
pause

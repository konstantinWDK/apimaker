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
if not exist app\data mkdir app\data
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

:: 3. Base de Datos (AHORA PRIMERO)
echo.
echo ^<^<^< CONFIGURACION DE BASE DE DATOS ^>^>^>
echo 1) SQLite (local, rapida)
echo 2) PostgreSQL
echo 3) MySQL / MariaDB
set /p DB_CHOICE="Elige una opcion [1]: "
if "!DB_CHOICE!"=="" set DB_CHOICE=1

set DB_TYPE=sqlite
set NEED_DOCKER_DB=false
set DB_URL=

if "!DB_CHOICE!"=="1" (
    set DB_TYPE=sqlite
    set DB_URL=sqlite:///./app/data/apimaker.db
)

if "!DB_CHOICE!"=="2" (
    set DB_TYPE=postgresql
    echo.
    echo 1^) Usar PostgreSQL existente
    echo 2^) Crear nuevo PostgreSQL en Docker
    set /p DB_SUB="Elige una opcion [2]: "
    if "!DB_SUB!"=="" set DB_SUB=2
    
    if "!DB_SUB!"=="1" (
        set /p PG_HOST="Host [localhost]: "
        if "!PG_HOST!"=="" set PG_HOST=localhost
        set /p PG_PORT="Puerto [5432]: "
        if "!PG_PORT!"=="" set PG_PORT=5432
        set /p PG_USER="Usuario [postgres]: "
        if "!PG_USER!"=="" set PG_USER=postgres
        set /p PG_PASS="Contrasena: "
        set /p PG_DB="Nombre BD [apimaker]: "
        if "!PG_DB!"=="" set PG_DB=apimaker
    ) else (
        set NEED_DOCKER_DB=true
        set PG_HOST=localhost
        set PG_PORT=5432
        set PG_USER=apimaker
        set PG_PASS=apimaker_secret_%RANDOM%
        set PG_DB=apimaker
        echo Se generara un contenedor PostgreSQL automaticamente.
    )
    set DB_URL=postgresql+psycopg2://!PG_USER!:!PG_PASS!@!PG_HOST!:!PG_PORT!/!PG_DB!
)

if "!DB_CHOICE!"=="3" (
    set DB_TYPE=mysql
    echo.
    echo 1^) Usar MySQL/MariaDB existente
    echo 2^) Crear nuevo MySQL en Docker
    set /p DB_SUB="Elige una opcion [2]: "
    if "!DB_SUB!"=="" set DB_SUB=2
    
    if "!DB_SUB!"=="1" (
        set /p MY_HOST="Host [localhost]: "
        if "!MY_HOST!"=="" set MY_HOST=localhost
        set /p MY_PORT="Puerto [3306]: "
        if "!MY_PORT!"=="" set MY_PORT=3306
        set /p MY_USER="Usuario [root]: "
        if "!MY_USER!"=="" set MY_USER=root
        set /p MY_PASS="Contrasena: "
        set /p MY_DB="Nombre BD [apimaker]: "
        if "!MY_DB!"=="" set MY_DB=apimaker
    ) else (
        set NEED_DOCKER_DB=true
        set MY_HOST=localhost
        set MY_PORT=3306
        set MY_USER=apimaker
        set MY_PASS=apimaker_secret_%RANDOM%
        set MY_DB=apimaker
        echo Se generara un contenedor MySQL automaticamente.
    )
    set DB_URL=mysql+pymysql://!MY_USER!:!MY_PASS!@!MY_HOST!:!MY_PORT!/!MY_DB!
)

:: 4. Docker Deployment
echo.
echo ^<^<^< DESPLIEGUE ^>^>^>
set /p USE_DOCKER="Levantar la aplicacion con Docker? (y/n) [n]: "
if "!USE_DOCKER!"=="" set USE_DOCKER=n

:: 5. Generar configuracion y .env
set DB_URL_DOCKER=!DB_URL!
if "!USE_DOCKER!"=="y" (
    if "!DB_TYPE!"=="postgresql" if "!NEED_DOCKER_DB!"=="true" set DB_URL_DOCKER=postgresql+psycopg2://!PG_USER!:!PG_PASS!@postgres:5432/!PG_DB!
    if "!DB_TYPE!"=="mysql" if "!NEED_DOCKER_DB!"=="true" set DB_URL_DOCKER=mysql+pymysql://!MY_USER!:!MY_PASS!@mysql:3306/!MY_DB!
)

echo APIMAKER_ENVIRONMENT=development > .env
echo APIMAKER_DATABASE_URL=!DB_URL_DOCKER! >> .env
echo APIMAKER_JWT_SECRET_KEY=secret_%RANDOM% >> .env

if "!NEED_DOCKER_DB!"=="true" (
    echo Limpiando instalaciones previas de base de datos...
    docker compose --profile postgres --profile mysql down -v > nul 2>&1
    
    if "!DB_TYPE!"=="postgresql" (
        echo POSTGRES_USER=!PG_USER! >> .env
        echo POSTGRES_PASSWORD=!PG_PASS! >> .env
        echo POSTGRES_DB=!PG_DB! >> .env
        
        echo Levantando base de datos PostgreSQL en Docker...
        docker compose --profile postgres up -d postgres
    )
    if "!DB_TYPE!"=="mysql" (
        echo MYSQL_USER=!MY_USER! >> .env
        echo MYSQL_PASSWORD=!MY_PASS! >> .env
        echo MYSQL_DATABASE=!MY_DB! >> .env
        echo MYSQL_ROOT_PASSWORD=!MY_PASS!_root >> .env
        
        echo Levantando base de datos MySQL en Docker...
        docker compose --profile mysql up -d mysql
    )
    echo Esperando a que el motor de base de datos este totalmente listo ^(puede tardar unos segundos^)...
    timeout /t 20 /nobreak > nul
)

:: 6. Seed y Demo
echo.
echo Inicializando base de datos...
cd backend
:: Usamos la URL local para el seed desde Windows
set APIMAKER_DATABASE_URL=!DB_URL!
.venv\Scripts\python.exe app\scripts\seed_admin.py --username !ADMIN_USER! --password !ADMIN_PASS!
cd ..

set /p IMPORT_DEMO="Importar proyecto Pokedex? (y/n) [y]: "
if "!IMPORT_DEMO!"=="" set IMPORT_DEMO=y
if "!IMPORT_DEMO!"=="y" (
    cd backend
    set APIMAKER_DATABASE_URL=!DB_URL!
    .venv\Scripts\python.exe migrate_json_to_db.py
    .venv\Scripts\python.exe repair_pokedex.py
    cd ..
)

:: 7. Docker Final
if "!USE_DOCKER!"=="y" (
    echo Levantando servicios de la aplicacion...
    set PROFILES=
    if "!DB_TYPE!"=="postgresql" if "!NEED_DOCKER_DB!"=="true" set PROFILES=--profile postgres
    if "!DB_TYPE!"=="mysql" if "!NEED_DOCKER_DB!"=="true" set PROFILES=--profile mysql
    
    :: Forzamos la variable al valor de Docker para que no herede el localhost de la sesion actual
    set APIMAKER_DATABASE_URL=!DB_URL_DOCKER!
    
    docker compose !PROFILES! up -d --build
)

echo.
echo =======================================
echo    INSTALACION COMPLETADA
echo =======================================
echo.
echo URL Acceso: http://localhost:5173
echo Usuario Admin: !ADMIN_USER!
echo Password Admin: !ADMIN_PASS!
echo.
echo --- DETALLES DE BASE DE DATOS ---
echo Tipo: !DB_TYPE!
if "!DB_TYPE!"=="postgresql" (
    echo Host: !PG_HOST!
    echo Usuario: !PG_USER!
    echo Password: !PG_PASS!
    echo Database: !PG_DB!
)
if "!DB_TYPE!"=="mysql" (
    echo Host: !MY_HOST!
    echo Usuario: !MY_USER!
    echo Password: !MY_PASS!
    echo Database: !MY_DB!
)
if "!DB_TYPE!"=="sqlite" (
    echo Archivo: backend\app\data\apimaker.db
)
if "!NEED_DOCKER_DB!"=="true" (
    echo [!] Estado: Contenedor Docker creado y corriendo.
)
echo.

:end
pause




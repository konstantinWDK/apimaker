@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo =======================================
echo    API Maker - Configuracion
echo =======================================
echo.

call :resolve_python || goto fail
call :require_cmd npm "Node.js/npm" || goto fail

set "DOCKER_CMD="
docker compose version >nul 2>&1
if not errorlevel 1 set "DOCKER_CMD=docker compose"
if not defined DOCKER_CMD (
    docker-compose version >nul 2>&1
    if not errorlevel 1 set "DOCKER_CMD=docker-compose"
)

echo [1/5] Instalando dependencias...
pushd backend || goto fail
if not exist ".venv" (
    "%PYTHON_CMD%" -m venv .venv || goto fail
)
set "VENV_PY=.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
    echo No se encontro el Python del entorno virtual: backend\%VENV_PY%
    goto fail
)
"%VENV_PY%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo Reparando pip dentro del entorno virtual...
    "%VENV_PY%" -m ensurepip --upgrade || goto fail
)
"%VENV_PY%" -m pip install --disable-pip-version-check wheel || goto fail
"%VENV_PY%" -m pip install --disable-pip-version-check --no-build-isolation -e ".[dev]" || goto fail
if not exist "app\data" mkdir "app\data" || goto fail
popd

pushd frontend || goto fail
call npm install || goto fail
popd

echo.
echo CONFIGURACION DEL ADMINISTRADOR
set /p "ADMIN_USER=Introduce el nombre de usuario [admin]: "
if "%ADMIN_USER%"=="" set "ADMIN_USER=admin"
set /p "ADMIN_PASS=Introduce la contrasena [admin]: "
if "%ADMIN_PASS%"=="" set "ADMIN_PASS=admin"

echo.
echo CONFIGURACION DE BASE DE DATOS
echo 1) SQLite (local, rapida)
echo 2) PostgreSQL
echo 3) MySQL / MariaDB
set /p "DB_CHOICE=Elige una opcion [1]: "
if "%DB_CHOICE%"=="" set "DB_CHOICE=1"

set "DB_TYPE=sqlite"
set "NEED_DOCKER_DB=false"
set "DB_URL=sqlite:///./app/data/apimaker.db"
set "DB_URL_DOCKER=%DB_URL%"

if "%DB_CHOICE%"=="2" (
    set "DB_TYPE=postgresql"
    echo.
    echo 1^) Usar PostgreSQL existente
    echo 2^) Crear nuevo PostgreSQL en Docker
    set /p "DB_SUB=Elige una opcion [2]: "
    if "!DB_SUB!"=="" set "DB_SUB=2"
    call :configure_postgres
)

if "%DB_CHOICE%"=="3" (
    set "DB_TYPE=mysql"
    echo.
    echo 1^) Usar MySQL/MariaDB existente
    echo 2^) Crear nuevo MySQL en Docker
    set /p "DB_SUB=Elige una opcion [2]: "
    if "!DB_SUB!"=="" set "DB_SUB=2"
    call :configure_mysql
)

if not "%DB_CHOICE%"=="1" if not "%DB_CHOICE%"=="2" if not "%DB_CHOICE%"=="3" (
    echo Opcion de base de datos no valida.
    goto fail
)

echo.
echo DESPLIEGUE
set /p "USE_DOCKER=Levantar la aplicacion con Docker? (y/n) [n]: "
if "%USE_DOCKER%"=="" set "USE_DOCKER=n"

if /i "%USE_DOCKER%"=="y" (
    if not defined DOCKER_CMD (
        echo Docker Compose no esta disponible. Instala Docker Desktop o elige despliegue manual.
        goto fail
    )
    if "%DB_TYPE%"=="postgresql" if "%NEED_DOCKER_DB%"=="true" set "DB_URL_DOCKER=postgresql+psycopg2://%PG_USER%:%PG_PASS_ENC%@postgres:5432/%PG_DB%"
    if "%DB_TYPE%"=="mysql" if "%NEED_DOCKER_DB%"=="true" set "DB_URL_DOCKER=mysql+pymysql://%MY_USER%:%MY_PASS_ENC%@mysql:3306/%MY_DB%"
)

call :random_hex JWT_SECRET 64
(
    echo APIMAKER_ENVIRONMENT=development
    echo APIMAKER_DATABASE_URL=%DB_URL_DOCKER%
    echo APIMAKER_JWT_SECRET_KEY=%JWT_SECRET%
) > ".env"

if "%NEED_DOCKER_DB%"=="true" (
    if not defined DOCKER_CMD (
        echo Docker Compose no esta disponible para crear la base de datos.
        goto fail
    )
    echo Limpiando bases de datos Docker previas de este proyecto...
    %DOCKER_CMD% --profile postgres --profile mysql down -v >nul 2>&1

    if "%DB_TYPE%"=="postgresql" (
        (
            echo POSTGRES_USER=%PG_USER%
            echo POSTGRES_PASSWORD=%PG_PASS%
            echo POSTGRES_DB=%PG_DB%
        ) >> ".env"
        echo Levantando PostgreSQL en Docker...
        %DOCKER_CMD% --profile postgres up -d postgres || goto fail
    )

    if "%DB_TYPE%"=="mysql" (
        (
            echo MYSQL_USER=%MY_USER%
            echo MYSQL_PASSWORD=%MY_PASS%
            echo MYSQL_DATABASE=%MY_DB%
            echo MYSQL_ROOT_PASSWORD=%MY_PASS%_root
        ) >> ".env"
        echo Levantando MySQL en Docker...
        %DOCKER_CMD% --profile mysql up -d mysql || goto fail
    )
    echo Esperando a que la base de datos este lista...
    timeout /t 20 /nobreak >nul
)

echo.
echo Inicializando base de datos...
pushd backend || goto fail
set "APIMAKER_DATABASE_URL=%DB_URL%"
".venv\Scripts\python.exe" app\scripts\seed_admin.py --username "%ADMIN_USER%" --password "%ADMIN_PASS%" || goto fail
popd

set /p "IMPORT_DEMO=Importar proyecto Pokedex? (y/n) [y]: "
if "%IMPORT_DEMO%"=="" set "IMPORT_DEMO=y"
if /i "%IMPORT_DEMO%"=="y" (
    pushd backend || goto fail
    set "APIMAKER_DATABASE_URL=%DB_URL%"
    ".venv\Scripts\python.exe" migrate_json_to_db.py || goto fail
    ".venv\Scripts\python.exe" repair_pokedex.py || goto fail
    popd
)

if /i "%USE_DOCKER%"=="y" (
    echo Levantando servicios de la aplicacion...
    set "PROFILES="
    if "%DB_TYPE%"=="postgresql" if "%NEED_DOCKER_DB%"=="true" set "PROFILES=--profile postgres"
    if "%DB_TYPE%"=="mysql" if "%NEED_DOCKER_DB%"=="true" set "PROFILES=--profile mysql"
    set "APIMAKER_DATABASE_URL=%DB_URL_DOCKER%"
    %DOCKER_CMD% %PROFILES% up -d --build || goto fail
)

echo.
echo =======================================
echo    INSTALACION COMPLETADA
echo =======================================
echo URL Acceso: http://localhost:5173
echo Usuario Admin: %ADMIN_USER%
echo Password Admin: %ADMIN_PASS%
echo.
echo Base de datos: %DB_TYPE%
if "%DB_TYPE%"=="sqlite" echo Archivo: backend\app\data\apimaker.db
if "%DB_TYPE%"=="postgresql" echo Host: %PG_HOST%  Usuario: %PG_USER%  Database: %PG_DB%
if "%DB_TYPE%"=="mysql" echo Host: %MY_HOST%  Usuario: %MY_USER%  Database: %MY_DB%
if "%NEED_DOCKER_DB%"=="true" echo Estado DB: contenedor Docker creado y corriendo.
echo.
pause
exit /b 0

:configure_postgres
if "!DB_SUB!"=="1" (
    set /p "PG_HOST=Host [localhost]: "
    if "!PG_HOST!"=="" set "PG_HOST=localhost"
    set /p "PG_PORT=Puerto [5432]: "
    if "!PG_PORT!"=="" set "PG_PORT=5432"
    set /p "PG_USER=Usuario [postgres]: "
    if "!PG_USER!"=="" set "PG_USER=postgres"
    set /p "PG_PASS=Contrasena: "
    set /p "PG_DB=Nombre BD [apimaker]: "
    if "!PG_DB!"=="" set "PG_DB=apimaker"
) else (
    set "NEED_DOCKER_DB=true"
    set "PG_HOST=localhost"
    set "PG_PORT=5432"
    set "PG_USER=apimaker"
    call :random_hex PG_PASS 24
    set "PG_DB=apimaker"
    echo Se generara un contenedor PostgreSQL automaticamente.
)
call :urlencode "!PG_PASS!" PG_PASS_ENC
set "DB_URL=postgresql+psycopg2://!PG_USER!:!PG_PASS_ENC!@!PG_HOST!:!PG_PORT!/!PG_DB!"
set "DB_URL_DOCKER=!DB_URL!"
exit /b 0

:configure_mysql
if "!DB_SUB!"=="1" (
    set /p "MY_HOST=Host [localhost]: "
    if "!MY_HOST!"=="" set "MY_HOST=localhost"
    set /p "MY_PORT=Puerto [3306]: "
    if "!MY_PORT!"=="" set "MY_PORT=3306"
    set /p "MY_USER=Usuario [root]: "
    if "!MY_USER!"=="" set "MY_USER=root"
    set /p "MY_PASS=Contrasena: "
    set /p "MY_DB=Nombre BD [apimaker]: "
    if "!MY_DB!"=="" set "MY_DB=apimaker"
) else (
    set "NEED_DOCKER_DB=true"
    set "MY_HOST=localhost"
    set "MY_PORT=3306"
    set "MY_USER=apimaker"
    call :random_hex MY_PASS 24
    set "MY_DB=apimaker"
    echo Se generara un contenedor MySQL automaticamente.
)
call :urlencode "!MY_PASS!" MY_PASS_ENC
set "DB_URL=mysql+pymysql://!MY_USER!:!MY_PASS_ENC!@!MY_HOST!:!MY_PORT!/!MY_DB!"
set "DB_URL_DOCKER=!DB_URL!"
exit /b 0

:urlencode
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "[uri]::EscapeDataString('%~1')"`) do set "%~2=%%A"
exit /b 0

:random_hex
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')).Substring(0,%~2)"`) do set "%~1=%%A"
exit /b 0

:require_cmd
where %~1 >nul 2>&1
if errorlevel 1 (
    echo Falta %~2 ^(%~1^). Instalalo y vuelve a ejecutar este script.
    exit /b 1
)
exit /b 0

:resolve_python
set "PYTHON_CMD="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "$cmd = Get-Command python -ErrorAction SilentlyContinue; if ($cmd) { $cmd.Source }"`) do set "PYTHON_CMD=%%A"
if not defined PYTHON_CMD (
    for /f "usebackq delims=" %%A in (`where python 2^>nul`) do (
        if not defined PYTHON_CMD set "PYTHON_CMD=%%A"
    )
)
if not defined PYTHON_CMD (
    echo Falta Python 3.11+. Instalalo y vuelve a ejecutar este script.
    exit /b 1
)
"%PYTHON_CMD%" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if errorlevel 1 (
    echo Se encontro Python, pero se requiere Python 3.11 o superior.
    echo Ruta detectada: %PYTHON_CMD%
    exit /b 1
)
exit /b 0

:fail
echo.
echo ERROR: la instalacion no se completo.
pause
exit /b 1

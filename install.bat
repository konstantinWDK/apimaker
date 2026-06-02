@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo =======================================
echo    DoApi - Setup
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

echo [1/5] Installing dependencies...
pushd backend || goto fail
if not exist ".venv" (
    "%PYTHON_CMD%" -m venv .venv || goto fail
) else if not exist ".venv\Scripts\python.exe" (
    echo Virtual environment seems corrupted, recreating...
    rmdir /s /q ".venv"
    "%PYTHON_CMD%" -m venv .venv || goto fail
)
set "VENV_PY=.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
    echo Python not found in virtual environment: backend\%VENV_PY%
    goto fail
)
"%VENV_PY%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo Repairing pip inside the virtual environment...
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
echo ADMIN CONFIGURATION
set /p "ADMIN_USER=Enter username [admin]: "
if "%ADMIN_USER%"=="" set "ADMIN_USER=admin"
set /p "ADMIN_PASS=Enter password [admin]: "
if "%ADMIN_PASS%"=="" set "ADMIN_PASS=admin"

echo.
echo DATABASE CONFIGURATION
echo 1) SQLite (local, fast)
echo 2) PostgreSQL
echo 3) MySQL / MariaDB
set /p "DB_CHOICE=Choose an option [1]: "
if "%DB_CHOICE%"=="" set "DB_CHOICE=1"

set "DB_TYPE=sqlite"
set "NEED_DOCKER_DB=false"
set "DB_URL=sqlite:///./app/data/doapi.db"
set "DB_URL_DOCKER=%DB_URL%"

if "%DB_CHOICE%"=="2" (
    set "DB_TYPE=postgresql"
    echo.
    echo 1^) Use existing PostgreSQL
    echo 2^) Create new PostgreSQL in Docker
    set /p "DB_SUB=Choose an option [2]: "
    if "!DB_SUB!"=="" set "DB_SUB=2"
    call :configure_postgres
)

if "%DB_CHOICE%"=="3" (
    set "DB_TYPE=mysql"
    echo.
    echo 1^) Use existing MySQL/MariaDB
    echo 2^) Create new MySQL in Docker
    set /p "DB_SUB=Choose an option [2]: "
    if "!DB_SUB!"=="" set "DB_SUB=2"
    call :configure_mysql
)

if not "%DB_CHOICE%"=="1" if not "%DB_CHOICE%"=="2" if not "%DB_CHOICE%"=="3" (
    echo Invalid database option.
    goto fail
)

echo.
echo DEPLOYMENT
set /p "USE_DOCKER=Run the application with Docker? (y/n) [n]: "
if "%USE_DOCKER%"=="" set "USE_DOCKER=n"

if /i "%USE_DOCKER%"=="y" (
    if not defined DOCKER_CMD (
        echo Docker Compose is not available. Install Docker Desktop or choose manual deployment.
        goto fail
    )
    if "%DB_TYPE%"=="postgresql" if "%NEED_DOCKER_DB%"=="true" set "DB_URL_DOCKER=postgresql+psycopg2://%PG_USER%:%PG_PASS_ENC%@postgres:5432/%PG_DB%"
    if "%DB_TYPE%"=="mysql" if "%NEED_DOCKER_DB%"=="true" set "DB_URL_DOCKER=mysql+pymysql://%MY_USER%:%MY_PASS_ENC%@mysql:3306/%MY_DB%"
)

call :random_hex JWT_SECRET 64
call :random_hex ENCRYPTION_KEY 64
(
    echo APIMAKER_ENVIRONMENT=development
    echo APIMAKER_DATABASE_URL=%DB_URL_DOCKER%
    echo APIMAKER_JWT_SECRET_KEY=%JWT_SECRET%
    echo APIMAKER_ENCRYPTION_KEY=%ENCRYPTION_KEY%
) > ".env"

if "%NEED_DOCKER_DB%"=="true" (
    if not defined DOCKER_CMD (
        echo Docker Compose is not available to create the database.
        goto fail
    )
    echo Cleaning up previous Docker databases of this project...
    %DOCKER_CMD% --profile postgres --profile mysql down -v >nul 2>&1

    if "%DB_TYPE%"=="postgresql" (
        (
            echo POSTGRES_USER=%PG_USER%
            echo POSTGRES_PASSWORD=%PG_PASS%
            echo POSTGRES_DB=%PG_DB%
            echo POSTGRES_PORT=%PG_PORT%
        ) >> ".env"
        echo Starting PostgreSQL in Docker...
        %DOCKER_CMD% --profile postgres up -d postgres || goto fail
    )

    if "%DB_TYPE%"=="mysql" (
        (
            echo MYSQL_USER=%MY_USER%
            echo MYSQL_PASSWORD=%MY_PASS%
            echo MYSQL_DATABASE=%MY_DB%
            echo MYSQL_ROOT_PASSWORD=%MY_PASS%_root
            echo MYSQL_PORT=%MY_PORT%
        ) >> ".env"
        echo Starting MySQL in Docker...
        %DOCKER_CMD% --profile mysql up -d mysql || goto fail
    )
    echo Waiting for the database to be ready...
    timeout /t 20 /nobreak >nul
)

echo.
echo Initializing database...
pushd backend || goto fail
set "APIMAKER_DATABASE_URL=%DB_URL%"
".venv\Scripts\python.exe" app\scripts\seed_admin.py --username "%ADMIN_USER%" --password "%ADMIN_PASS%" || goto fail
popd

set /p "IMPORT_DEMO=Import Pokedex project? (y/n) [y]: "
if "%IMPORT_DEMO%"=="" set "IMPORT_DEMO=y"
if /i "%IMPORT_DEMO%"=="y" (
    pushd backend || goto fail
    set "APIMAKER_DATABASE_URL=%DB_URL%"
    ".venv\Scripts\python.exe" -m app.cli seed-demo --force || goto fail
    popd
)

if /i "%USE_DOCKER%"=="y" (
    echo Starting application services...
    set "PROFILES="
    if "%DB_TYPE%"=="postgresql" if "%NEED_DOCKER_DB%"=="true" set "PROFILES=--profile postgres"
    if "%DB_TYPE%"=="mysql" if "%NEED_DOCKER_DB%"=="true" set "PROFILES=--profile mysql"
    set "APIMAKER_DATABASE_URL=%DB_URL_DOCKER%"
    %DOCKER_CMD% !PROFILES! up -d --build || goto fail

    (
        echo @echo off
        echo cd /d "%%~dp0"
        echo echo Starting DoApi with Docker...
        echo %DOCKER_CMD% !PROFILES! up -d
        echo pause
    ) > start.bat
    (
        echo #!/usr/bin/env bash
        echo cd "$(dirname "$0")"
        echo echo "Starting DoApi with Docker..."
        echo %DOCKER_CMD% !PROFILES! up -d
    ) > start.sh
) else (
    (
        echo @echo off
        echo cd /d "%%~dp0"
        echo echo Starting DoApi...
        echo start "Backend" /D "%%~dp0backend" cmd /c ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
        echo start "Frontend" /D "%%~dp0frontend" cmd /c "npm run dev"
        echo echo.
        echo echo Both servers started in separate windows.
        echo echo Backend: http://localhost:8000
        echo echo Frontend: http://localhost:5173
    ) > start.bat
    (
        echo #!/usr/bin/env bash
        echo cd "$(dirname "$0")"
        echo echo "Starting DoApi..."
        echo "npx concurrently -n \"Backend,Frontend\" -c \"blue,green\" \"cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000\" \"cd frontend && npm run dev\""
    ) > start.sh
)
echo Generated 'start.sh' and 'start.bat' to start the application easily.

echo.
echo =======================================
echo    INSTALLATION COMPLETE
echo =======================================
echo Access URL: http://localhost:5173
echo Admin User: %ADMIN_USER%
echo Admin Password: %ADMIN_PASS%
echo.
echo Database: %DB_TYPE%
if "%DB_TYPE%"=="sqlite" echo File: backend\app\data\doapi.db
if "%DB_TYPE%"=="postgresql" echo Host: %PG_HOST%  User: %PG_USER%  Database: %PG_DB%
if "%DB_TYPE%"=="mysql" echo Host: %MY_HOST%  User: %MY_USER%  Database: %MY_DB%
if "%NEED_DOCKER_DB%"=="true" echo DB status: Docker container created and running.
echo.

if /i not "%USE_DOCKER%"=="y" (
    echo To start the application:
    echo Option 1: Run the generated script start.bat
    echo Option 2: Manually start by opening two consoles:
    echo   Console 1 ^(Backend^):  cd backend ^&^& .venv\Scripts\python.exe -m uvicorn app.main:app --reload
    echo   Console 2 ^(Frontend^): cd frontend ^&^& npm run dev
    echo.
)

pause
exit /b 0

:configure_postgres
if "!DB_SUB!"=="1" (
    set /p "PG_HOST=Host [localhost]: "
    if "!PG_HOST!"=="" set "PG_HOST=localhost"
    set /p "PG_PORT=Port [5432]: "
    if "!PG_PORT!"=="" set "PG_PORT=5432"
    set /p "PG_USER=User [postgres]: "
    if "!PG_USER!"=="" set "PG_USER=postgres"
    set /p "PG_PASS=Password: "
    set /p "PG_DB=Database name [doapi]: "
    if "!PG_DB!"=="" set "PG_DB=doapi"
) else (
    set "NEED_DOCKER_DB=true"
    set "PG_HOST=localhost"
    set "PG_PORT=5432"
    netstat -an | findstr ":5432" | findstr "LISTENING" >nul 2>&1
    if not errorlevel 1 (
        echo WARNING: Port 5432 is already in use.
        echo To create the new database in Docker we need to use another port.
        set /p "ALT_PORT=Enter the port to use [5433]: "
        if "!ALT_PORT!"=="" set "ALT_PORT=5433"
        echo !ALT_PORT!| findstr /r "^[0-9][0-9]*$" >nul
        if errorlevel 1 (
            echo Invalid port. Using 5433 by default.
            set "ALT_PORT=5433"
        )
        set "PG_PORT=!ALT_PORT!"
    )
    set "PG_USER=doapi"
    call :random_hex PG_PASS 24
    set "PG_DB=doapi"
    echo A PostgreSQL container will be created on port !PG_PORT!.
)
call :urlencode "!PG_PASS!" PG_PASS_ENC
set "DB_URL=postgresql+psycopg2://!PG_USER!:!PG_PASS_ENC!@!PG_HOST!:!PG_PORT!/!PG_DB!"
set "DB_URL_DOCKER=!DB_URL!"
exit /b 0

:configure_mysql
if "!DB_SUB!"=="1" (
    set /p "MY_HOST=Host [localhost]: "
    if "!MY_HOST!"=="" set "MY_HOST=localhost"
    set /p "MY_PORT=Port [3306]: "
    if "!MY_PORT!"=="" set "MY_PORT=3306"
    set /p "MY_USER=User [root]: "
    if "!MY_USER!"=="" set "MY_USER=root"
    set /p "MY_PASS=Password: "
    set /p "MY_DB=Database name [doapi]: "
    if "!MY_DB!"=="" set "MY_DB=doapi"
) else (
    set "NEED_DOCKER_DB=true"
    set "MY_HOST=localhost"
    set "MY_PORT=3306"
    netstat -an | findstr ":3306" | findstr "LISTENING" >nul 2>&1
    if not errorlevel 1 (
        echo WARNING: Port 3306 is already in use.
        echo To create the new database in Docker we need to use another port.
        set /p "ALT_PORT=Enter the port to use [3307]: "
        if "!ALT_PORT!"=="" set "ALT_PORT=3307"
        echo !ALT_PORT!| findstr /r "^[0-9][0-9]*$" >nul
        if errorlevel 1 (
            echo Invalid port. Using 3307 by default.
            set "ALT_PORT=3307"
        )
        set "MY_PORT=!ALT_PORT!"
    )
    set "MY_USER=doapi"
    call :random_hex MY_PASS 24
    set "MY_DB=doapi"
    echo A MySQL container will be created on port !MY_PORT!.
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

:random_urlsafe
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(%~2)).TrimEnd('=').Replace('+','-').Replace('/','_')"`) do set "%~1=%%A"
exit /b 0

:require_cmd
where %~1 >nul 2>&1
if errorlevel 1 (
    echo Missing %~2 ^(%~1^). Install it and re-run this script.
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
    echo Missing Python 3.11+. Install it and re-run this script.
    exit /b 1
)
"%PYTHON_CMD%" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if errorlevel 1 (
    echo Python found, but Python 3.11 or higher is required.
    echo Detected path: %PYTHON_CMD%
    exit /b 1
)
exit /b 0

:fail
echo.
echo ERROR: installation did not complete.
pause
exit /b 1

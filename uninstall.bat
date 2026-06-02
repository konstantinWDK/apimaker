@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo =======================================
echo    DoApi - Factory Reset
echo =======================================
echo WARNING: This will delete configuration, users, local databases and installed dependencies.
set /p "CONFIRM=Are you sure you want to continue? Type y to confirm: "

if /i not "%CONFIRM%"=="y" (
    echo Operation cancelled.
    exit /b 0
)

set "DOCKER_CMD="
docker compose version >nul 2>&1
if not errorlevel 1 set "DOCKER_CMD=docker compose"
if not defined DOCKER_CMD (
    docker-compose version >nul 2>&1
    if not errorlevel 1 set "DOCKER_CMD=docker-compose"
)

echo Stopping Docker services of this project...
if defined DOCKER_CMD (
    %DOCKER_CMD% --profile postgres --profile mysql down --volumes --remove-orphans --rmi all 2>nul
    echo Pruning Docker build cache...
    docker builder prune -a -f 2>nul
) else (
    echo Docker Compose not available; skipping container shutdown.
)

echo Stopping local processes on ports 8000 and 5173...
for %%P in (8000 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
        taskkill /F /PID %%A 2>nul
    )
)

echo Cleaning up files...

echo   - Backend...
if exist "backend\.venv" rmdir /s /q "backend\.venv"
if exist "backend\app\data" (
    del /q "backend\app\data\*.db" 2>nul
    del /q "backend\app\data\*.json" 2>nul
    del /q "backend\app\data\*.sqlite" 2>nul
    rmdir /s /q "backend\app\data"
)
if exist "backend\.env" del /q "backend\.env"
for /d /r backend %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d"
for /d /r backend %%d in (.pytest_cache) do @if exist "%%d" rmdir /s /q "%%d"
for /d /r backend %%d in (.eggs) do @if exist "%%d" rmdir /s /q "%%d"
for /d /r backend %%d in (*.egg-info) do @if exist "%%d" rmdir /s /q "%%d"
if exist "backend\artifacts" rmdir /s /q "backend\artifacts"

echo   - Frontend...
if exist "frontend\node_modules" rmdir /s /q "frontend\node_modules"
if exist "frontend\dist" rmdir /s /q "frontend\dist"
if exist "frontend\.vite" rmdir /s /q "frontend\.vite"
if exist "frontend\.env" del /q "frontend\.env" 2>nul

echo   - Deployments...
if exist "deployments" rmdir /s /q "deployments"

echo   - Root...
if exist ".env" del /q ".env"
if exist "start.sh" del /q "start.sh"
if exist "start.bat" del /q "start.bat"
if exist ".pytest_cache" rmdir /s /q ".pytest_cache"
del /q "*.log" 2>nul

echo.
echo The project has been restored to its initial state.
echo You can now run install.bat to start a new installation.
pause

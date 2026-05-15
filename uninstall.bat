@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo =======================================
echo    API Maker - Factory Reset
echo =======================================
echo AVISO: Esto eliminara configuracion, usuarios, bases de datos locales y dependencias instaladas.
set /p "CONFIRM=Estas seguro de que quieres continuar? Escribe y para confirmar: "

if /i not "%CONFIRM%"=="y" (
    echo Operacion cancelada.
    exit /b 0
)

set "DOCKER_CMD="
docker compose version >nul 2>&1
if not errorlevel 1 set "DOCKER_CMD=docker compose"
if not defined DOCKER_CMD (
    docker-compose version >nul 2>&1
    if not errorlevel 1 set "DOCKER_CMD=docker-compose"
)

echo Deteniendo servicios Docker de este proyecto...
if defined DOCKER_CMD (
    %DOCKER_CMD% --profile postgres --profile mysql down --volumes --remove-orphans 2>nul
) else (
    echo Docker Compose no disponible; se omite parada de contenedores.
)

echo Deteniendo procesos locales en puertos 8000 y 5173...
for %%P in (8000 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
        taskkill /F /PID %%A 2>nul
    )
)

echo Limpiando archivos...

echo   - Backend...
if exist "backend\.venv" rmdir /s /q "backend\.venv"
if exist "backend\app\data" del /q "backend\app\data\*.db" 2>nul
if exist "backend\app\data" del /q "backend\app\data\*.json" 2>nul
if exist "backend\app\data" del /q "backend\app\data\*.sqlite" 2>nul
if exist "backend\.env" del /q "backend\.env"
for /d /r backend %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d"
for /d /r backend %%d in (.pytest_cache) do @if exist "%%d" rmdir /s /q "%%d"

echo   - Frontend...
if exist "frontend\node_modules" rmdir /s /q "frontend\node_modules"
if exist "frontend\dist" rmdir /s /q "frontend\dist"
if exist "frontend\.vite" rmdir /s /q "frontend\.vite"

echo   - Raiz...
if exist ".env" del /q ".env"
if exist ".pytest_cache" rmdir /s /q ".pytest_cache"
del /q "*.log" 2>nul

echo.
echo El proyecto ha sido restaurado a su estado inicial.
echo Ahora puedes ejecutar install.bat para comenzar una nueva instalacion.
pause

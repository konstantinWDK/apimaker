@echo off
setlocal

echo =======================================
echo    ⚠️  API Maker - Factory Reset
echo =======================================
echo AVISO: Esto eliminara toda la configuracion, usuarios y bases de datos.
set /p CONFIRM="¿Estas seguro de que quieres continuar? (y/n): "

if /i "%CONFIRM%" neq "y" (
    echo Operacion cancelada.
    exit /b
)

echo Deteniendo procesos...
:: Detener Docker
docker-compose down --volumes --remove-orphans 2>nul

:: Matar procesos (ignorar errores si no existen)
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM python.exe /T 2>nul

echo Limpiando archivos...

:: Backend
echo   - Limpiando Backend...
if exist backend\.venv rmdir /s /q backend\.venv
if exist backend\app\data del /q backend\app\data\*.db
if exist backend\app\data del /q backend\app\data\*.json
if exist backend\app\data del /q backend\app\data\*.sqlite
if exist backend\.env del /q backend\.env
for /d /r backend %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d"

:: Frontend
echo   - Limpiando Frontend...
if exist frontend\node_modules rmdir /s /q frontend\node_modules
if exist frontend\dist rmdir /s /q frontend\dist
for /d /r frontend %%d in (node_modules) do @if exist "%%d" rmdir /s /q "%%d"

echo.
echo ✅ El proyecto ha sido restaurado a su estado inicial.
echo Ahora puedes ejecutar install.bat para comenzar una nueva instalacion.
pause

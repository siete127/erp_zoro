@echo off
REM Script de prueba rápida del backend - Windows
REM Verifica que todas las variables de entorno están correctas

echo.
echo =============================================================================
echo  VERIFICANDO BACKEND - Prueba de Startup
echo =============================================================================
echo.

cd backend
echo Ejecutando test de variables de entorno...
echo.

node test-backend-startup.js

if errorlevel 1 (
    echo.
    echo ❌ Las verificaciones fallaron. Revisa los errores arriba.
    echo.
    pause
    exit /b 1
)

echo.
echo ¿Deseas iniciar el backend ahora? (S/N)
set /p response=
if /i "%response%"=="S" (
    echo.
    echo Iniciando backend...
    node server.js
) else (
    echo.
    echo Para iniciar el backend más tarde, usa:
    echo   cd backend ^&^& node server.js
    echo.
)

@echo off
echo ========================================
echo Instalando tabla de productos recurrentes
echo ========================================
echo.

cd /d "%~dp0backend"

echo Ejecutando schema SQL...
sqlcmd -S localhost -d ERP_DB -E -i "sql\client_recurring_products_schema.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Instalacion completada exitosamente
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Error en la instalacion
    echo ========================================
)

echo.
pause

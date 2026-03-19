@echo off
echo ========================================
echo Limpiando cache y reiniciando frontend
echo ========================================
echo.

cd /d "%~dp0frontend"

echo Eliminando cache de Vite...
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo Cache eliminado
) else (
    echo No hay cache para eliminar
)

echo.
echo Iniciando servidor de desarrollo...
npm run dev

pause

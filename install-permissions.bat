@echo off
echo ========================================
echo Instalando Sistema de Permisos
echo ========================================
echo.
echo IMPORTANTE: Ejecuta el archivo SQL manualmente en SQL Server Management Studio:
echo %CD%\backend\sql\permisos_schema.sql
echo.
echo O copia y pega este contenido en una nueva query:
echo.
type backend\sql\permisos_schema.sql
echo.
echo ========================================
pause

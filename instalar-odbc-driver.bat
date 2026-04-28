@echo off
REM ============================================================================
REM Script para instalar ODBC Driver 18 para SQL Server
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================================
echo 📥 INSTALADOR: ODBC Driver 18 para SQL Server
echo ============================================================================
echo.

REM Verificar si ya está instalado
reg query "HKLM\Software\ODBC\ODBCINST.INI\ODBC Driver 18 for SQL Server" >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo ✅ ODBC Driver 18 ya está instalado
    echo.
    goto end
)

echo ⚠️  ODBC Driver 18 NO está instalado
echo.
echo Descargando desde Microsoft...
echo URL: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
echo.

REM Detectar arquitectura del sistema
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set ARCH=x64
    echo 🔧 Arquitectura detectada: 64-bit
) else (
    set ARCH=x86
    echo 🔧 Arquitectura detectada: 32-bit
)

echo.
echo 📋 Pasos para instalar:
echo.
echo 1. Abre el navegador y ve a:
echo    https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
echo.
echo 2. Descarga "msodbcsql.msi" para !ARCH!-bit
echo.
echo 3. Ejecuta el instalador descargado
echo.
echo 4. Sigue los pasos del instalador
echo.
echo 5. Vuelve a ejecutar este script
echo.

:end
echo ============================================================================
pause

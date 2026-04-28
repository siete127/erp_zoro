@echo off
setlocal
cd /d "%~dp0"

echo Iniciando backend Python ERP Zoro en http://0.0.0.0:8000
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir erp_zoro_python
) else (
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir erp_zoro_python
)

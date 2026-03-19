@echo off
echo ========================================
echo Reconstruyendo Frontend para Produccion
echo ========================================
cd frontend
call npm run build
echo.
echo ========================================
echo Build completado!
echo Ahora sube la carpeta frontend/dist a tu servidor
echo ========================================
pause

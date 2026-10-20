@echo off
chcp 65001 >nul
title Mi Tienda de Ropa
echo ============================================
echo    MI TIENDA DE ROPA - Iniciando servidor
echo ============================================
echo.
echo   Tienda:      http://localhost:3000
echo   Panel admin: http://localhost:3000/admin/login.html
echo.
echo   (Deja esta ventana abierta para que la tienda funcione)
echo   Para cerrar: presiona Ctrl+C o cierra esta ventana.
echo.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js.
  echo Descargalo e instalalo desde https://nodejs.org (version LTS)
  echo y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias la primera vez, espera...
  call npm install --no-fund --no-audit
)

echo Abriendo el navegador...
start "" http://localhost:3000/admin/login.html

node server\index.js
pause

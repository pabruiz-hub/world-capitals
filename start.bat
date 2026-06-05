@echo off
cd /d "%~dp0"

python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Starting World Capitals...
    start /b python -m http.server 8000 >nul 2>&1
    timeout /t 1 /nobreak >nul
    start "" "http://localhost:8000"
    exit
)

python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo Starting World Capitals...
    start /b python3 -m http.server 8000 >nul 2>&1
    timeout /t 1 /nobreak >nul
    start "" "http://localhost:8000"
    exit
)

echo Python not found, opening directly...
start "" "%~dp0index.html"

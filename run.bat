@echo off
echo ===================================================
echo   ICBT UniRide - Campus Carpooling System Launcher
echo   SEN5002 Agile Development and DevOps Project
echo ===================================================
echo.
echo [1/3] Checking Node.js environment...
node -v
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js v18+.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Running Automated Test Suite...
cd server
call npm test
if %errorlevel% neq 0 (
    echo [WARNING] Some tests failed. Proceeding with launch...
) else (
    echo [OK] All 9 automated tests passed successfully!
)

echo.
echo [3/3] Starting Full-Stack Server on port 5000...
echo Open your browser at: http://localhost:5000
echo.
echo Press Ctrl+C to terminate the server.
node src/server.js
pause

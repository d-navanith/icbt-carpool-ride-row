#!/usr/bin/env bash
set -e

echo "==================================================="
echo "  ICBT UniRide - Campus Carpooling System Launcher"
echo "  SEN5002 Agile Development and DevOps Project"
echo "==================================================="
echo ""
echo "[1/3] Checking Node.js environment..."
node -v

echo ""
echo "[2/3] Running Automated Test Suite..."
cd server
npm test

echo ""
echo "[3/3] Starting Full-Stack Server on port 5000..."
echo "Open your browser at: http://localhost:5000"
echo ""
node src/server.js

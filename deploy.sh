#!/bin/bash
set -e

echo "=== PASALO OS Deployment ==="
echo ""

# Check .env file
if [ ! -f .env ]; then
  echo "ERROR: No .env file found!"
  echo "Copy .env.production to .env and fill in real values:"
  echo "  cp .env.production .env"
  echo "  nano .env"
  echo ""
  echo "MUST CHANGE: JWT_SECRET, DB_PASSWORD, YOUR_SERVER_IP"
  exit 1
fi

# Check JWT_SECRET is not default
if grep -q "CHANGE-ME" .env; then
  echo "ERROR: .env still has placeholder values (CHANGE-ME)!"
  echo "Edit .env and set real JWT_SECRET and DB_PASSWORD."
  exit 1
fi

echo "[1/4] Building containers..."
docker-compose build

echo "[2/4] Starting database and redis..."
docker-compose up -d postgres redis

echo "[3/4] Waiting for database to be ready..."
sleep 5

# Run migrations
echo "[4/4] Starting all services (migrations run automatically on backend startup)..."
docker-compose up -d

echo ""
echo "=== PASALO OS is running! ==="
echo "Frontend: http://localhost"
echo "Backend API: http://localhost/api/v1"
echo "Health check: http://localhost/health"
echo ""
echo "Useful commands:"
echo "  docker-compose logs -f          # watch all logs"
echo "  docker-compose logs -f backend   # backend logs only"
echo "  docker-compose ps                # check service status"
echo "  docker-compose down              # stop everything"

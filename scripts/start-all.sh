#!/bin/bash
#
# start-all.sh - Start all MedEd platform services
#
# Usage: ./start-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEDED_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "Starting MedEd Platform v2..."
echo "Base directory: $MEDED_DIR"
echo ""

# Function to start a service
start_service() {
  local name=$1
  local dir=$2
  local cmd=$3
  local port=$4

  echo "Starting $name on port $port..."
  cd "$MEDED_DIR/$dir"

  # Check if venv exists
  if [ -d ".venv" ]; then
    source .venv/bin/activate
  elif [ -d "venv" ]; then
    source venv/bin/activate
  fi

  # Start in background
  nohup $cmd > "/tmp/meded-$name.log" 2>&1 &
  echo "  PID: $! (log: /tmp/meded-$name.log)"
}

# Function to start npm service
start_npm() {
  local name=$1
  local dir=$2
  local port=$3

  echo "Starting $name on port $port..."
  cd "$MEDED_DIR/$dir"
  nohup npm run dev > "/tmp/meded-$name.log" 2>&1 &
  echo "  PID: $! (log: /tmp/meded-$name.log)"
}

# Start Python backends (new port scheme: 9101-9105)
start_service "oread" "synpat" "python server.py" "9104"
start_service "syrinx" "synvoice" "python server.py" "9103"
start_service "mneme-backend" "synchart/backend" "python -m src.main" "9102"
start_service "echo" "echo" "uvicorn src.main:app --port 9101" "9101"
start_service "athena" "athena" "env PYTHONPATH=$MEDED_DIR uvicorn athena.src.main:app --port 9105" "9105"

# Start frontends
start_npm "mneme-frontend" "synchart/frontend" "5173"

# Start portal if it exists
if [ -d "$MEDED_DIR/metis/portal" ] && [ -f "$MEDED_DIR/metis/portal/package.json" ]; then
  start_npm "portal" "metis/portal" "9100"
else
  echo "Note: Portal not yet built. Run 'npm install' in metis/portal first."
fi

echo ""
echo "All services starting. Wait a few seconds then check:"
echo "  ./status.sh"
echo ""
echo "Service URLs:"
echo "  Portal (Metis):  http://localhost:9100"
echo "  Echo:            http://localhost:9101"
echo "  Mneme Backend:   http://localhost:9102"
echo "  Mneme Frontend:  http://localhost:5173"
echo "  Syrinx:          http://localhost:9103"
echo "  Oread:           http://localhost:9104"
echo "  Athena:          http://localhost:9105"

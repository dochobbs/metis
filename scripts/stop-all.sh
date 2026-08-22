#!/bin/bash
#
# stop-all.sh - Stop all MedEd platform services
#
# Usage: ./stop-all.sh

echo "Stopping MedEd Platform services..."

stop_service() {
  local name=$1
  local port=$2
  local pid_file="/tmp/meded-$name.pid"
  local stopped=0

  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && stopped=1
    fi
    rm -f "$pid_file"
  fi

  # Fallback: stop the process listening on the known service port only.
  while IFS= read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && stopped=1
    fi
  done < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)

  if [ "$stopped" -eq 1 ]; then
    echo "  Stopped: $name"
  else
    echo "  Not running: $name"
  fi
}

stop_service "oread" 9104
stop_service "syrinx" 9103
stop_service "mneme-backend" 9102
stop_service "echo" 9101
stop_service "athena" 9105
stop_service "mneme-frontend" 5173
stop_service "portal" 9100

echo ""
echo "All services stopped."
echo "Verify with: ./status.sh"

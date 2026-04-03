#!/bin/bash
#
# status.sh - Check status of all MedEd platform services
#
# Usage: ./status.sh

echo "MedEd Platform v2 Status"
echo "========================"
echo ""

check_port() {
  local name=$1
  local port=$2
  local url=$3

  if lsof -i :$port -sTCP:LISTEN > /dev/null 2>&1; then
    # Try to get a response
    if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200\|404"; then
      echo "  $name (port $port): UP"
    else
      echo "  $name (port $port): LISTENING (no HTTP response)"
    fi
  else
    echo "  $name (port $port): DOWN"
  fi
}

echo "Backends:"
check_port "Echo" 9101 "http://localhost:9101/health"
check_port "Mneme Backend" 9102 "http://localhost:9102/health"
check_port "Syrinx" 9103 "http://localhost:9103/"
check_port "Oread" 9104 "http://localhost:9104/"
check_port "Athena" 9105 "http://localhost:9105/api/health"

echo ""
echo "Frontends:"
check_port "Mneme Frontend" 5173 "http://localhost:5173/"
check_port "Metis Portal" 9100 "http://localhost:9100/"

echo ""
echo "Logs:"
for log in /tmp/meded-*.log; do
  if [ -f "$log" ]; then
    echo "  $log"
  fi
done

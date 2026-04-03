#!/bin/bash
#
# stop-all.sh - Stop all MedEd platform services
#
# Usage: ./stop-all.sh

echo "Stopping MedEd Platform services..."

# Kill Python servers
pkill -f "python server.py" 2>/dev/null && echo "  Stopped: Python servers (Oread, Syrinx)"
pkill -f "python -m src.main" 2>/dev/null && echo "  Stopped: Mneme backend"
pkill -f "uvicorn src.main:app" 2>/dev/null && echo "  Stopped: Echo"
pkill -f "uvicorn athena.src.main:app" 2>/dev/null && echo "  Stopped: Athena"

# Kill Vite dev servers
pkill -f "vite" 2>/dev/null && echo "  Stopped: Vite servers"

echo ""
echo "All services stopped."
echo "Verify with: ./status.sh"

#!/usr/bin/env bash
# ==============================================================================
# Cyclone Anticipatory Action Platform — Unified Startup Script
#
# Launches both the FastAPI Backend (port 8000) and Vite Frontend (port 5173)
# concurrently. Handles graceful shutdown on SIGINT / SIGTERM (Ctrl+C).
#
# Usage:
#   ./run.sh            # Run backend and frontend
#   ./run.sh --restart  # Auto-kill existing processes on ports 8000/5173 and start
#   ./run.sh --help     # Show help message
# ==============================================================================

set -uo pipefail

# Project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$ROOT_DIR/.venv"

# ANSI Colors for formatting
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[1;36m"
C_BLUE="\033[1;34m"
C_GREEN="\033[1;32m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"
C_MAGENTA="\033[1;35m"

print_banner() {
    echo -e "${C_CYAN}"
    echo "  ======================================================================"
    echo "    🌪️  CYCLONE ANTICIPATORY ACTION PLATFORM"
    echo "    Bay of Bengal & Coastal APAC Pre-Landfall Prediction Engine"
    echo "  ======================================================================"
    echo -e "${C_RESET}"
}

print_help() {
    echo "Usage: ./run.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --restart, -r, --force, -f   Automatically terminate any processes"
    echo "                               currently using ports 8000 or 5173."
    echo "  --backend-only               Start only the FastAPI backend server."
    echo "  --frontend-only              Start only the Vite frontend dashboard."
    echo "  --help, -h                   Display this help message."
    echo ""
    echo "Endpoints:"
    echo "  Frontend Dashboard : http://localhost:5173"
    echo "  Backend API        : http://localhost:8000"
    echo "  Swagger API Docs   : http://localhost:8000/docs"
    echo "  ReDoc API Docs     : http://localhost:8000/redoc"
}

# Parse command line flags
AUTO_KILL=false
BACKEND_ONLY=false
FRONTEND_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --restart|-r|--force|-f)
            AUTO_KILL=true
            ;;
        --backend-only)
            BACKEND_ONLY=true
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            ;;
        --help|-h)
            print_banner
            print_help
            exit 0
            ;;
        *)
            echo -e "${C_YELLOW}[!] Unknown option: $arg${C_RESET}"
            print_help
            exit 1
            ;;
    esac
done

print_banner

# Helper to check if a port is in use
check_port() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti :"$port" 2>/dev/null || true
    elif command -v fuser >/dev/null 2>&1; then
        fuser "$port/tcp" 2>/dev/null || true
    fi
}

# Check for existing processes on required ports
PORT_8000_PID=$(check_port 8000)
PORT_5173_PID=$(check_port 5173)

if [ "$FRONTEND_ONLY" = false ] && [ -n "$PORT_8000_PID" ]; then
    if [ "$AUTO_KILL" = true ]; then
        echo -e "${C_YELLOW}[!] Port 8000 is occupied by PID(s): $PORT_8000_PID. Terminating...${C_RESET}"
        kill -9 $PORT_8000_PID 2>/dev/null || true
        sleep 1
    else
        echo -e "${C_RED}[ERROR] Port 8000 is already in use by process PID(s): $PORT_8000_PID${C_RESET}"
        echo -e "        Run ${C_BOLD}./run.sh --restart${C_RESET} to automatically kill previous instances,"
        echo -e "        or manually stop the existing process."
        exit 1
    fi
fi

if [ "$BACKEND_ONLY" = false ] && [ -n "$PORT_5173_PID" ]; then
    if [ "$AUTO_KILL" = true ]; then
        echo -e "${C_YELLOW}[!] Port 5173 is occupied by PID(s): $PORT_5173_PID. Terminating...${C_RESET}"
        kill -9 $PORT_5173_PID 2>/dev/null || true
        sleep 1
    else
        echo -e "${C_RED}[ERROR] Port 5173 is already in use by process PID(s): $PORT_5173_PID${C_RESET}"
        echo -e "        Run ${C_BOLD}./run.sh --restart${C_RESET} to automatically kill previous instances,"
        echo -e "        or manually stop the existing process."
        exit 1
    fi
fi

# Detect python/uvicorn
UVICORN_CMD=""
if [ -f "$VENV_DIR/bin/uvicorn" ]; then
    UVICORN_CMD="$VENV_DIR/bin/uvicorn"
elif [ -f "$VENV_DIR/bin/python" ]; then
    UVICORN_CMD="$VENV_DIR/bin/python -m uvicorn"
elif command -v uvicorn >/dev/null 2>&1; then
    UVICORN_CMD="uvicorn"
elif command -v python3 >/dev/null 2>&1; then
    UVICORN_CMD="python3 -m uvicorn"
else
    echo -e "${C_RED}[ERROR] Neither .venv nor system uvicorn/python3 could be located.${C_RESET}"
    exit 1
fi

# Verify frontend dependencies
if [ "$BACKEND_ONLY" = false ]; then
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo -e "${C_YELLOW}[*] frontend/node_modules not found. Installing npm dependencies...${C_RESET}"
        (cd "$FRONTEND_DIR" && npm install)
    fi
fi

# Background PID variables
BACKEND_PID=""
FRONTEND_PID=""

# Cleanup handler on exit or interrupt
cleanup() {
    echo ""
    echo -e "${C_YELLOW}[!] Initiating graceful shutdown...${C_RESET}"

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${C_BLUE}[*] Stopping Backend (PID: $BACKEND_PID)...${C_RESET}"
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "${C_CYAN}[*] Stopping Frontend (PID: $FRONTEND_PID)...${C_RESET}"
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi

    # Kill any remaining sub-processes in our job group
    jobs -p | xargs -r kill 2>/dev/null || true

    echo -e "${C_GREEN}[✓] All platform services safely terminated.${C_RESET}"
    exit 0
}

# Trap SIGINT (Ctrl+C), SIGTERM, and EXIT
trap cleanup SIGINT SIGTERM

echo -e "${C_BOLD}Starting platform services in parallel:${C_RESET}"
echo ""

# 1. Start Backend
if [ "$FRONTEND_ONLY" = false ]; then
    echo -e "${C_BLUE}--> Launching FastAPI Backend on http://localhost:8000${C_RESET}"
    (cd "$BACKEND_DIR" && $UVICORN_CMD backend.main:app --reload --port 8000) &
    BACKEND_PID=$!
    echo -e "${C_GREEN}    Backend process started [PID: $BACKEND_PID]${C_RESET}"
fi

# 2. Start Frontend
if [ "$BACKEND_ONLY" = false ]; then
    echo -e "${C_CYAN}--> Launching Vite Frontend on http://localhost:5173${C_RESET}"
    (cd "$FRONTEND_DIR" && npm run dev) &
    FRONTEND_PID=$!
    echo -e "${C_GREEN}    Frontend process started [PID: $FRONTEND_PID]${C_RESET}"
fi

echo ""
echo -e "${C_BOLD}${C_GREEN}======================================================================${C_RESET}"
echo -e "  ${C_BOLD}PLATFORM IS LIVE:${C_RESET}"
if [ "$FRONTEND_ONLY" = false ]; then
    echo -e "  ${C_BLUE}• Backend API :${C_RESET} ${C_BOLD}http://localhost:8000${C_RESET}"
    echo -e "  ${C_BLUE}• API Docs    :${C_RESET} ${C_BOLD}http://localhost:8000/docs${C_RESET}"
fi
if [ "$BACKEND_ONLY" = false ]; then
    echo -e "  ${C_CYAN}• Frontend UI :${C_RESET} ${C_BOLD}http://localhost:5173${C_RESET}"
fi
echo -e "  ${C_YELLOW}• To stop all services, press ${C_BOLD}Ctrl+C${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}======================================================================${C_RESET}"
echo ""

# Wait for both processes
if [ -n "$BACKEND_PID" ] && [ -n "$FRONTEND_PID" ]; then
    wait "$BACKEND_PID" "$FRONTEND_PID"
elif [ -n "$BACKEND_PID" ]; then
    wait "$BACKEND_PID"
elif [ -n "$FRONTEND_PID" ]; then
    wait "$FRONTEND_PID"
fi

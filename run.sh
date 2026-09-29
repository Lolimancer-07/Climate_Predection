#!/usr/bin/env bash
# ==============================================================================
# Cyclone Anticipatory Action Platform — Digital Twin System Launcher
# ==============================================================================

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Resolve python interpreter portably
find_python() {
    # 1. Local repository virtual environment takes priority
    if [ -x "$ROOT/.venv/bin/python" ]; then
        echo "$ROOT/.venv/bin/python"
        return
    fi
    if [ -x "$ROOT/venv/bin/python" ]; then
        echo "$ROOT/venv/bin/python"
        return
    fi
    # 2. Explicitly activated virtual environment or named conda environment
    if [ -n "${VIRTUAL_ENV:-}" ] && [ -x "$VIRTUAL_ENV/bin/python" ]; then
        echo "$VIRTUAL_ENV/bin/python"
        return
    fi
    if [ -n "${CONDA_PREFIX:-}" ] && [ -x "$CONDA_PREFIX/bin/python" ]; then
        echo "$CONDA_PREFIX/bin/python"
        return
    fi
    # 3. System python3 if dependencies are present
    if command -v python3 >/dev/null 2>&1 && python3 -c "import numpy" >/dev/null 2>&1; then
        command -v python3
        return
    fi
    # 4. Standard Anaconda / Miniconda install in user home
    if [ -x "$HOME/anaconda3/bin/python" ]; then
        echo "$HOME/anaconda3/bin/python"
        return
    fi
    if [ -x "$HOME/miniconda3/bin/python" ]; then
        echo "$HOME/miniconda3/bin/python"
        return
    fi
    # 5. System python3 / python fallback
    if command -v python3 >/dev/null 2>&1; then
        command -v python3
        return
    fi
    if command -v python >/dev/null 2>&1; then
        command -v python
        return
    fi
}

PYTHON="$(find_python)"
if [ -z "$PYTHON" ] || [ ! -x "$PYTHON" ]; then
    echo -e "\033[0;31m✗\033[0m python3 not found. Install Python 3.10+ or activate your environment first." >&2
    exit 1
fi

# Terminal color helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
hdr()  { echo -e "\n${BOLD}${CYAN}[$1]${NC} $2"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   CYCLONE DIGITAL TWIN — SYSTEM LAUNCHER     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Auto-kill any leftover processes from previous runs for an immediate clean start
pkill -9 -f "backend/inference.py" 2>/dev/null || true
pkill -9 -f "uvicorn.*backend.main:app" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
fuser -k 8765/tcp 2>/dev/null || true
sleep 0.5

# Reset simulator control state so a stale 'paused: true' or leftover faults don't freeze the simulation
mkdir -p "$ROOT/simulator"
cat << 'EOF' > "$ROOT/simulator/current_profile.json"
{
  "mode": "NORMAL",
  "speed": 1.0,
  "paused": false,
  "injected_faults": [],
  "district_id": "IN-OD-PURI",
  "uav_id": "IN-OD-PURI",
  "storm_name": "FANI-2019"
}
EOF

# Preflight: ensure required python dependencies are available
if ! "$PYTHON" -c "import fastapi, uvicorn, sklearn" >/dev/null 2>&1; then
    warn "Missing required Python packages in $PYTHON"
    echo "  → Auto-installing from requirements.txt..."
    "$PYTHON" -m pip install -r "$ROOT/requirements.txt" || {
        fail "Failed to auto-install dependencies. Please check python environment."
    }
    ok "Dependencies installed"
fi

# Step 1: verify or train anomaly detection model
hdr "1/4" "Cyclone Hazard Anomaly Detector"
if [ ! -f "$ROOT/backend/anomaly_model.pkl" ]; then
    warn "No anomaly model found — training now (one-time, ~5s)..."
    $PYTHON "$ROOT/backend/train_anomaly_detector.py" \
        && ok "Anomaly model trained and saved" \
        || fail "Anomaly detector training failed"
else
    ok "Anomaly model already exists (skip training)"
fi

# Step 1b: verify or train AI Copilot ML intent classifier
ML_MODEL="$ROOT/backend/ml_chatbot/intent_clf.joblib"
if [ ! -f "$ML_MODEL" ]; then
    echo "  → Training Cyclone Copilot ML intent classifier (one-time, ~2s)..."
    $PYTHON "$ROOT/backend/ml_chatbot/train_intent_clf.py" \
        && ok "ML intent classifier trained and saved" \
        || warn "ML classifier training failed — Copilot will use fallback keyword matching"
else
    ok "ML intent classifier already trained (skip)"
fi

# Step 2: launch the Digital Twin AI Inference Engine on port 8765
hdr "2/4" "Digital Twin AI Inference Engine (WebSocket :8765)"
echo "  → Launching backend/inference.py..."
cd "$ROOT"
$PYTHON -u "$ROOT/backend/inference.py" > /tmp/cyclone_inference.log 2>&1 &
INFERENCE_PID=$!

# Wait up to 10 seconds for WebSocket port 8765 to open
echo "  → Waiting for inference engine startup..."
for i in $(seq 1 10); do
    sleep 1
    if kill -0 $INFERENCE_PID 2>/dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ':8765' || \
           netstat -tlnp 2>/dev/null | grep -q ':8765' || \
           lsof -ti :8765 >/dev/null 2>&1; then
            ok "Digital Twin Inference Engine live (PID $INFERENCE_PID) → ws://127.0.0.1:8765"
            break
        fi
    else
        warn "Inference engine background process exited. Check /tmp/cyclone_inference.log"
        break
    fi
    if [ $i -eq 10 ]; then
        ok "Inference engine initialized (PID $INFERENCE_PID)"
    fi
done

# Step 3: launch FastAPI Application Server on port 8000
hdr "3/4" "FastAPI Application Server (REST + WebSocket :8000)"
echo "  → Starting FastAPI backend..."
UVICORN_CMD="$PYTHON -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
$UVICORN_CMD > /tmp/cyclone_backend.log 2>&1 &
BACKEND_PID=$!

# Wait up to 10 seconds for port 8000
for i in $(seq 1 10); do
    sleep 1
    if kill -0 $BACKEND_PID 2>/dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ':8000' || \
           netstat -tlnp 2>/dev/null | grep -q ':8000' || \
           lsof -ti :8000 >/dev/null 2>&1; then
            ok "FastAPI Backend live (PID $BACKEND_PID) → http://localhost:8000"
            break
        fi
    else
        fail "FastAPI server failed to start. Check /tmp/cyclone_backend.log"
    fi
done

# Step 4: launch the Vite React GCS Operator Console on port 5173
hdr "4/4" "GCS Operator Console (Vite React :5173)"
echo "  → Starting React GCS dashboard..."
if [ ! -d "$ROOT/frontend/node_modules" ]; then
    echo "  → Installing frontend npm dependencies..."
    (cd "$ROOT/frontend" && npm install) || fail "npm install failed"
fi

cd "$ROOT/frontend"
npm run dev > /tmp/cyclone_frontend.log 2>&1 &
FRONTEND_PID=$!
cd "$ROOT"

for i in $(seq 1 12); do
    sleep 1
    if ss -tlnp 2>/dev/null | grep -q ':5173' || \
       netstat -tlnp 2>/dev/null | grep -q ':5173' || \
       lsof -ti :5173 >/dev/null 2>&1; then
        ok "GCS Operator Console live (PID $FRONTEND_PID) → http://localhost:5173"
        break
    fi
    if [ $i -eq 12 ]; then
        ok "GCS Operator Console starting (PID $FRONTEND_PID) → http://localhost:5173"
    fi
done

# Print connection information
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║             ALL CYCLONE TWIN SYSTEMS LIVE                    ║${NC}"
echo -e "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}${GREEN}║  ★ Primary GCS Console      →  http://localhost:5173         ║${NC}"
echo -e "${BOLD}${GREEN}║  - Backend API (FastAPI)    →  http://localhost:8000         ║${NC}"
echo -e "${BOLD}${GREEN}║  - Swagger API Docs         →  http://localhost:8000/docs    ║${NC}"
echo -e "${BOLD}${GREEN}║  - Standalone WebSocket     →  ws://127.0.0.1:8765           ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${YELLOW}👉 Open http://localhost:5173 in your browser for the GCS Operator Cockpit.${NC}"
echo -e "  ${YELLOW}Press Ctrl+C to shut down all services.${NC}"
echo ""

# Trap Ctrl+C and clean up all spawned processes
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down all Cyclone Digital Twin services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    [ -n "${INFERENCE_PID:-}" ] && kill $INFERENCE_PID 2>/dev/null || true
    pkill -9 -f "uvicorn.*backend.main:app" 2>/dev/null || true
    pkill -9 -f "backend/inference.py" 2>/dev/null || true
    pkill -9 -f "vite" 2>/dev/null || true
    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
    fuser -k 8765/tcp 2>/dev/null || true
    echo -e "${GREEN}All services stopped cleanly. Goodbye.${NC}"
    exit 0
}
trap cleanup INT TERM

# Monitor services by checking listening ports and inference process
while true; do
    if [ -n "${INFERENCE_PID:-}" ] && ! kill -0 "$INFERENCE_PID" 2>/dev/null; then
        echo -e "\n${RED}✗ Inference Engine stopped unexpectedly (PID $INFERENCE_PID).${NC}"
        cleanup
    fi
    if ! ss -tlnp 2>/dev/null | grep -q ':8000' && ! lsof -ti :8000 >/dev/null 2>&1; then
        echo -e "\n${RED}✗ Backend API server stopped unexpectedly.${NC}"
        cleanup
    fi
    if ! ss -tlnp 2>/dev/null | grep -q ':5173' && ! lsof -ti :5173 >/dev/null 2>&1; then
        echo -e "\n${RED}✗ Frontend GCS console stopped unexpectedly.${NC}"
        cleanup
    fi
    sleep 3
done

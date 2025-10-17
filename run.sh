#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -U pip
pip install -r backend/requirements.txt

echo "Backend ready. Launching FastAPI on http://0.0.0.0:8000"
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

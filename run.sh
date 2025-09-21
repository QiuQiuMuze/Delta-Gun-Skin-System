#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# 1) 安装依赖
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r backend/requirements.txt

# 2) 运行网站（同域提供 API + 前端）
cd backend
uvicorn server_web:app --reload --host 0.0.0.0 --port 8000

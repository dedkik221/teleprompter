#!/bin/bash
set -euo pipefail

# Configure these for your server
SERVER="${DEPLOY_HOST:-root@your-server-ip}"
REMOTE_PATH="${DEPLOY_PATH:-/opt/teleprompter}"
PORT="${DEPLOY_PORT:-8800}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_PATH="$(dirname "$SCRIPT_DIR")"

echo "Deploying teleprompter from $LOCAL_PATH to $SERVER:$REMOTE_PATH ..."

rsync -avz \
    --exclude='venv/' \
    --exclude='__pycache__/' \
    --exclude='.git/' \
    --exclude='data/' \
    --exclude='.env' \
    --exclude='.DS_Store' \
    --exclude='*.pyc' \
    "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/"

ssh "$SERVER" "cd $REMOTE_PATH && venv/bin/pip install -q -r requirements.txt"
ssh "$SERVER" "systemctl restart teleprompter"

echo "Done. http://${SERVER#*@}:$PORT"

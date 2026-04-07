#!/usr/bin/env bash

set -euo pipefail

ensure-workspace.sh

cd /workspace

export CHOKIDAR_USEPOLLING="${CHOKIDAR_USEPOLLING:-true}"
export WATCHPACK_POLLING="${WATCHPACK_POLLING:-true}"
export VUE_APP_URL_BASE_API="${VUE_APP_URL_BASE_API:-http://localhost:5678/}"

exec pnpm --filter n8n-editor-ui dev

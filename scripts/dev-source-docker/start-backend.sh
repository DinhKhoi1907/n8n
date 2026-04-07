#!/usr/bin/env bash

set -euo pipefail

ensure-workspace.sh

cd /workspace

if [[ ! -f packages/@n8n/backend-common/dist/license-state.js || ! -f packages/cli/dist/config/index.js ]]; then
	echo "Missing backend dist files. Rebuilding runtime artifacts first..."
	rebuild-backend.sh
elif [[ "${N8N_AUTO_REBUILD_BACKEND:-false}" == "true" ]]; then
	echo "N8N_AUTO_REBUILD_BACKEND=true, rebuilding runtime artifacts..."
	rebuild-backend.sh
fi

export N8N_DEV_LICENSE_OVERRIDE="${N8N_DEV_LICENSE_OVERRIDE:-true}"
export N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-0.0.0.0}"
export N8N_HOST="${N8N_HOST:-localhost}"

exec pnpm --filter n8n start

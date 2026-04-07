#!/usr/bin/env bash

set -euo pipefail

cd /workspace

pnpm config set store-dir "${PNPM_STORE_DIR:-/pnpm/store}" >/dev/null

if [[ "${N8N_FORCE_PNPM_INSTALL:-false}" == "true" || ! -f node_modules/.modules.yaml ]]; then
	echo "Installing workspace dependencies with pnpm..."
	pnpm install --frozen-lockfile --prefer-offline
fi

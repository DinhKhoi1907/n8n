#!/usr/bin/env bash

set -euo pipefail

ensure-workspace.sh

cd /workspace

echo "Building @n8n/backend-common..."
pushd packages/@n8n/backend-common >/dev/null
pnpm build
popd >/dev/null

echo "Building packages/cli runtime files..."
pushd packages/cli >/dev/null
pnpm exec tsc -p tsconfig.build.json
pnpm exec tsc-alias -p tsconfig.build.json
pnpm run build:data
popd >/dev/null

echo "Backend runtime artifacts are ready."

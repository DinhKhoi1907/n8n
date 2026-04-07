#!/usr/bin/env bash

set -euo pipefail

if [[ ! -f /workspace/package.json ]]; then
	echo "Expected the repository to be mounted at /workspace, but package.json was not found." >&2
	echo "Run this container through docker-compose.dev-source.yml or mount the repo manually." >&2
	exit 1
fi

exec "$@"

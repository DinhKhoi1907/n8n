# Source Dev Docker

This folder contains an isolated Docker workflow for running n8n from source without modifying the existing production Docker files in this repository.

## What It Provides

- A reusable dev image with Node.js, pnpm, build tooling, and helper scripts
- A backend container that starts n8n with `N8N_DEV_LICENSE_OVERRIDE=true`
- An optional frontend container for the editor UI on port `8080`
- Shared pnpm cache and workspace `node_modules` volumes for faster restarts

## Quick Start

Backend only:

```bash
docker compose -f docker-compose.dev-source.yml up --build n8n-source
```

Backend + editor UI:

```bash
docker compose -f docker-compose.dev-source.yml --profile ui up --build
```

Shortcut script:

```bash
./scripts/dev-source-docker/up.sh
```

## URLs

- Backend and main editor: `http://localhost:5678`
- Editor UI dev server: `http://localhost:8080`

## Rebuild Flow

If backend source changed and you want fresh runtime artifacts:

```bash
docker compose -f docker-compose.dev-source.yml exec n8n-source rebuild-backend.sh
docker compose -f docker-compose.dev-source.yml restart n8n-source
```

If you want the backend container to rebuild automatically on startup:

```bash
N8N_AUTO_REBUILD_BACKEND=true docker compose -f docker-compose.dev-source.yml up --build n8n-source
```

## Notes

- The backend startup script only rebuilds runtime files when `dist` is missing, or when `N8N_AUTO_REBUILD_BACKEND=true`.
- This keeps normal startup fast while still allowing source changes plus rebuilds inside the container.
- The current repository may still hit unrelated TypeScript build issues during full CLI builds. This workflow intentionally rebuilds only the runtime pieces needed for local startup.

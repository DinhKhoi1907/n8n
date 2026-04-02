# Architecture Map — n8n Monorepo

> Generated: 2026-04-02  
> Branch: master  
> Evidence: static analysis of source code

---

## 1. Tổng quan cấu trúc repo

n8n là một nền tảng workflow automation theo kiến trúc **monorepo** (pnpm workspaces + Turborepo), gồm backend Node.js, frontend Vue 3, và engine thực thi workflow.

```
/Applications/n8n/n8n/
├── packages/                    # Root-level packages (không scoped)
│   ├── cli/                     # Backend server chính (Express + CLI)
│   ├── core/                    # Workflow execution engine
│   ├── extensions/              # Extension system
│   ├── frontend/                # Vue 3 editor UI
│   ├── node-dev/                # CLI tool để develop nodes
│   ├── nodes-base/              # Built-in integration nodes (~500 nodes)
│   ├── testing/                 # Playwright E2E + test utilities
│   └── workflow/                # Core workflow types + graph traversal
│
└── packages/@n8n/               # Scoped packages (~47 packages)
    ├── api-types/               # Shared FE/BE TypeScript interfaces
    ├── backend-common/          # Shared backend utilities (LicenseState)
    ├── cli/                     # [beta] Client CLI for workflows
    ├── config/                  # Centralized config management
    ├── constants/               # Shared constants (LICENSE_FEATURES, LICENSE_QUOTAS)
    ├── db/                      # Database abstractions (TypeORM repositories)
    ├── decorators/              # @Service, @Controller, @Licensed decorators
    ├── design-system/           # Vue component library
    ├── di/                      # Dependency injection container
    ├── i18n/                    # Internationalization for UI
    ├── nodes-langchain/         # AI/LangChain nodes
    ├── permissions/             # RBAC/permissions system
    └── ... (32 other packages)
```

---

## 2. Entrypoints chính

### Backend

| File | Mục đích |
|------|----------|
| `packages/cli/src/commands/start.ts` | CLI command `n8n start` — khởi động toàn bộ hệ thống |
| `packages/cli/src/server.ts` | Express server bootstrap, load tất cả modules/controllers |
| `packages/cli/src/license.ts` | Khởi tạo LicenseManager, kết nối license SDK |

**Luồng khởi động backend:**
```
n8n start (CLI)
  └─> Start.run()                         [packages/cli/src/commands/start.ts]
        ├─> Server.start()                [packages/cli/src/server.ts]
        │     ├─> License.init()          [packages/cli/src/license.ts]
        │     ├─> PostHogClient.init()    [packages/cli/src/posthog/index.ts]
        │     ├─> LoadNodesAndCredentials
        │     ├─> ActiveWorkflowManager
        │     └─> Register all .ee modules (97 enterprise files)
        └─> Open browser (optional -o flag)
```

### Frontend

| File | Mục đích |
|------|----------|
| `packages/frontend/editor-ui/src/main.ts` | Vue app bootstrap, đăng ký plugins |
| `packages/frontend/editor-ui/src/app/init.ts` | Load settings, user, SSO, feature flags |

**Luồng khởi động frontend:**
```
main.ts
  └─> initializeCore()                [packages/frontend/editor-ui/src/app/init.ts]
        ├─> SettingsStore.load()      # Fetch /api/v1/settings (includes feature flags)
        ├─> UsersStore.init()
        ├─> PostHog.init(flags)       [packages/frontend/editor-ui/src/app/stores/posthog.store.ts]
        └─> initializeAuthenticatedFeatures()
```

---

## 3. Các package liên quan đến enterprise / license / gating

| Package / File | Role |
|----------------|------|
| `packages/@n8n/constants/src/index.ts` | Định nghĩa `LICENSE_FEATURES` và `LICENSE_QUOTAS` |
| `packages/@n8n/config/src/configs/license.config.ts` | Config: server URL, auto-renewal, tenant ID |
| `packages/@n8n/backend-common/src/license-state.ts` | `LicenseState` — API truy vấn trạng thái feature |
| `packages/@n8n/decorators/src/controller/licensed.ts` | `@Licensed()` decorator cho API endpoints |
| `packages/@n8n/db/src/repositories/license-metrics.repository.ts` | Lưu license metrics vào DB |
| `packages/cli/src/license.ts` | Khởi tạo `LicenseManager` từ `@n8n_io/license-sdk` |
| `packages/cli/src/license/license.service.ts` | Activation, renewal, registration |
| `packages/cli/src/license/license.controller.ts` | REST endpoints cho license operations |
| `packages/cli/src/posthog/index.ts` | Remote feature flag evaluation qua PostHog |
| `packages/cli/src/controllers/posthog.controller.ts` | HTTP proxy `/ph/` → PostHog API |
| `packages/frontend/editor-ui/src/app/constants/enterprise.ts` | `EnterpriseEditionFeature` enum |
| `packages/frontend/editor-ui/src/app/utils/rbac/middleware/enterprise.ts` | Enterprise route middleware |
| `packages/frontend/editor-ui/src/app/stores/posthog.store.ts` | Client-side feature flag store |

---

## 4. Convention `.ee.ts` — Enterprise Edition modules

n8n tổ chức tính năng enterprise theo convention **suffix `.ee.ts`** và **suffix `.ee/` cho directories**. Có khoảng 97 file `.ee.ts` trong repo.

**Các module enterprise chính:**

| Module | Path | Tính năng |
|--------|------|-----------|
| External Secrets | `packages/cli/src/modules/external-secrets.ee/` | Quản lý secret từ vault bên ngoài |
| LDAP | `packages/cli/src/modules/ldap.ee/` | LDAP authentication |
| Log Streaming | `packages/cli/src/modules/log-streaming.ee/` | Stream logs ra external destinations |
| Source Control | `packages/cli/src/modules/source-control.ee/` | Git integration cho workflows |
| SSO SAML | `packages/cli/src/modules/sso-saml/` | SAML-based single sign-on |
| SSO OIDC | `packages/cli/src/modules/sso-oidc/` | OIDC-based single sign-on |
| Provisioning | `packages/cli/src/modules/provisioning.ee/` | SCIM provisioning |
| Evaluation | `packages/cli/src/evaluation.ee/` | Test/evaluation framework |
| Multi-main | `packages/cli/src/scaling/multi-main-setup.ee.ts` | Multi-instance scaling |
| Dynamic Credentials | `packages/cli/src/modules/dynamic-credentials.ee/` | Dynamic credential resolution |
| Workflow EE | `packages/cli/src/workflows/workflow.service.ee.ts` | Enterprise workflow features |

---

## 5. Kiến trúc phân tầng (dependency graph)

```
frontend/editor-ui
  ├── @n8n/design-system          (UI components)
  ├── @n8n/i18n                   (translations)
  ├── @n8n/api-types              (shared interfaces)
  └── posthog.store → PostHog API (remote feature flags)

packages/cli (Express server)
  ├── packages/core               (execution engine)
  ├── packages/workflow           (workflow types + traversal)
  ├── packages/nodes-base         (built-in nodes)
  ├── @n8n/db                     (database layer)
  ├── @n8n/config                 (configuration)
  ├── @n8n/backend-common         (LicenseState, shared utilities)
  ├── @n8n/decorators             (@Licensed decorator)
  ├── @n8n/permissions            (RBAC)
  └── @n8n_io/license-sdk         (EXTERNAL — private npm package)
```

---

## 6. Database schema liên quan

n8n dùng TypeORM với SQLite (dev) / PostgreSQL (production).

Các bảng liên quan đến licensing và gating:
- `settings` — lưu license certificate (`SETTINGS_LICENSE_CERT_KEY`)
- `license_metrics` — lưu usage metrics (trigger count, user count, v.v.)
- `variables` — lưu n8n Variables (feature bị gate)
- `project` — lưu Team Projects (feature bị gate)
- `workflow_history` — Workflow history (pruning limit bị gate)

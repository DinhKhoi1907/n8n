# Feature Gating Map — n8n

> Generated: 2026-04-02  
> Source: `packages/@n8n/constants/src/index.ts`, `packages/@n8n/backend-common/src/license-state.ts`, `packages/frontend/editor-ui/src/app/constants/enterprise.ts`

---

## 1. Cơ chế gating — tổng quan

n8n dùng **hai hệ thống gating song song**:

| Hệ thống | Mục đích | Đánh giá ở đâu |
|----------|----------|----------------|
| **License entitlements** | Gate tính năng enterprise theo plan | Backend (LicenseState), Frontend (enterpriseStore) |
| **PostHog feature flags** | A/B testing, rollout tính năng mới | Remote PostHog API (cached 10 phút) |

---

## 2. LICENSE_FEATURES — Boolean feature gates

Định nghĩa tại: `packages/@n8n/constants/src/index.ts`

### Cách hoạt động

1. **Backend:** `LicenseState.isFeatureEnabled(feature)` → kiểm tra entitlement trong certificate
2. **API Decorator:** `@Licensed(feature)` trên controller method → trả 403 nếu không có entitlement
3. **Frontend:** `settingsStore.isEnterpriseFeatureEnabled(feature)` → settings API trả về danh sách feature được enable

### Danh sách đầy đủ LICENSE_FEATURES

| Feature Key | Tính năng | Loại |
|-------------|-----------|------|
| `SHARING` | Credential/Workflow sharing | Enterprise |
| `LDAP` | LDAP authentication | Enterprise |
| `SAML` | SAML SSO | Enterprise |
| `OIDC` | OIDC SSO | Enterprise |
| `MFA_ENFORCEMENT` | Bắt buộc MFA cho toàn tổ chức | Enterprise |
| `LOG_STREAMING` | Stream logs ra external services | Enterprise |
| `ADVANCED_EXECUTION_FILTERS` | Filter execution history nâng cao | Enterprise |
| `VARIABLES` | n8n Variables global | Enterprise |
| `SOURCE_CONTROL` | Git integration (push/pull workflows) | Enterprise |
| `API_DISABLED` | Disable public API | Enterprise |
| `EXTERNAL_SECRETS` | External secrets vault integration | Enterprise |
| `SHOW_NON_PROD_BANNER` | Hiện banner môi trường non-prod | Enterprise |
| `DEBUG_IN_EDITOR` | Debug workflow trong editor | Enterprise |
| `BINARY_DATA_S3` | Lưu binary data trên S3 | Enterprise |
| `MULTIPLE_MAIN_INSTANCES` | Multi-main instance scaling | Enterprise |
| `WORKER_VIEW` | Xem worker queue trong UI | Enterprise |
| `ADVANCED_PERMISSIONS` | RBAC nâng cao | Enterprise |
| `PROJECT_ROLE_ADMIN` | Admin role trong project | Enterprise |
| `PROJECT_ROLE_EDITOR` | Editor role trong project | Enterprise |
| `PROJECT_ROLE_VIEWER` | Viewer role trong project | Enterprise |
| `AI_ASSISTANT` | AI assistant tích hợp (n8n cloud) | Cloud |
| `ASK_AI` | "Ask AI" trong code editor | Enterprise |
| `COMMUNITY_NODES_CUSTOM_REGISTRY` | Custom npm registry cho community nodes | Enterprise |
| `AI_CREDITS` | AI credits system | Cloud |
| `FOLDERS` | Workflow folders/organization | Enterprise |
| `INSIGHTS_VIEW` | Analytics dashboard | Enterprise |
| `INSIGHTS_SUMMARY` | Insights summary tiles | Enterprise |
| `API_KEY_SCOPES` | Scoped API keys | Enterprise |
| `WORKFLOW_DIFFS` | Workflow version diffs | Enterprise |
| `NAMED_VERSIONS` | Named workflow versions | Enterprise |
| `CUSTOM_ROLES` | Custom RBAC roles | Enterprise |
| `AI_BUILDER` | AI workflow builder | Enterprise |
| `DYNAMIC_CREDENTIALS` | Dynamic credential resolution | Enterprise |
| `PERSONAL_SPACE_POLICY` | Personal space access policy | Enterprise |
| `TOKEN_EXCHANGE` | Token exchange for credentials | Enterprise |

---

## 3. LICENSE_QUOTAS — Numeric limits

| Quota Key | Giới hạn gì | Default (community) |
|-----------|-------------|---------------------|
| `TRIGGER_LIMIT` | Số active trigger tối đa | -1 (unlimited) |
| `VARIABLES_LIMIT` | Số Variables tối đa | -1 (unlimited) |
| `USERS_LIMIT` | Số users tối đa | -1 (unlimited) |
| `WORKFLOW_HISTORY_PRUNE_LIMIT` | Số ngày giữ workflow history | -1 |
| `TEAM_PROJECT_LIMIT` | Số Team Projects tối đa | 0 |
| `AI_CREDITS` | AI credits số lượng | 0 |
| `INSIGHTS_MAX_HISTORY_DAYS` | Số ngày history trong insights | 0 |
| `INSIGHTS_RETENTION_MAX` | Retention tối đa | 0 |
| `INSIGHTS_RETENTION_LICENSE` | Retention theo license | 0 |
| `WORKFLOWS_WITH_EVALUATION_LIMIT` | Số workflow với evaluation | -1 |

---

## 4. Cơ chế enforcement

### Backend — `@Licensed()` decorator

```typescript
// packages/@n8n/decorators/src/controller/licensed.ts
@Licensed(LICENSE_FEATURES.SOURCE_CONTROL)
async enableSourceControl() { ... }
```

Khi request đến endpoint này mà instance không có entitlement `SOURCE_CONTROL`, framework trả **HTTP 403**.

### Backend — `LicenseState` API

```typescript
// packages/@n8n/backend-common/src/license-state.ts
class LicenseState {
  isFeatureEnabled(feature: BooleanLicenseFeature): boolean
  getFeatureValue<T>(feature: NumericLicenseFeature): T
  isSharingEnabled(): boolean
  isLogStreamingEnabled(): boolean
  // ... convenience methods
}
```

Được inject qua DI container vào bất kỳ service nào cần kiểm tra entitlement.

### Frontend — Enterprise middleware

```typescript
// packages/frontend/editor-ui/src/app/utils/rbac/middleware/enterprise.ts
// Kiểm tra EnterpriseEditionFeature trước khi render route
```

`EnterpriseEditionFeature` enum tại: `packages/frontend/editor-ui/src/app/constants/enterprise.ts`

---

## 5. PostHog Feature Flags — Rollout gates

### Cơ chế

- **Backend:** `PostHogClient.getFeatureFlags(user)` → gọi PostHog API với `distinctId = ${instanceId}#${userId}`
- **Cache:** TTL 10 phút per user
- **Frontend:** `posthogStore.isFeatureEnabled(experiment)` → check flags đã được init
- **Override (local testing):** `localStorage['LOCAL_STORAGE_EXPERIMENT_OVERRIDES']` hoặc `window.featureFlags.override(name, value)`

### Mục đích

PostHog flags dùng để rollout dần (gradual rollout) các tính năng **mới** — không phải enforcement entitlement. Nếu PostHog không khả dụng, flags mặc định là `false` (conservative fallback).

---

## 6. Settings API — Bridge FE/BE

Frontend nhận thông tin về enabled features qua `GET /api/v1/settings`. Response bao gồm:

```json
{
  "enterprise": {
    "sharing": true/false,
    "ldap": true/false,
    "saml": true/false,
    ...
  },
  "featureFlags": { ... }  // PostHog flags
}
```

File tham chiếu: `packages/@n8n/api-types/src/` (shared types cho settings response)

---

## 7. Certificate-based entitlement flow

```
License Certificate (JWT/signed blob)
  │
  ├─ Stored in: DB table 'settings' (key: SETTINGS_LICENSE_CERT_KEY)
  │              OR env var N8N_LICENSE_CERT
  │
  └─ Parsed by: @n8n_io/license-sdk (private npm package)
                  │
                  ├─ getEntitlements() → list of enabled features
                  ├─ getFeatureValue(feature) → numeric quotas
                  └─ isExpired() → certificate validity
```

Certificate được **ký bởi n8n license server** (`https://license.n8n.io/v1`) bằng private key. Không thể tạo hoặc sửa certificate hợp lệ mà không có private key của n8n.

---

## 8. Tóm tắt: Community vs Enterprise

| Tính năng | Community | Starter | Pro | Enterprise |
|-----------|-----------|---------|-----|------------|
| Core workflow execution | ✅ | ✅ | ✅ | ✅ |
| Community nodes | ✅ | ✅ | ✅ | ✅ |
| REST API | ✅ | ✅ | ✅ | ✅ |
| Variables | ❌ | ✅ | ✅ | ✅ |
| Credential sharing | ❌ | ✅ | ✅ | ✅ |
| Folders | ❌ | ✅ | ✅ | ✅ |
| Workflow history | ❌ | Limited | ✅ | ✅ |
| Team Projects | ❌ | ❌ | Limited | ✅ |
| SSO (SAML/LDAP/OIDC) | ❌ | ❌ | ❌ | ✅ |
| Source Control (Git) | ❌ | ❌ | ❌ | ✅ |
| External Secrets | ❌ | ❌ | ❌ | ✅ |
| Log Streaming | ❌ | ❌ | ❌ | ✅ |
| Multi-main scaling | ❌ | ❌ | ❌ | ✅ |
| Advanced Permissions | ❌ | ❌ | ❌ | ✅ |
| Custom Roles | ❌ | ❌ | ❌ | ✅ |

> **Lưu ý:** Bảng trên dựa trên phân tích code. Tham khảo trang pricing n8n.io để biết thông tin chính xác và cập nhật.

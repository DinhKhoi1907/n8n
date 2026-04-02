# Enterprise License Mechanism — Chi tiết cơ chế hoạt động

> **Mục đích:** Giải thích cách n8n quản lý, xác thực và enforce các tính năng Enterprise  
> xuyên suốt backend, frontend và hạ tầng license server.

---

## 1. Kiến trúc tổng thể

```
┌──────────────────────────────────────────────────────────┐
│                    License Server                        │
│               https://license.n8n.io/v1                  │
│     (xác thực activation key → trả về signed cert)       │
└────────────────────────┬─────────────────────────────────┘
                         │  signed certificate
                         ▼
┌──────────────────────────────────────────────────────────┐
│                @n8n_io/license-sdk (v2.25.0)             │
│   (private npm package, chứa public key để verify cert)  │
└────────────────────────┬─────────────────────────────────┘
                         │
            ┌────────────┴─────────────┐
            ▼                          ▼
     ┌─────────────┐          ┌──────────────────┐
     │   License    │          │   LicenseState   │
     │  (service)   │          │  (query helper)  │
     └──────┬──────┘          └────────┬─────────┘
            │                          │
            ▼                          ▼
     ┌──────────────┐         ┌───────────────────┐
     │  @Licensed() │         │  FrontendService  │
     │  decorator   │         │  GET /settings    │
     │ (middleware)  │         │  → enterprise.*   │
     └──────┬──────┘          └───────┬───────────┘
            │                         │
            ▼                         ▼
       Backend API               Frontend UI
       (403 Forbidden            (ẩn/hiện feature,
        nếu chưa có              hiện upgrade modal)
        license)
```

---

## 2. Luồng kích hoạt License

```
User nhập Activation Key
        │
        ▼
License.activate(activationKey)
        │
        ├── Gọi @n8n_io/license-sdk
        │       │
        │       ├── Gửi HTTP request tới license.n8n.io/v1
        │       │       │
        │       │       └── Server xác thực key
        │       │               │
        │       │               ▼
        │       │       Trả về Signed Certificate
        │       │       (chứa: entitlements, quotas,
        │       │        expiry date, signature)
        │       │
        │       └── SDK verify signature bằng public key nội bộ
        │
        ├── Lưu certificate vào DB
        │       (bảng `settings`, key = 'license.cert')
        │
        └── Kích hoạt auto-renewal timer
```

### Lưu trữ Certificate

| Nơi lưu | Cách cấu hình | Đặc điểm |
|----------|---------------|-----------|
| Database | Tự động (bảng `settings`, key `license.cert`) | Persistent, dùng cho self-hosted thông thường |
| Environment variable | `N8N_LICENSE_CERT=<blob>` | Ephemeral, ưu tiên hơn DB, phù hợp container |

### Auto-Renewal

- Mặc định bật (`N8N_LICENSE_AUTO_RENEW_ENABLED=true`)
- SDK tự gọi license server ~72 giờ trước khi cert hết hạn
- Nếu server không liên lạc được → dùng cert cached cho đến khi hết hạn
- Khi cert hết hạn → **tất cả feature enterprise tắt ngay lập tức**

---

## 3. Các file chính

| File | Vai trò |
|------|---------|
| `packages/cli/src/license.ts` | Service chính, wrapper quanh LicenseManager SDK |
| `packages/@n8n/backend-common/src/license-state.ts` | Query helper — `isCustomRolesLicensed()`, `isSamlLicensed()`, ... |
| `packages/@n8n/backend-common/src/types.ts` | Interface `LicenseProvider` |
| `packages/@n8n/decorators/src/controller/licensed.ts` | Decorator `@Licensed()` |
| `packages/cli/src/controller.registry.ts` | Inject license middleware vào route |
| `packages/cli/src/services/frontend.service.ts` | Build `settings.enterprise.*` cho frontend |
| `packages/@n8n/constants/src/index.ts` | Hằng số `LICENSE_FEATURES` và `LICENSE_QUOTAS` |
| `packages/@n8n/config/src/configs/license.config.ts` | Schema cấu hình license |
| `packages/cli/src/errors/feature-not-licensed.error.ts` | Error class `FeatureNotLicensedError` |
| `packages/cli/src/license/license.controller.ts` | REST endpoints: activate, renew, request trial |

---

## 4. Backend Enforcement — `@Licensed()` Decorator

### 4.1 Định nghĩa

**File:** `packages/@n8n/decorators/src/controller/licensed.ts`

```typescript
export const Licensed =
  (licenseFeature: BooleanLicenseFeature): MethodDecorator =>
  (target, handlerName) => {
    const routeMetadata = Container.get(ControllerRegistryMetadata)
      .getRouteMetadata(target.constructor as Controller, String(handlerName));
    routeMetadata.licenseFeature = licenseFeature;
  };
```

Decorator chỉ **gắn metadata** vào route. Việc kiểm tra thực tế do middleware xử lý.

### 4.2 Middleware tự động inject

**File:** `packages/cli/src/controller.registry.ts`

```typescript
private createLicenseMiddleware(feature: BooleanLicenseFeature): RequestHandler {
  return (_req, res, next) => {
    if (!this.license.isLicensed(feature)) {
      res.status(403).json({
        status: 'error',
        message: 'Plan lacks license for this feature',
      });
      return;
    }
    next();
  };
}
```

### 4.3 Thứ tự Middleware Chain

```
Request
  │
  ├── 1. Rate Limiting (IP-based)
  ├── 2. Rate Limiting (body-based, nếu có)
  ├── 3. Authentication (auth middleware + LastActiveAt)
  ├── 4. Rate Limiting (user-based, nếu có)
  ├── 5. ★ License Check ★  ← @Licensed() kiểm tra ở đây
  ├── 6. Access Scope Check  ← @GlobalScope() / @ProjectScope()
  ├── 7. Controller Middlewares
  └── 8. Route Handler
```

License check xảy ra **sau authentication** (cần biết user hợp lệ) nhưng **trước permission check** (không cần kiểm tra quyền nếu feature chưa được license).

### 4.4 Ví dụ sử dụng

```typescript
@RestController('/roles')
class RoleController {
  // Không cần license — ai cũng xem được
  @Get('/')
  getAllRoles() { ... }

  // Cần license + quyền role:manage
  @Post('/')
  @GlobalScope('role:manage')
  @Licensed(LICENSE_FEATURES.CUSTOM_ROLES)  // ← 'feat:customRoles'
  createRole() { ... }
}
```

---

## 5. Frontend Detection — `settings.enterprise.*`

### 5.1 Server build object

**File:** `packages/cli/src/services/frontend.service.ts`

Khi frontend gọi `GET /api/v1/settings`, server lặp qua từng feature và gọi `license.isLicensed()`:

```typescript
Object.assign(this.settings.enterprise, {
  sharing:              this.license.isSharingEnabled(),
  ldap:                 this.license.isLdapEnabled(),
  saml:                 this.license.isSamlEnabled(),
  oidc:                 this.licenseState.isOidcLicensed(),
  variables:            this.license.isVariablesEnabled(),
  sourceControl:        this.license.isSourceControlLicensed(),
  externalSecrets:      this.license.isExternalSecretsEnabled(),
  advancedPermissions:  this.license.isAdvancedPermissionsLicensed(),
  customRoles:          this.licenseState.isCustomRolesLicensed(),
  debugInEditor:        this.license.isDebugInEditorLicensed(),
  workerView:           this.license.isWorkerViewLicensed(),
  workflowDiffs:        this.licenseState.isWorkflowDiffsLicensed(),
  namedVersions:        this.license.isLicensed(LICENSE_FEATURES.NAMED_VERSIONS),
  // ... ~25 feature flags khác
});
```

### 5.2 Response mẫu

```json
{
  "enterprise": {
    "sharing": true,
    "ldap": false,
    "saml": true,
    "customRoles": false,
    "variables": true,
    "sourceControl": true,
    "advancedPermissions": true
  },
  "license": {
    "consumerId": "abc-123-def",
    "planName": "Enterprise"
  }
}
```

### 5.3 Frontend sử dụng

```typescript
// Settings store
const isCustomRolesFeatureEnabled = computed(
  () => settings.value.enterprise?.customRoles ?? false,
);

// Trong component
if (!settingsStore.isCustomRolesFeatureEnabled) {
  upgradeModalVisible.value = true;  // Hiện modal "Upgrade to Enterprise"
  return;
}
// ... cho phép thao tác
```

> **Lưu ý:** Frontend chỉ **phản ánh** trạng thái license, không thể bypass.
> Nếu ai đó hack frontend để bỏ qua check → backend vẫn trả `403`.

---

## 6. Danh sách tính năng Enterprise

### 6.1 Feature Flags (Boolean)

**File:** `packages/@n8n/constants/src/index.ts`

| Nhóm | Feature Key | Mô tả |
|------|------------|-------|
| **Auth** | `feat:ldap` | Đăng nhập qua LDAP |
| | `feat:saml` | Single Sign-On qua SAML |
| | `feat:oidc` | OpenID Connect |
| | `feat:mfaEnforcement` | Bắt buộc MFA cho tất cả user |
| **Access Control** | `feat:customRoles` | Tạo role tuỳ chỉnh cho project |
| | `feat:advancedPermissions` | Hệ thống quyền nâng cao |
| | `feat:apiKeyScopes` | API key với scope giới hạn |
| | `feat:personalSpacePolicy` | Chính sách không gian cá nhân |
| **Workflow** | `feat:sharing` | Chia sẻ workflow/credential |
| | `feat:sourceControl` | Git-based source control |
| | `feat:variables` | Biến môi trường |
| | `feat:debugInEditor` | Debug workflow trong editor |
| | `feat:workflowDiffs` | So sánh phiên bản workflow |
| | `feat:namedVersions` | Đặt tên cho phiên bản workflow |
| **Project** | `feat:projectRole:admin` | Role admin trong project |
| | `feat:projectRole:editor` | Role editor trong project |
| | `feat:projectRole:viewer` | Role viewer trong project |
| | `feat:folders` | Tổ chức workflow theo folder |
| **AI** | `feat:aiAssistant` | Trợ lý AI |
| | `feat:askAi` | Hỏi AI trong editor |
| | `feat:aiBuilder` | AI Builder |
| | `feat:aiCredits` | Hạn mức credit AI |
| **Infrastructure** | `feat:binaryDataS3` | Lưu binary data trên S3 |
| | `feat:multipleMainInstances` | Chạy nhiều main instance |
| | `feat:workerView` | Xem trạng thái workers |
| **Monitoring** | `feat:logStreaming` | Stream log ra ngoài |
| | `feat:advancedExecutionFilters` | Bộ lọc execution nâng cao |
| | `feat:insights:viewSummary` | Xem tóm tắt insights |
| | `feat:insights:viewDashboard` | Dashboard insights |
| | `feat:insights:viewHourlyData` | Dữ liệu insights theo giờ |
| **Security** | `feat:externalSecrets` | Tích hợp secret manager |
| | `feat:dynamicCredentials` | Credential động |
| | `feat:tokenExchange` | Token exchange |
| | `feat:apiDisabled` | Tắt public API |
| **Other** | `feat:showNonProdBanner` | Hiện banner non-production |
| | `feat:communityNodes:customRegistry` | Registry tuỳ chỉnh cho community nodes |

### 6.2 Quotas (Giới hạn số lượng)

| Quota Key | Mô tả | Unlimited = |
|-----------|--------|-------------|
| `quota:activeWorkflows` | Số workflow active tối đa | `-1` |
| `quota:maxVariables` | Số biến tối đa | `-1` |
| `quota:users` | Số user tối đa | `-1` |
| `quota:maxTeamProjects` | Số team project tối đa | `-1` |
| `quota:aiCredits` | Hạn mức AI credits | `-1` |
| `quota:workflowHistoryPrune` | Giới hạn prune lịch sử | `-1` |
| `quota:insights:maxHistoryDays` | Số ngày lưu insights | `-1` |
| `quota:insights:retention:maxAgeDays` | Thời gian giữ insights | `-1` |
| `quota:evaluations:maxWorkflows` | Số workflow có evaluation | `-1` |

---

## 7. Error Handling

### 7.1 FeatureNotLicensedError

**File:** `packages/cli/src/errors/feature-not-licensed.error.ts`

```typescript
export class FeatureNotLicensedError extends UserError {
  constructor(feature: (typeof LICENSE_FEATURES)[keyof typeof LICENSE_FEATURES]) {
    super(
      `Your license does not allow for ${feature}. ` +
      `To enable ${feature}, please upgrade to a license that supports this feature.`,
      { level: 'warning' },
    );
  }
}
```

### 7.2 Các response lỗi

| Tình huống | HTTP Status | Message |
|-----------|-------------|---------|
| Feature không có license | `403` | `Plan lacks license for this feature` |
| Quota vượt giới hạn | `403` | Tuỳ thuộc feature (ví dụ: `Max variables limit reached`) |
| License cert hết hạn | Tất cả enterprise endpoints → `403` | Tương tự feature không license |

---

## 8. Cấu hình qua Environment Variables

**File:** `packages/@n8n/config/src/configs/license.config.ts`

| Variable | Mặc định | Mô tả |
|----------|----------|-------|
| `N8N_LICENSE_SERVER_URL` | `https://license.n8n.io/v1` | URL license server |
| `N8N_LICENSE_AUTO_RENEW_ENABLED` | `true` | Tự động gia hạn cert |
| `N8N_LICENSE_ACTIVATION_KEY` | — | Key kích hoạt (dùng lần đầu) |
| `N8N_LICENSE_CERT` | — | Certificate (ephemeral, ưu tiên hơn DB) |
| `N8N_LICENSE_TENANT_ID` | `1` | Tenant ID cho multi-tenant |
| `N8N_LICENSE_DETACH_FLOATING_ON_SHUTDOWN` | `true` | Giải phóng floating license khi tắt |

---

## 9. Bảo mật — Tại sao không thể bypass

```
                    ┌──────────────────────────┐
                    │   Không thể giả mạo cert │
                    │   vì không có private key │
                    │   (chỉ n8n license server │
                    │    mới có)                │
                    └────────────┬─────────────┘
                                 │
        ┌────────────────────────┼───────────────────────┐
        │                        │                       │
        ▼                        ▼                       ▼
  ┌───────────┐          ┌──────────────┐        ┌────────────┐
  │ SDK verify │          │  Backend     │        │  Frontend  │
  │ signature  │          │  middleware  │        │  chỉ hiển  │
  │ bằng       │          │  enforce     │        │  thị, không│
  │ public key │          │  mọi request │        │  enforce   │
  └───────────┘          └──────────────┘        └────────────┘
```

1. **Signed certificate:** Ký bằng private key trên license server → không thể tạo cert giả
2. **Closed-source SDK:** `@n8n_io/license-sdk` là package private, chứa logic verify → không thể patch dễ dàng
3. **Server-side enforcement:** Backend check ở middleware level → hack frontend không có tác dụng
4. **No local bypass:** Không có flag hay env variable nào để bỏ qua license check

---

## 10. Khởi tạo khi App Start

```
n8n start
    │
    ├── 1. BaseCommand.initLicense()
    │       ├── new License()
    │       ├── license.init()
    │       │     ├── Tạo LicenseManager (SDK)
    │       │     ├── Load cert từ DB hoặc env
    │       │     ├── Verify cert signature
    │       │     └── Bật auto-renewal timer
    │       └── LicenseState.setLicenseProvider(license)
    │
    ├── 2. ControllerRegistry đăng ký routes
    │       └── Route có @Licensed() → inject license middleware
    │
    ├── 3. FrontendService khởi tạo
    │       └── Build settings.enterprise.* từ license state
    │
    └── 4. Sẵn sàng nhận request
            ├── API request → middleware chain kiểm tra license
            └── Frontend load /settings → nhận enterprise flags
```

### Multi-instance Sync

Trong môi trường multi-main (scaling), khi một instance reload license:

```typescript
@OnPubSubEvent('reload-license')
async reload(): Promise<void> {
  // Các instance khác nhận event qua pub/sub
  // và reload cert từ DB
}
```

---

## 11. Dependency ngoài

| Dependency | Loại | Vai trò |
|------------|------|---------|
| `@n8n_io/license-sdk` v2.25.0 | Private npm package | Parse/verify cert, quản lý entitlements, floating license |
| `https://license.n8n.io/v1` | n8n infrastructure | Xác thực activation key, phát hành cert, xử lý renewal |
| `https://enterprise.n8n.io` | n8n infrastructure | Đăng ký trial, đăng ký community edition |

> **`@n8n_io/license-sdk` là closed-source** — chứa public key của n8n, logic verify signature,
> và quản lý floating license. Đây là lớp bảo vệ cốt lõi của hệ thống licensing.

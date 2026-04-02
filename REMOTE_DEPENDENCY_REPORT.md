# Remote Dependency Report — n8n

> Generated: 2026-04-02  
> Phân loại các phụ thuộc remote liên quan đến licensing, gating, và activation

---

## 1. Remote dependencies tổng quan

n8n phụ thuộc vào **4 loại remote dependencies** cho licensing và feature gating:

| Loại | Service | Bắt buộc cho gating? | Open source? |
|------|---------|---------------------|--------------|
| License SDK | `@n8n_io/license-sdk` | **Có** | **Không** — private npm package |
| License Server | `https://license.n8n.io` | **Có** (activation/renewal) | **Không** — n8n infrastructure |
| Enterprise Portal | `https://enterprise.n8n.io` | Không (chỉ registration) | **Không** |
| PostHog | PostHog API | Không (chỉ rollout flags) | Có (self-hostable) |

---

## 2. `@n8n_io/license-sdk` — Private npm package

**Đây là dependency quan trọng nhất và không thể tự build lại.**

### Thông tin

| Thuộc tính | Giá trị |
|------------|---------|
| Package name | `@n8n_io/license-sdk` |
| Version (package.json) | `^2.25.0` |
| Source | Private npm registry của n8n (`@n8n_io` scope) |
| Source code | **Không public** |

### Vai trò

```typescript
// packages/cli/src/license.ts
import { LicenseManager } from '@n8n_io/license-sdk';

const manager = new LicenseManager({
  server: 'https://license.n8n.io/v1',
  tenantId: config.license.tenantId,
  productIdentifier: `n8n-${N8N_VERSION}`,
  onFeatureChange: async (features) => { ... },
  onLicenseRenewed: async () => { ... },
  loadCertStr: async () => { ... },    // đọc cert từ DB
  saveCertStr: async (cert) => { ... }, // lưu cert vào DB
  collectUsageMetrics: async () => { ... },
});
```

### Chức năng của SDK

- **Parse và verify** license certificate (signed JWT/blob)
- **Gọi license server** để activate, renew, deactivate
- **Extract entitlements** từ certificate đã verify
- **Manage floating entitlements** (multi-instance)
- **Verify signature** bằng public key của n8n (hardcoded trong SDK)

### Tại sao không thể thay thế

SDK chứa **public key** dùng để verify chữ ký certificate. Certificate chỉ có thể được tạo bởi license server của n8n (nắm private key). Không có SDK → không thể parse entitlements hợp lệ.

---

## 3. License Server — `https://license.n8n.io/v1`

### Endpoints được gọi (qua SDK)

| Operation | Mô tả | Khi nào |
|-----------|-------|---------|
| Activate | Kích hoạt license key → nhận certificate | Lần đầu setup |
| Renew | Gia hạn certificate trước khi hết hạn | Auto (configurable) |
| Deactivate | Giải phóng floating entitlement | Shutdown (nếu config) |
| Heartbeat | Báo cáo usage metrics | Định kỳ |

### Configuration

```
N8N_LICENSE_SERVER_URL=https://license.n8n.io/v1  (default)
N8N_LICENSE_AUTO_RENEW_ENABLED=true               (default)
N8N_LICENSE_TENANT_ID=1                           (default cho self-hosted)
N8N_LICENSE_DETACH_FLOATING_ON_SHUTDOWN=false      (default)
```

### Offline mode

Nếu license server không khả dụng:
- Certificate đã lưu trong DB vẫn hoạt động cho đến khi hết hạn
- Auto-renewal sẽ fail và log error
- Entitlements tiếp tục có hiệu lực cho đến expiry date trong certificate

### Cơ chế lưu trữ

```
DB table: settings
Key: SETTINGS_LICENSE_CERT_KEY
Value: <signed certificate blob>
```

Thay thế: Biến môi trường `N8N_LICENSE_CERT` (ephemeral, không persist qua restart).

---

## 4. Enterprise Portal — `https://enterprise.n8n.io`

### Endpoints

**1. Enterprise Trial Registration**
```
POST https://enterprise.n8n.io/enterprise-trial
Body: { firstName, lastName, email, instanceUrl }
```
File: `packages/cli/src/license/license.service.ts:60`

**2. Community Edition Registration**
```
POST https://enterprise.n8n.io/community-registered
Body: { userId, email, instanceId, instanceUrl, licenseType }
Response: { licenseKey, ... }
```
File: `packages/cli/src/license/license.service.ts:86`

### Đánh giá

- **Không bắt buộc** cho runtime gating
- Chỉ cần cho onboarding/activation flow
- Có thể bỏ qua nếu dùng license key trực tiếp

---

## 5. PostHog — Feature Flag Service

### Cấu hình

```
N8N_DIAGNOSTICS_ENABLED=true/false
N8N_POSTHOG_API_HOST=<url>
N8N_POSTHOG_API_KEY=<key>
```

File: `packages/cli/src/posthog/index.ts`

### Cách hoạt động

```
Backend:
  PostHogClient.getFeatureFlags(user)
    → posthog-node.getAllFlags(distinctId, properties, groups)
    → Cache 10 phút per {instanceId}#{userId}

Frontend:
  /ph/ endpoint (proxy)
    → http-proxy-middleware → PostHog API
```

### Đánh giá

- **Không phải enforcement** — chỉ dùng cho gradual rollout
- Nếu PostHog không khả dụng: flags mặc định `false`
- PostHog là **open source**, có thể self-host
- n8n's PostHog instance dùng API key riêng → không thể tự khai thác

---

## 6. Dependency matrix — phân loại

| Dependency | Loại | Có thể tự host? | Bắt buộc cho core? | Bắt buộc cho EE features? |
|------------|------|----------------|-------------------|--------------------------|
| `@n8n_io/license-sdk` | Private npm | Không | Không (graceful fallback) | **Có** — cần để parse entitlements |
| `license.n8n.io` | n8n infrastructure | Không | Không | **Có** — activation + renewal |
| `enterprise.n8n.io` | n8n infrastructure | Không | Không | Không (chỉ onboarding) |
| PostHog | SaaS / open source | Có | Không | Không |
| `posthog-node` | npm (open source) | N/A (SDK) | Không | Không |

---

## 7. Graceful degradation

| Tình huống | Hành vi |
|------------|---------|
| Không có license key | Chạy Community edition — core features vẫn hoạt động |
| License server down | Dùng cached certificate cho đến khi expire |
| PostHog down | Feature flags mặc định `false`, telemetry disabled |
| `N8N_DIAGNOSTICS_ENABLED=false` | PostHog hoàn toàn disabled |
| License expired | Enterprise features bị disable, core tiếp tục chạy |

---

## 8. Tóm tắt rủi ro phụ thuộc

```
Cao:    @n8n_io/license-sdk — private, không thể clone/fork
        license.n8n.io — infrastructure của n8n, không thể self-host

Thấp:   enterprise.n8n.io — chỉ dùng cho registration/onboarding
        PostHog — optional, open source, self-hostable
        posthog-node — npm public package
```

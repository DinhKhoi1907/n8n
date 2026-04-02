# Alternative Build Plan — Workflow Automation Platform

> Generated: 2026-04-02  
> Mục tiêu: Phân tích tính khả thi khi tự xây dựng các tính năng tương đương,  
> dựa trên phân tích kiến trúc n8n (open source codebase).  
>
> **Lưu ý:** Tài liệu này chỉ phân tích kỹ thuật và định hướng xây dựng độc lập.  
> Không đề xuất bất kỳ cách nào để bypass, crack, hoặc lách cơ chế licensing.

---

## 1. Phân loại tính năng theo khả năng tự xây

### Nhóm A — Có thể tự xây lại độc lập

Các tính năng này hoặc đã open source trong n8n, hoặc là vấn đề kỹ thuật phổ biến với nhiều tài liệu/thư viện sẵn có.

| Tính năng | Lý do khả thi | Thư viện / Tài nguyên |
|-----------|--------------|----------------------|
| **Core workflow engine** | Toàn bộ code trong `packages/core` + `packages/workflow` là open source (fair-code) | Code n8n, tái sử dụng trực tiếp theo license |
| **LDAP authentication** | Thư viện LDAP cho Node.js rất trưởng thành | `ldapts`, `ldapjs` |
| **SSO SAML** | Standard SAML 2.0, nhiều thư viện | `samlify`, `passport-saml`, `node-saml` |
| **SSO OIDC** | Standard OpenID Connect | `openid-client`, `passport-openid-connect` |
| **MFA enforcement** | TOTP/FIDO2 là open standards | `speakeasy`, `otpauth`, `@simplewebauthn/server` |
| **Workflow Variables** | Đơn giản là key-value store trong DB | TypeORM entity, không cần gì đặc biệt |
| **Folders / organization** | CRUD + tree structure trong DB | TypeORM với self-referential relation |
| **Credential sharing** | RBAC + ownership table | `@n8n/permissions` package (open source) |
| **Workflow history / versioning** | Event sourcing + snapshot | Có thể dùng `typeorm` + custom versioning |
| **Log streaming** | Publish events ra external sinks | `winston-transport`, webhook, Kafka client |
| **Execution filters** | Thêm filter params vào query | TypeORM QueryBuilder |
| **Worker view** | Đọc queue state từ Redis/Bull | `bullmq` UI hoặc custom dashboard |
| **API key scopes** | Standard OAuth2 scope pattern | Custom middleware |
| **PostHog feature flags** | PostHog là open source, self-hostable | `posthog-node`, self-hosted PostHog |
| **Self-hosted license system** | Implement your own JWT-based entitlement | `jsonwebtoken` + custom certificate management |

---

### Nhóm B — Có thể xây lại nhưng cần effort đáng kể

| Tính năng | Thách thức | Hướng tiếp cận |
|-----------|-----------|---------------|
| **Source Control (Git integration)** | UI phức tạp, conflict resolution, sync logic | `isomorphic-git` hoặc `nodegit` + custom sync service |
| **External Secrets Vault** | Phải support nhiều providers (AWS SM, HashiCorp, Azure KV) | Implement adapter pattern, mỗi provider 1 adapter |
| **Advanced Permissions / Custom Roles** | RBAC matrix phức tạp, cần policy engine | `casl`, `casbin`, hoặc custom policy engine |
| **Multi-main instance scaling** | Distributed coordination, leader election, lock management | Redis Redlock + Bull queue coordination |
| **SCIM Provisioning** | Standard protocol nhưng nhiều edge cases | `scim2` library, hoặc implement theo RFC 7644 |
| **Workflow Diffs** | Structural diff cho JSON graph (node positions, connections) | `deep-diff`, custom graph diffing algorithm |
| **Dynamic Credentials** | Expression evaluation at runtime với external lookups | Custom expression resolver + credential resolver |
| **Token Exchange** | OAuth2 token exchange (RFC 8693) | `node-oauth2-server` + custom exchange handler |
| **AI Builder** | AI-assisted workflow generation | Gọi Claude API / OpenAI với custom prompts |
| **Insights / Analytics** | Time-series data aggregation, retention policies | TimescaleDB hoặc ClickHouse + aggregation jobs |

---

### Nhóm C — Khó xây lại vì phụ thuộc backend/private infrastructure

| Tính năng | Lý do khó | Dependency cụ thể |
|-----------|-----------|-------------------|
| **`@n8n_io/license-sdk` integration** | SDK là private, chứa crypto keys | `@n8n_io/license-sdk` — private npm, không có source |
| **n8n Cloud AI Assistant** | Tích hợp với n8n Cloud backend riêng | Backend service riêng của n8n Cloud |
| **AI Credits system** | Billing + credit management trên n8n Cloud | n8n Cloud infrastructure |
| **n8n's PostHog experiments** | Các flags cụ thể trong n8n's PostHog project | Không access được n8n's PostHog project |
| **Enterprise portal registration** | n8n's server-side logic | `https://enterprise.n8n.io` |

---

## 2. Kiến trúc licensing có thể tự xây

Nếu bạn muốn xây platform riêng với entitlement system tương tự, đây là kiến trúc đề xuất sử dụng open source components:

### 2.1 JWT-based entitlement system

```typescript
// License certificate = signed JWT
// Payload chứa danh sách features và quotas
{
  "sub": "instance-uuid",
  "iss": "your-license-server",
  "exp": 1735689600,
  "features": ["SHARING", "LDAP", "VARIABLES"],
  "quotas": {
    "USERS_LIMIT": 50,
    "TEAM_PROJECT_LIMIT": 10
  }
}
```

**Thư viện:** `jsonwebtoken` (verify với public key)  
**Self-hosted license server:** Express app + key pair management

### 2.2 Feature flag system

**Option 1 — Self-hosted PostHog**
```bash
# PostHog là fully open source
docker-compose up posthog
```

**Option 2 — Unleash (open source feature flag platform)**
```bash
docker run unleash/unleash
```

**Option 3 — Local feature flags**
```typescript
// Config-driven, không cần remote service
const FEATURE_FLAGS = {
  NEW_CANVAS: process.env.FEATURE_NEW_CANVAS === 'true',
  AI_BUILDER: process.env.FEATURE_AI_BUILDER === 'true',
};
```

### 2.3 RBAC / Permissions

n8n's `@n8n/permissions` package là **open source** trong repo này:
- Path: `packages/@n8n/permissions/`
- Có thể tái sử dụng trực tiếp (theo fair-code license)

Hoặc dùng `casbin` để implement policy-based access control.

---

## 3. Open source components có thể tái sử dụng từ n8n repo

> n8n dùng **Sustainable Use License** (fair-code). Đọc LICENSE.md trước khi tái sử dụng code.

| Package | Path | Có thể tái sử dụng |
|---------|------|--------------------|
| Core workflow engine | `packages/workflow/` | Theo license |
| Execution engine | `packages/core/` | Theo license |
| Built-in nodes | `packages/nodes-base/` | Theo license |
| TypeORM DB layer | `packages/@n8n/db/` | Theo license |
| Config system | `packages/@n8n/config/` | Theo license |
| DI container | `packages/@n8n/di/` | Theo license |
| Permissions | `packages/@n8n/permissions/` | Theo license |
| Design system | `packages/@n8n/design-system/` | Theo license |

---

## 4. Roadmap gợi ý cho platform tự xây

### Phase 1 — Core (Nhóm A, effort thấp)
1. Fork/build trên n8n community edition (open source)
2. Implement JWT-based license system
3. Add LDAP + SSO (SAML/OIDC) với thư viện open source
4. Implement Variables, Folders, Credential sharing
5. Self-host PostHog cho feature flags

### Phase 2 — Scale (Nhóm B, effort trung bình)
1. Source Control integration (Git)
2. External Secrets Vault adapters
3. Custom RBAC với casbin
4. Multi-main scaling với Redis

### Phase 3 — Advanced (Nhóm B/C, effort cao)
1. AI-assisted workflow builder (dùng Claude API / OpenAI)
2. Analytics + Insights (dùng ClickHouse)
3. SCIM Provisioning

---

## 5. Cân nhắc về license n8n

n8n dùng **Sustainable Use License** + **n8n Enterprise License**:

- **Community features** (fair-code): có thể dùng miễn phí cho internal use
- **Enterprise features** (`.ee.ts` files): cần enterprise license từ n8n
- **Tự build**: nếu tự xây tính năng tương đương từ đầu (không copy code `.ee.ts`), không vi phạm license

**Tài liệu license:** `LICENSE.md` trong root của repo

---

## 6. So sánh effort

| Approach | Effort | Risk | Control |
|----------|--------|------|---------|
| Mua Enterprise license n8n | Thấp | Thấp | Phụ thuộc vendor |
| Fork + extend community n8n | Trung bình | Trung bình | Cao |
| Tự build platform mới | Cao | Cao | Đầy đủ |
| Hybrid: community n8n + tự build EE modules | Trung bình | Trung bình | Cao |

**Khuyến nghị:** Với các tính năng Nhóm A và B, approach **Hybrid** cho ROI tốt nhất — dùng n8n community làm foundation và tự implement các EE features cần thiết bằng open source libraries.

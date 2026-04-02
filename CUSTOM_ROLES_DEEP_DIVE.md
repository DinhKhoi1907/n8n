# Custom Roles — Chi tiết hoạt động

> **Phạm vi:** Tính năng enterprise (`feat:customRoles`). Chỉ áp dụng cho **project roles**.  
> **Mục đích:** Cho phép admin tự định nghĩa các role dự án với bộ scope tuỳ chỉnh, thay vì chỉ dùng các role hệ thống cố định.

---

## 1. Bức tranh tổng thể

```
┌──────────────────────────────────────────────────┐
│                  n8n Instance                    │
│                                                  │
│  ┌─────────────┐    ┌──────────────────────────┐ │
│  │ Global Roles│    │     Project Roles         │ │
│  │  (system)   │    │  ┌──────────────────────┐ │ │
│  │  - owner    │    │  │  System (immutable)   │ │ │
│  │  - admin    │    │  │  - project:admin      │ │ │
│  │  - member   │    │  │  - project:editor     │ │ │
│  │  - chatUser │    │  │  - project:viewer     │ │ │
│  └─────────────┘    │  │  - project:chatUser   │ │ │
│                     │  ├──────────────────────┤ │ │
│                     │  │  Custom (editable)    │ │ │
│                     │  │  - project:my-role-x  │ │ │
│                     │  │  - project:qa-team-y  │ │ │
│                     │  └──────────────────────┘ │ │
│                     └──────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

Mỗi role được gắn với một tập **scopes** (quyền hạn chi tiết theo dạng `resource:operation`).  
Custom roles cho phép admin lắp ráp tập scopes riêng, ví dụ: "chỉ xem workflow + chạy execution, không được sửa credential".

---

## 2. Cấu trúc dữ liệu

### 2.1 Database Schema

```
┌───────────────────────────────┐       ┌─────────────────────┐
│           role                │       │     role_scope      │
├───────────────────────────────┤       ├─────────────────────┤
│ slug (PK)     VARCHAR         │──┐    │ roleSlug (FK)       │
│ displayName   VARCHAR         │  └───▶│ scopeSlug (FK)      │
│ description   VARCHAR NULL    │       └─────────────────────┘
│ roleType      ENUM            │                │
│ systemRole    BOOLEAN         │                ▼
│ createdAt     TIMESTAMP       │       ┌─────────────────────┐
│ updatedAt     TIMESTAMP       │       │       scope         │
└───────────────────────────────┘       ├─────────────────────┤
                                        │ slug (PK)  e.g.     │
                                        │  workflow:create    │
                                        │  credential:read    │
                                        └─────────────────────┘
```

**File:** [packages/@n8n/db/src/entities/role.ts](packages/@n8n/db/src/entities/role.ts)

- `slug`: định danh duy nhất, ví dụ `project:qa-reviewer-a1b2c3`
- `roleType`: phân loại namespace — `global | project | workflow | credential | secretsProviderConnection`
- `systemRole: true` → không thể sửa/xoá (role hệ thống)
- `systemRole: false` → custom role, toàn quyền CRUD

### 2.2 TypeScript Types

**File:** [packages/@n8n/permissions/src/types.ee.ts](packages/@n8n/permissions/src/types.ee.ts)

```typescript
type Role = {
  slug: string;
  displayName: string;
  description?: string | null;
  scopes: Scope[];
  systemRole: boolean;
  roleType: RoleNamespace;
  licensed: boolean;
};

// Scope là chuỗi dạng "resource:operation"
type Scope = `${Resource}:${Operation}` | `${Resource}:*` | '*';

// Type guard: slug có phải project role có thể gán không?
function isAssignableProjectRoleSlug(slug: string): boolean {
  return slug.startsWith('project:') && slug !== 'project:personalOwner';
}
```

---

## 3. Slug tự động sinh

Khi tạo custom role, slug được tạo tự động:

```
project:<displayName-normalized>-<randomSuffix>

Ví dụ:
  displayName = "QA Reviewer"
  slug        = "project:qa-reviewer-x9k2m1"
```

- `displayName` được lowercase và thay ký tự đặc biệt bằng `-`
- Thêm suffix ngẫu nhiên để tránh trùng lặp

---

## 4. Luồng CRUD

### 4.1 API Endpoints

**File:** [packages/cli/src/controllers/role.controller.ts](packages/cli/src/controllers/role.controller.ts)

| Method | Path | Guard | Mô tả |
|--------|------|-------|-------|
| `GET` | `/roles` | Public (authenticated) | Lấy tất cả roles |
| `GET` | `/roles/:slug` | Public (authenticated) | Lấy role cụ thể |
| `GET` | `/roles/:slug/assignments` | `role:manage` | Danh sách project dùng role này |
| `GET` | `/roles/:slug/assignments/:projectId/members` | `role:manage` | Thành viên project theo role |
| `POST` | `/roles` | `role:manage` + **License** | Tạo custom role |
| `PATCH` | `/roles/:slug` | `role:manage` + **License** | Cập nhật custom role |
| `DELETE` | `/roles/:slug` | `role:manage` + **License** | Xoá custom role |

> **License gate:** `@Licensed(LICENSE_FEATURES.CUSTOM_ROLES)` → trả về `403 Forbidden` nếu không có bản quyền.

### 4.2 DTOs

**File:** [packages/@n8n/api-types/src/dto/roles/](packages/@n8n/api-types/src/dto/roles/)

```typescript
// Tạo mới
class CreateRoleDto {
  displayName: string;   // 2–100 ký tự
  description?: string;  // tối đa 500 ký tự
  roleType: 'project';   // Hiện tại chỉ hỗ trợ 'project'
  scopes: string[];      // Mảng slug của scopes hợp lệ
}

// Cập nhật (tất cả field đều optional)
class UpdateRoleDto {
  displayName?: string;
  description?: string;
  scopes?: string[];
}
```

### 4.3 Service Logic

**File:** [packages/cli/src/services/role.service.ts](packages/cli/src/services/role.service.ts)

```
createCustomRole(dto)
    │
    ├── Validate: displayName không trùng?
    ├── Validate: tất cả scopes tồn tại trong DB?
    ├── Generate: slug = project:<name>-<random>
    ├── Save: INSERT INTO role + INSERT INTO role_scope
    └── Invalidate cache
```

---

## 5. Hệ thống Scopes

### 5.1 Scope là gì?

Scope là quyền hạn nguyên tử theo cú pháp `resource:operation`:

**File:** [packages/@n8n/permissions/src/constants.ee.ts](packages/@n8n/permissions/src/constants.ee.ts)

```
workflow:create   workflow:read    workflow:update   workflow:delete
workflow:list     workflow:execute workflow:publish  workflow:unpublish
workflow:share    workflow:unshare workflow:move     workflow:activate

credential:create credential:read  credential:update credential:delete
credential:list   credential:share credential:unshare credential:move

project:create    project:read     project:update    project:delete
project:list

execution:reveal
folder:create     folder:read      folder:update     folder:delete
folder:list       folder:move

dataTable:create  dataTable:read   dataTable:update  dataTable:delete
dataTable:listProject              dataTable:readRow  dataTable:writeRow

projectVariable:list  projectVariable:read  projectVariable:create
projectVariable:update projectVariable:delete
... (150+ scopes tổng cộng)
```

### 5.2 Scopes của Role hệ thống

**File:** [packages/@n8n/permissions/src/roles/scopes/project-scopes.ee.ts](packages/@n8n/permissions/src/roles/scopes/project-scopes.ee.ts)

| Role | Scope tóm tắt |
|------|--------------|
| `project:admin` | Toàn bộ workflow + credential + execution + folder + sourceControl:push + project management |
| `project:editor` | Tạo/sửa/xoá workflow & credential, không có sourceControl:push |
| `project:viewer` | Chỉ đọc workflow, credential, folder, dataTable |
| `project:chatUser` | Chỉ `workflow:execute-chat` + đọc cơ bản |

### 5.3 Scope hiển thị cho người dùng

**File:** [packages/@n8n/permissions/src/scope-information.ts](packages/@n8n/permissions/src/scope-information.ts)

Mỗi scope có metadata để hiển thị trên UI:

```typescript
'workflow:publish': {
  displayName: 'Publish Workflow',
  description: 'Allows publishing workflows.',
}
```

---

## 6. Kiểm tra quyền truy cập (Permission Check)

### 6.1 Luồng tổng quát

**File:** [packages/cli/src/permissions.ee/check-access.ts](packages/cli/src/permissions.ee/check-access.ts)

```
userHasScopes(user, requiredScopes, globalOnly, context)
         │
         ├── 1. Kiểm tra Global Role
         │       hasGlobalScope(user, scopes)?  ──▶  YES → cho qua
         │
         ├── 2. Nếu globalOnly=true → từ chối
         │
         ├── 3. Lấy tất cả roles có đủ required scopes
         │       RoleService.rolesWithScope('project', scopes)
         │       (kết quả bao gồm cả custom roles)
         │
         └── 4. Kiểm tra xem user có role đó trong project
                 chứa resource (workflow/credential) không
                        │
                    YES → cho qua
                    NO  → từ chối (403)
```

### 6.2 Role Cache Service

**File:** [packages/cli/src/services/role-cache.service.ts](packages/cli/src/services/role-cache.service.ts)

```
getRolesWithAllScopes(namespace, requiredScopes)
         │
         ├── Cache hit? ──▶ Trả về danh sách slug có đủ scopes
         │
         └── Cache miss?
                 ├── Lấy từ DB tất cả roles trong namespace
                 ├── Lọc roles có ALL required scopes
                 ├── Cache kết quả (TTL: 5 phút)
                 └── Trả về

Cache bị xoá khi: role create / update / delete
```

Caching quan trọng vì mỗi API request đều cần kiểm tra quyền → tránh N+1 query vào DB.

---

## 7. Tự động cập nhật scopes (Migrations)

Khi n8n thêm scope mới vào system roles, custom roles cũng được tự động cập nhật qua migration:

```
1769900001000-AddWorkflowUnpublishScopeToCustomRoles
  → Thêm 'workflow:unpublish' vào TẤT CẢ custom project roles

1771500000001-AddUnshareScopeToCustomRoles
  → Thêm 'workflow:unshare' và 'credential:unshare'

1766064542000-AddWorkflowPublishScopeToProjectRoles
  → Thêm 'workflow:publish' vào tất cả project roles (hệ thống + custom)
```

**Lý do:** Đảm bảo custom roles không bị "tụt hậu" so với hệ thống khi có tính năng mới.

---

## 8. Frontend

### 8.1 State Management

**File:** [packages/frontend/editor-ui/src/app/stores/roles.store.ts](packages/frontend/editor-ui/src/app/stores/roles.store.ts)

```typescript
const useRolesStore = defineStore('roles', () => {
  // Lưu tất cả roles phân theo namespace
  const roles = ref<AllRolesMap>({
    global: [], project: [], credential: [], workflow: [], ...
  });

  // Lọc bỏ personalOwner, sắp xếp: viewer → chatUser → editor → admin
  const processedProjectRoles = computed(() => ...);

  // CRUD actions gọi REST API
  const createProjectRole = (body: CreateRoleDto) => ...
  const updateProjectRole = (slug, body: UpdateRoleDto) => ...
  const deleteProjectRole = (slug) => ...
  const fetchRoleAssignments = (slug) => ...
});
```

### 8.2 Các màn hình UI

| Component | Vị trí | Mô tả |
|-----------|--------|-------|
| `ProjectRolesView.vue` | `/settings/roles` | Danh sách tất cả roles, bảng: tên / loại / số project / lần chỉnh sửa |
| `ProjectRoleScopesView.vue` | `/settings/roles/:slug/edit` | Chỉnh sửa displayName, description, scopes cho custom role |
| `ProjectRoleView.vue` | `/settings/roles/:slug` | Xem chi tiết system role (read-only) |
| `RoleAssignmentsTab.vue` | Tab trong màn hình role | Danh sách project đang dùng role này |
| `ProjectMembersRoleCell.vue` | Bảng thành viên project | Dropdown chọn role, phân tách system / custom |

### 8.3 License Gate trên Frontend

```typescript
// settings.store.ts
const isCustomRolesFeatureEnabled = computed(
  () => settings.value.enterprise?.customRoles ?? false
);

// Trong component:
if (!hasCustomRolesLicense.value) {
  // Hiện modal upgrade thay vì thực hiện action
  upgradeModalVisible.value = true;
}
```

---

## 9. Validation Rules

| Điều kiện | Kết quả |
|-----------|---------|
| `displayName` < 2 ký tự | `400 Bad Request` |
| `displayName` > 100 ký tự | `400 Bad Request` |
| `description` > 500 ký tự | `400 Bad Request` |
| Scope không tồn tại | `400 Bad Request` |
| Xoá role đang được gán cho user/project | `409 Conflict` (bắt buộc go to assignments trước) |
| Xoá/sửa system role | `403 Forbidden` |
| Tạo/sửa/xoá mà không có license | `403 Forbidden` |
| Tạo/sửa/xoá mà không có `role:manage` scope | `403 Forbidden` |

---

## 10. Sơ đồ quan hệ đầy đủ

```
User ──── has ────▶ GlobalRole
 │                    │
 │                    └──▶ global:owner / global:admin / global:member
 │
 └──── belongs to ──▶ Project
                         │
                         └── through ProjectRelation ──▶ ProjectRole
                                                              │
                                              ┌──────────────┴──────────────┐
                                              │                             │
                                        System Roles                  Custom Roles
                                        (hardcoded scopes)            (DB scopes)
                                              │                             │
                                              └──────────────┬─────────────┘
                                                             │
                                                       Scope Set
                                                    (workflow:create,
                                                     credential:read, ...)
                                                             │
                                                             ▼
                                               Permission Check Engine
                                               (check-access.ts + cache)
```

---

## 11. File tham khảo chính

| Loại | File |
|------|------|
| Entity DB | [packages/@n8n/db/src/entities/role.ts](packages/@n8n/db/src/entities/role.ts) |
| Repository | [packages/@n8n/db/src/repositories/role.repository.ts](packages/@n8n/db/src/repositories/role.repository.ts) |
| Service | [packages/cli/src/services/role.service.ts](packages/cli/src/services/role.service.ts) |
| Controller | [packages/cli/src/controllers/role.controller.ts](packages/cli/src/controllers/role.controller.ts) |
| Cache Service | [packages/cli/src/services/role-cache.service.ts](packages/cli/src/services/role-cache.service.ts) |
| Permission Check | [packages/cli/src/permissions.ee/check-access.ts](packages/cli/src/permissions.ee/check-access.ts) |
| Types | [packages/@n8n/permissions/src/types.ee.ts](packages/@n8n/permissions/src/types.ee.ts) |
| Scopes Constants | [packages/@n8n/permissions/src/constants.ee.ts](packages/@n8n/permissions/src/constants.ee.ts) |
| DTOs | [packages/@n8n/api-types/src/dto/roles/](packages/@n8n/api-types/src/dto/roles/) |
| Pinia Store | [packages/frontend/editor-ui/src/app/stores/roles.store.ts](packages/frontend/editor-ui/src/app/stores/roles.store.ts) |
| UI Components | [packages/frontend/editor-ui/src/features/project-roles/](packages/frontend/editor-ui/src/features/project-roles/) |
| Integration Tests | [packages/cli/test/integration/access-control/custom-roles-functionality.test.ts](packages/cli/test/integration/access-control/custom-roles-functionality.test.ts) |

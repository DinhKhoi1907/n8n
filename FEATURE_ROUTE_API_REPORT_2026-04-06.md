# Báo Cáo Tính Năng Common + Enterprise, Route và API Backend

> Được tạo từ việc rà soát code vào ngày 2026-04-06.
>
> Phạm vi:
> - Bao phủ các bề mặt tính năng người dùng thấy được trong `packages/frontend/editor-ui`, gồm route common, route enterprise, và các capability enterprise lớn nằm bên trong từng màn hình.
> - Cột backend liệt kê file controller/API handler chính, không liệt kê toàn bộ service/helper ở bên dưới.
> - Các trang lỗi, route chỉ để redirect, webhook URL thô, và phần hạ tầng thuần kỹ thuật không được trộn vào inventory chính; các capability dạng deployment/API-only được để riêng ở phần phụ lục.

## 1. Inventory tính năng theo route

| checked | loại | tính năng | đường dẫn truy cập | mô tả ngắn | file BE API chính |
|---|---|---|---|---|---|
|  | Common | Đăng nhập | `/signin` | Màn hình vào hệ thống bằng username/password. | `packages/cli/src/controllers/auth.controller.ts` |
|  | Common | Đăng ký / chấp nhận lời mời | `/signup` | Nhận token mời và hoàn tất tạo tài khoản. | `packages/cli/src/controllers/auth.controller.ts`, `packages/cli/src/controllers/invitation.controller.ts` |
|  | Common | Đăng xuất | `/signout` | Đăng xuất phiên hiện tại. | `packages/cli/src/controllers/auth.controller.ts` |
|  | Common | Thiết lập owner ban đầu | `/setup` | Luồng bootstrap owner đầu tiên cho instance mới. | `packages/cli/src/controllers/owner.controller.ts` |
|  | Common | Quên / đổi mật khẩu | `/forgot-password`, `/change-password` | Gửi yêu cầu reset mật khẩu và đổi mật khẩu bằng token. | `packages/cli/src/controllers/password-reset.controller.ts` |
|  | Common hoặc theo cờ | Duyệt template và onboarding | `/templates/`, `/templates/:id`, `/templates/:id/setup`, `/collections/:id`, `/workflows/templates/:id`, `/workflows/onboarding/:id` | Duyệt template workflow, xem chi tiết, và import/setup template. | `packages/cli/src/controllers/dynamic-templates.controller.ts` |
|  | Common hoặc theo cờ | Resource Center | `/resource-center`, `/resource-center/section/:sectionId` | Khu vực tài nguyên/học tập ngay trong ứng dụng. | `N/A (bề mặt frontend/content trong editor-ui)` |
|  | Common | Danh sách workflow và folder | `/home/workflows`, `/projects/:projectId/workflows`, `/projects/:projectId/folders/:folderId/workflows`, `/shared/workflows` | Duyệt workflow theo ngữ cảnh home/project/shared, có cả điều hướng folder. | `packages/cli/src/workflows/workflows.controller.ts`, `packages/cli/src/controllers/folder.controller.ts`, `packages/cli/src/controllers/project.controller.ts` |
|  | Common | Trình soạn thảo workflow / workflow mới | `/workflow/new`, `/workflow/:name/:nodeId?` | Tạo và chỉnh sửa workflow trên canvas, cấu hình node và lưu phiên bản. | `packages/cli/src/workflows/workflows.controller.ts`, `packages/cli/src/controllers/node-types.controller.ts`, `packages/cli/src/controllers/dynamic-node-parameters.controller.ts` |
|  | Common | Trình xem execution của workflow | `/workflow/:name/executions`, `/workflow/:name/executions/:executionId/:nodeId?` | Xem execution của một workflow, mở preview của run và debug dữ liệu run. | `packages/cli/src/executions/executions.controller.ts`, `packages/cli/src/controllers/workflow-statistics.controller.ts` |
|  | Enterprise | Debug trực tiếp trong editor | `/workflow/:name/debug/:executionId` | Mở lại một execution trực tiếp trên canvas editor để debug theo từng bước. | `packages/cli/src/executions/executions.controller.ts` |
|  | Hỗn hợp | Lịch sử workflow và diff | `/workflow/:workflowId/history/:versionId?` | Duyệt lịch sử workflow và so sánh phiên bản; khi có license thì trang này còn có named versions. | `packages/cli/src/workflows/workflow-history/workflow-history.controller.ts` |
|  | Enterprise | Đánh giá workflow / test runs | `/workflow/:name/evaluation`, `/workflow/:name/evaluation/test-runs/:runId` | Thiết lập AI evaluation và xem chi tiết test run cho workflow. | `packages/cli/src/evaluation.ee/test-runs.controller.ee.ts` |
|  | Common / preview | Route demo preview | `/workflows/demo`, `/workflows/demo/diff` | Các route canvas demo/preview chỉ dùng trong preview mode. | `N/A (bề mặt preview phía frontend)` |
|  | Common | Danh sách và chỉnh sửa credential | `/home/credentials/:credentialId?`, `/projects/:projectId/credentials/:credentialId?`, `/shared/credentials/:credentialId?` | Duyệt, tạo, sửa, test, share và authorize credential. | `packages/cli/src/credentials/credentials.controller.ts`, `packages/cli/src/controllers/oauth/oauth1-credential.controller.ts`, `packages/cli/src/controllers/oauth/oauth2-credential.controller.ts` |
|  | Enterprise | Biến của project | `/home/variables`, `/projects/:projectId/variables` | Quản lý biến ở cấp project và đưa chúng vào expression/editor. | `packages/cli/src/environments.ee/variables/variables.controller.ee.ts` |
|  | Hỗn hợp | Cài đặt project và thành viên | `/projects/:projectId/settings` | Quản lý metadata của project, thành viên, role, và các kết nối external secrets theo project. | `packages/cli/src/controllers/project.controller.ts`, `packages/cli/src/controllers/role.controller.ts`, `packages/cli/src/modules/external-secrets.ee/secrets-providers-project.controller.ee.ts` |
|  | Common | Danh sách executions | `/home/executions`, `/projects/:projectId/executions` | Duyệt executions toàn cục hoặc theo project, có filter và thao tác hàng loạt. | `packages/cli/src/executions/executions.controller.ts` |
|  | Common hoặc theo cờ | Data tables | `/home/datatables`, `/projects/:projectId/datatables/new`, `/projects/:projectId/datatables/:id` | Tạo, xem, import, chỉnh sửa và aggregate data table của project. | `packages/cli/src/modules/data-table/data-table.controller.ts`, `packages/cli/src/modules/data-table/data-table-uploads.controller.ts`, `packages/cli/src/modules/data-table/data-table-aggregate.controller.ts` |
|  | Enterprise | Dashboard Insights | `/insights/:insightType?` | Xem tổng quan analytics/insights, chuỗi thời gian và metric theo workflow. | `packages/cli/src/modules/insights/insights.controller.ts` |
|  | Common hoặc theo cờ | Chat Hub | `/home/chat`, `/home/chat/:id`, `/home/chat/workflow-agents`, `/home/chat/personal-agents` | Trò chuyện với model/agent, xem lại conversation, và duyệt workflow agent/personal agent. | `packages/cli/src/modules/chat-hub/chat-hub.controller.ts` |
|  | Common hoặc theo cờ | Cài đặt Chat Hub | `/settings/chat` | Quản lý provider của Chat Hub và semantic search settings. | `packages/cli/src/modules/chat-hub/chat-hub.settings.controller.ts` |
|  | Common hoặc theo cờ | Instance AI | `/instance-ai`, `/instance-ai/:threadId` | Chat với instance AI agent và stream sự kiện của thread. | `packages/cli/src/modules/instance-ai/instance-ai.controller.ts` |
|  | Common hoặc theo cờ | Cài đặt Instance AI | `/settings/instance-ai` | Cấu hình hành vi/khả dụng của Instance AI trong phần settings. | `packages/cli/src/modules/instance-ai/instance-ai.controller.ts` |
|  | Hỗn hợp | Cài đặt AI assistant | `/settings/ai` | Điều khiển cài đặt chia sẻ dữ liệu cho AI và các usage settings liên quan assistant. | `packages/cli/src/controllers/ai.controller.ts` |
|  | Enterprise | Credential resolvers | `/settings/resolvers` | Quản lý dynamic credential resolvers và xem các workflow bị ảnh hưởng. | `packages/cli/src/modules/dynamic-credentials.ee/credential-resolvers.controller.ts`, `packages/cli/src/modules/dynamic-credentials.ee/workflow-status.controller.ts` |
|  | Common hoặc theo cờ | Cài đặt MCP | `/settings/mcp` | Bật MCP access, xoay MCP API key, quản lý OAuth clients, và mở workflow cho MCP. | `packages/cli/src/modules/mcp/mcp.settings.controller.ts`, `packages/cli/src/modules/mcp/mcp.oauth-clients.controller.ts`, `packages/cli/src/modules/mcp/mcp.oauth.controller.ts` |
|  | Common hoặc theo cờ | MCP OAuth consent | `/oauth/consent` | Màn hình xin quyền cho MCP OAuth client. | `packages/cli/src/modules/mcp/mcp.auth.consent.controller.ts` |
|  | Common | Usage và gói dịch vụ | `/settings/usage` | Xem gói hiện tại/usage và kích hoạt hoặc gia hạn license. | `packages/cli/src/license/license.controller.ts` |
|  | Common | Báo cáo migration | `/settings/migration-report`, `/settings/migration-report/:migrationRuleId` | Duyệt báo cáo phát hiện breaking change và đi sâu vào từng rule. | `packages/cli/src/modules/breaking-changes/breaking-changes.controller.ts` |
|  | Hỗn hợp | Cài đặt cá nhân | `/settings/personal` | Cập nhật thông tin cá nhân, theme, mật khẩu và MFA self-service. | `packages/cli/src/controllers/me.controller.ts`, `packages/cli/src/controllers/mfa.controller.ts` |
|  | Hỗn hợp | Cài đặt bảo mật | `/settings/security` | Quản lý chính sách bảo mật của instance, gồm MFA enforcement và personal-space policies khi có license. | `packages/cli/src/controllers/security-settings.controller.ts`, `packages/cli/src/controllers/mfa.controller.ts` |
|  | Hỗn hợp | Cài đặt người dùng | `/settings/users` | Liệt kê/mời/quản lý người dùng, tạo invite/reset link và gán global role. | `packages/cli/src/controllers/users.controller.ts`, `packages/cli/src/controllers/invitation.controller.ts` |
|  | Hỗn hợp | Project roles / custom roles | `/settings/project-roles`, `/settings/project-roles/new`, `/settings/project-roles/edit/:roleSlug`, `/settings/project-roles/view/:roleSlug` | Xem các project role dựng sẵn và tạo/sửa custom role nếu có license. | `packages/cli/src/controllers/role.controller.ts` |
|  | Hỗn hợp | API keys | `/settings/api` | Tạo, cập nhật metadata, xóa và giới hạn scope cho public API key. | `packages/cli/src/controllers/api-keys.controller.ts` |
|  | Common | Community nodes | `/settings/community-nodes` | Cài, cập nhật, gỡ và xem community package/node type. | `packages/cli/src/modules/community-packages/community-packages.controller.ts`, `packages/cli/src/modules/community-packages/community-node-types.controller.ts` |
|  | Enterprise | Cài đặt source control | `/settings/environments` | Cấu hình kết nối Git/source control, branch settings, hành vi pull/push và repo preferences. | `packages/cli/src/modules/source-control.ee/source-control.controller.ee.ts` |
|  | Enterprise | Cài đặt external secrets | `/settings/external-secrets` | Cấu hình external secret providers ở cấp instance và các setting liên quan. | `packages/cli/src/modules/external-secrets.ee/external-secrets.controller.ee.ts`, `packages/cli/src/modules/external-secrets.ee/external-secrets-settings.controller.ee.ts` |
|  | Enterprise | Cài đặt SSO (SAML / OIDC) | `/settings/sso` | Cấu hình xác thực SAML hoặc OIDC và test kết nối. | `packages/cli/src/modules/sso-saml/saml.controller.ee.ts`, `packages/cli/src/modules/sso-oidc/oidc.controller.ee.ts` |
|  | Enterprise | Onboarding SAML | `/saml/onboarding` | Hoàn tất onboarding lần đầu cho người dùng đăng nhập bằng SAML. | `packages/cli/src/modules/sso-saml/saml.controller.ee.ts`, `packages/cli/src/controllers/me.controller.ts` |
|  | Enterprise | Log streaming | `/settings/log-streaming` | Cấu hình event destination để stream log/sự kiện ra ngoài. | `packages/cli/src/modules/log-streaming.ee/log-streaming.controller.ts` |
|  | Enterprise | Worker view | `/settings/workers` | Xem trạng thái orchestration/worker trong môi trường queue-mode. | `packages/cli/src/controllers/orchestration.controller.ts` |
|  | Enterprise | Cài đặt LDAP | `/settings/ldap` | Cấu hình đăng nhập LDAP và đồng bộ LDAP, gồm test/sync operation. | `packages/cli/src/modules/ldap.ee/ldap.controller.ee.ts` |

## 2. Tính năng nhúng bên trong các màn hình ở trên

| checked | loại | tính năng | route / ngữ cảnh truy cập | mô tả ngắn | file BE API chính |
|---|---|---|---|---|---|
|  | Enterprise | Chia sẻ workflow | `/workflow/:name` | Chia sẻ workflow cho project/user từ header hoặc modal của workflow. | `packages/cli/src/workflows/workflows.controller.ts` |
|  | Enterprise | Chia sẻ credential | Các route chi tiết credential dưới `/home/credentials/:credentialId?`, `/projects/:projectId/credentials/:credentialId?` | Chia sẻ credential và quản lý quyền truy cập ở cấp credential. | `packages/cli/src/credentials/credentials.controller.ts` |
|  | Enterprise | Tích hợp source control: push / pull / diff | `/home/workflows`, `/workflow/:name`, `/projects/:projectId/variables`, `/projects/:projectId/datatables/:id` | Dùng các luồng pull/push/status dựa trên Git ngay trong các màn hình liên quan workflow. | `packages/cli/src/modules/source-control.ee/source-control.controller.ee.ts` |
|  | Enterprise | Advanced execution filters | `/home/executions`, `/projects/:projectId/executions`, `/workflow/:name/executions` | Bộ lọc execution nâng cao, ví dụ filter metadata phong phú hơn và các filter set có license. | `packages/cli/src/executions/executions.controller.ts`, `packages/cli/src/controllers/annotation-tags.controller.ee.ts` |
|  | Enterprise | Annotation tags cho execution | `/home/executions`, `/workflow/:name/executions/:executionId/:nodeId?` | Thêm và xem annotation tags trên execution. | `packages/cli/src/controllers/annotation-tags.controller.ee.ts`, `packages/cli/src/executions/executions.controller.ts` |
|  | Enterprise | External secrets trong màn hình sửa credential | Các route chi tiết credential | Resolve/liệt kê secret từ external provider trong lúc cấu hình credential. | `packages/cli/src/modules/external-secrets.ee/external-secrets.controller.ee.ts`, `packages/cli/src/modules/external-secrets.ee/secrets-providers-project.controller.ee.ts`, `packages/cli/src/credentials/credentials.controller.ts` |
|  | Enterprise | Kết nối external secrets theo project | `/projects/:projectId/settings` | Kết nối một project với một hoặc nhiều external secret provider. | `packages/cli/src/modules/external-secrets.ee/secrets-providers-project.controller.ee.ts` |
|  | Enterprise | Named versions | `/workflow/:name`, `/workflow/:workflowId/history/:versionId?` | Gắn nhãn cho version và mở thêm các thao tác lịch sử version phong phú hơn. | `packages/cli/src/workflows/workflow-history/workflow-history.controller.ts` |
|  | Enterprise / theo cờ | Workflow diffs | `/workflow/:workflowId/history/:versionId?`, `/workflows/demo/diff` | So sánh trực quan giữa các phiên bản workflow. | `packages/cli/src/workflows/workflow-history/workflow-history.controller.ts` |
|  | Common / enterprise theo cờ | AI Builder / Ask AI trong editor | `/workflow/:name` | Dùng AI để xây hoặc chỉnh workflow trực tiếp từ canvas/editor. | `packages/cli/src/controllers/ai.controller.ts` |
|  | Enterprise | Variables trong editor và expression | `/workflow/:name`, màn hình sửa credential, code/expression editors | Dùng project variables trong autocomplete, expression và các helper phía editor. | `packages/cli/src/environments.ee/variables/variables.controller.ee.ts` |
|  | Enterprise | Bắt buộc MFA cho toàn instance | `/settings/security` | Bật/tắt chính sách bắt buộc MFA cho cả tổ chức. | `packages/cli/src/controllers/mfa.controller.ts` |
|  | Enterprise | Personal-space policies | `/settings/security` | Kiểm soát việc personal space có được publish/share tài nguyên hay không. | `packages/cli/src/controllers/security-settings.controller.ts` |
|  | Enterprise | Advanced permissions / thêm global role | `/settings/users` | Bật và sử dụng các global role nâng cao như admin/chat user trong luồng quản trị. | `packages/cli/src/controllers/users.controller.ts` |
|  | Enterprise | Luồng đăng nhập OIDC | `/settings/sso` rồi tới `/rest/sso/oidc/login` và callback | Luồng redirect/login OIDC được đi ra từ phần SSO settings. | `packages/cli/src/modules/sso-oidc/oidc.controller.ee.ts` |
|  | Enterprise | Luồng đăng nhập SAML / SP-init | `/settings/sso` rồi tới `/rest/sso/saml/initsso`, `/rest/sso/saml/acs` | Metadata SAML, init SSO, ACS và luồng test kết nối. | `packages/cli/src/modules/sso-saml/saml.controller.ee.ts` |
|  | Common hoặc theo cờ | Quản lý MCP API key / OAuth client | `/settings/mcp` | Xoay MCP API key và quản lý các MCP OAuth client đã đăng ký. | `packages/cli/src/modules/mcp/mcp.settings.controller.ts`, `packages/cli/src/modules/mcp/mcp.oauth-clients.controller.ts` |
|  | Common hoặc theo cờ | Cấu hình provider và semantic search cho Chat | `/settings/chat` | Cấu hình LLM provider và semantic-search backing cho Chat Hub. | `packages/cli/src/modules/chat-hub/chat-hub.settings.controller.ts` |

## 3. Capability có trong code nhưng không có route editor-ui riêng

| checked | loại | capability | đường dẫn truy cập | mô tả ngắn | file BE API chính |
|---|---|---|---|---|---|
|  | Enterprise | Provisioning config | `Không có route editor-ui riêng trong snapshot repo này` | Có backend endpoint cho phần cấu hình liên quan SCIM/provisioning. | `packages/cli/src/modules/provisioning.ee/provisioning.controller.ee.ts` |
|  | Enterprise | Provisioning role-mapping rules | `Không có route editor-ui riêng trong snapshot repo này` | CRUD cho role-mapping rules dùng trong provisioning flow. | `packages/cli/src/modules/provisioning.ee/role-mapping-rule.controller.ee.ts` |
|  | Enterprise | Dynamic credential execution-status endpoint | `Không có route editor-ui riêng; API ngoài là /workflows/:workflowId/execution-status` | Endpoint public/external để kiểm tra workflow đã sẵn sàng chạy với dynamic credentials hay chưa. | `packages/cli/src/modules/dynamic-credentials.ee/workflow-status.controller.ts` |
|  | Enterprise | Token exchange / embed auth support | `Không có route editor-ui riêng` | Capability backend cho token-exchange trong các luồng embedded hoặc delegated auth. | `packages/cli/src/modules/token-exchange/token-exchange.controller.ts`, `packages/cli/src/modules/token-exchange/controllers/embed-auth.controller.ts` |
|  | Enterprise | Cờ Audit logs | `Không thấy route editor-ui hoặc controller riêng trong snapshot này` | Có license flag trong code, nhưng ở lần rà này không thấy route/controller editor-ui độc lập. | `packages/frontend/editor-ui/src/app/constants/enterprise.ts`, `packages/cli/src/services/frontend.service.ts` |
|  | Enterprise | Binary data trên S3 | `Chỉ ở mức deployment / config` | Capability về storage backend, không phải trang tính năng có thể bấm trong editor-ui. | `packages/cli/src/services/frontend.service.ts` |
|  | Enterprise | Multiple main instances | `Chỉ ở mức deployment / config` | Capability scale ngang, không phải trang tính năng có thể bấm trong editor-ui. | `packages/cli/src/services/frontend.service.ts`, `packages/cli/src/controllers/debug.controller.ts` |
|  | Enterprise | Cờ tắt API | `Chỉ ở mức deployment / config` | Capability ở mức license/config có thể làm public API bị vô hiệu hóa. | `packages/cli/src/services/frontend.service.ts`, `packages/cli/src/controllers/api-keys.controller.ts` |
|  | Enterprise | Banner non-prod | `Banner / global chrome, không có route riêng` | Capability hiển thị banner ở cấp instance, không phải trang độc lập. | `packages/cli/src/services/frontend.service.ts` |
|  | Enterprise | Community-nodes custom registry | `Chưa thấy route độc lập riêng` | Capability enterprise liên quan registry, nằm phía sau các luồng quản lý community nodes. | `packages/cli/src/services/frontend.service.ts` |

## 4. Ghi chú phạm vi rà soát

- Nguồn dùng để lập inventory:
  - `packages/frontend/editor-ui/src/app/router.ts`
  - `packages/frontend/editor-ui/src/features/collaboration/projects/projects.routes.ts`
  - Các module descriptor dưới `packages/frontend/editor-ui/src/features/**/module.descriptor.ts`
  - Các bề mặt enterprise UI dưới `packages/frontend/editor-ui/src/**/*.ee.*`
  - Các backend controller dưới `packages/cli/src/**`
- Các capability enterprise chính đã được đối chiếu thêm với tài liệu ở mức repo:
  - `FEATURE_GATING_MAP.md`
  - `CUSTOM_ROLES_DEEP_DIVE.md`
  - `ENTERPRISE_LICENSE_MECHANISM.md`
- Nếu cần, mình có thể làm thêm một bản thứ hai được sắp theo backend module hoặc theo thứ tự test/UAT để dễ check tuần tự hơn.

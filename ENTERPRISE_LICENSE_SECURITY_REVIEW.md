# Đánh giá bảo mật cơ chế Enterprise License

> Mục tiêu: tổng hợp trust model, attack surface, và những kết luận kiến trúc quan trọng của cơ chế enterprise license trong n8n.
>

---

## 1. Kết luận nhanh

Nếu attacker kiểm soát được host, container, image build, hoặc runtime code của một bản n8n self-hosted, thì cơ chế local license enforcement không còn là security boundary tuyệt đối nữa.

Trong threat model đó, điểm chí mạng nhất nằm ở **trust anchor của quá trình verify license**:

- SDK verification path (`@n8n_io/license-sdk`)
- trust material mà SDK tin cậy
- endpoint mà SDK coi là license server hợp lệ
- các lớp backend phía trên sử dụng kết quả verify đó để enforce feature flags

Nói ngắn gọn:

- **Frontend không phải điểm chí mạng**.
- **Decorator và middleware route-level không phải trust anchor gốc**.
- **SDK/tầng verify + runtime trust configuration mới là lớp quan trọng nhất**.

---

## 2. Phân biệt các attacker model

Không đánh giá đúng security nếu không tách rõ attacker model.

### 2.1 Remote attacker không có quyền sửa host

Đây là đối tượng:

- không có shell trên server
- không sửa được filesystem
- không sửa được Docker image
- không sửa được env vars

Với đối tượng này:

- frontend hack không đủ để mở enterprise feature
- API vẫn bị backend chặn nếu route có enforce license
- DB tampering đơn thuần cũng chưa đủ, nếu cert vẫn phải đi qua logic verify hợp lệ

Kết luận:

- Tầng SDK **không phải** "dễ bị tấn công" theo nghĩa direct remote attack.
- Muốn lợi dụng được nó, remote attacker trước tiên phải có được một foothold khác, ví dụ RCE, container escape, hoặc quyền deploy.

### 2.2 User hợp lệ trong app nhưng không có quyền hệ thống

Đây là người chỉ truy cập qua giao diện hoặc API thông thường.

Với đối tượng này:

- bypass UI chỉ làm thay đổi trải nghiệm, không làm backend trust sai
- các route có `@Licensed()` vẫn trả `403`
- các service-level checks vẫn có thể chốt lại logic

Kết luận:

- UI chỉ là lớp presentation.
- Đây không phải attack surface chí mạng.

### 2.3 Instance admin / container operator / image builder

Đây mới là attacker model quan trọng nhất đối với bài toán này.

Người này có thể:

- sửa filesystem
- sửa `node_modules`
- sửa bundle runtime
- thay env vars
- rebuild image
- thay config endpoint

Với đối tượng này:

- local license enforcement chỉ còn là cơ chế chống sửa đổi ở mức "làm tăng chi phí"
- trust anchor có thể bị thay đổi
- mọi lớp enforce phía trên sẽ nhận kết quả sai lệch và hoạt động trên giả định sai

Kết luận:

- Nếu mục tiêu là chống đối tượng này một cách tuyệt đối, cơ chế local-only enforcement sẽ không đủ.

### 2.4 Supply-chain attacker

Đây là trường hợp:

- private package bị thay đổi
- build pipeline bị compromise
- image artifact bị thay bằng bản đã được chỉnh sửa

Với attacker này:

- hệ thống có thể bị compromise trước khi đến tay người vận hành
- trust anchor bị thay ngay từ gốc build/distribution

Kết luận:

- Đây là rủi ro rất cao và thường bị đánh giá thiếu nếu chỉ tập trung vào runtime.

---

## 3. Trust boundary thực sự nằm ở đâu

Trong luồng này, cần tách 4 lớp:

### 3.1 Lớp presentation

- `packages/cli/src/services/frontend.service.ts`
- frontend `settings.enterprise.*`

Vai trò:

- phản ánh state license ra UI
- ẩn/hiện feature
- hiện upgrade modal

Giá trị security:

- thấp
- sửa lớp này chủ yếu tạo ảo tưởng feature đã được bật

### 3.2 Lớp route enforcement

- `packages/@n8n/decorators/src/controller/licensed.ts`
- `packages/cli/src/controller.registry.ts`

Vai trò:

- đặt metadata cho route
- inject middleware check license
- chặn sớm trước khi vào handler

Giá trị security:

- trung bình đến cao
- nếu patch lớp này, nhiều endpoint route-level sẽ mở
- nhưng đây vẫn **không phải trust anchor gốc**

### 3.3 Lớp business/query abstraction

- `packages/@n8n/backend-common/src/license-state.ts`
- một phần `packages/cli/src/license.ts`

Vai trò:

- cung cấp helper như `isCustomRolesLicensed()`, `isSamlLicensed()`, `getMaxUsers()`
- để phần business khác gọi đến

Giá trị security:

- cao
- nếu lớp này trả lời sai, rất nhiều logic sẽ tin sai

### 3.4 Lớp trust anchor / verification

- `@n8n_io/license-sdk`
- `LicenseManager`
- trust material bên trong SDK
- server endpoint được truyền vào SDK

Vai trò:

- xác định cert nào được coi là hợp lệ
- quyết định entitlement nào là "sự thật" để phần còn lại tin theo

Giá trị security:

- **chí mạng nhất**
- nếu lớp này bị thay đổi, mọi lớp phía trên chỉ đang enforce một "sự thật giả"

---

## 4. Vì sao SDK là điểm chí mạng nhất

`packages/cli/src/license.ts` khởi tạo `LicenseManager` và truyền vào các tham số trust quan trọng:

- `server`
- `tenantId`
- `loadCertStr`
- `saveCertStr`
- `deviceFingerprint`
- auto-renew / renew-on-init

Sau đó, toàn bộ backend gọi `License.isLicensed(...)` hoặc `LicenseState.*Licensed()` dựa trên kết quả của lớp này.

Ý nghĩa kiến trúc:

- nếu verification logic bị tamper, kết quả "licensed / unlicensed" bị đổi nghĩa
- nếu trust material bị đổi, cert giả có thể được chấp nhận
- nếu endpoint tin cậy bị đổi hướng, hệ thống có thể nói chuyện với một authority khác với dự kiến ban đầu

Vậy nên, với attacker đã có quyền sửa runtime:

- SDK verification path là nơi đáp ứng câu hỏi "ứng dụng đang tin vào ai?"
- và cũng là nơi trả lời câu hỏi "ai được quyền định nghĩa một cert là hợp lệ?"

Đó là lý do nó là trust anchor.

---

## 5. Nhóm attack surface quan trọng

Phần này không đi vào thao tác chi tiết, chỉ nhìn ở mức abuse class.

### 5.1 Runtime logic tampering

Mô tả:

- thay đổi logic verify hoặc logic trả kết quả entitlement trong runtime

Tác động:

- app có thể coi license giả là hợp lệ
- app có thể bỏ qua hoàn toàn một số check

Mức độ:

- rất cao

### 5.2 Trust material replacement

Mô tả:

- thay đổi trust material mà SDK sử dụng để quyết định cái gì là "signed by trusted authority"

Tác động:

- authority được tin cậy bị thay đổi
- toàn bộ chuỗi trust phía sau mất nghĩa

Mức độ:

- rất cao

### 5.3 Endpoint trust redirection

Mô tả:

- thay đổi endpoint mà app coi là license authority

Liên quan code:

- `N8N_LICENSE_SERVER_URL`
- `packages/@n8n/config/src/configs/license.config.ts`

Tác động:

- app có thể nói chuyện với authority khác với kỳ vọng
- nếu kết hợp với trust material bị thay, hệ thống có thể tin vào một chuỗi cấp phép khác

Mức độ:

- cao

### 5.4 Higher-level enforcement bypass

Mô tả:

- patch middleware hoặc helper phía trên

Liên quan code:

- `packages/cli/src/controller.registry.ts`
- `packages/@n8n/backend-common/src/license-state.ts`

Tác động:

- mở một nhóm route
- làm business logic nhầm rằng feature đã được cấp phép

Mức độ:

- cao, nhưng vẫn là lớp phía trên trust anchor

### 5.5 UI state spoofing

Mô tả:

- sửa response `settings.enterprise.*` hoặc state frontend

Tác động:

- UI hiện feature
- có thể gây nhầm lẫn cho người dùng

Mức độ:

- thấp về mặt security boundary

---

## 6. Mức độ nguy hiểm theo thứ tự

Nếu xếp theo mức "nếu bị sửa thì hệ thống mất ý nghĩa nhanh nhất", thứ tự hợp lý là:

1. `@n8n_io/license-sdk` / verification path / trust material
2. `packages/cli/src/license.ts`
3. `packages/@n8n/backend-common/src/license-state.ts`
4. `packages/cli/src/controller.registry.ts`
5. `packages/cli/src/services/frontend.service.ts`

Ý nghĩa:

- Lớp càng gần trust anchor thì càng nguy hiểm.
- Lớp càng lên cao thì càng dễ patch cục bộ hơn, nhưng không định nghĩa lại "sự thật" một cách nền tảng.

---

## 7. Điều gì đúng, điều gì chưa đủ trong nhận định kỹ thuật

### 7.1 Nhận định đúng

Nhận định sau là đúng:

- SDK là nơi verify sự thật của license
- khi SDK chạy trên máy do attacker kiểm soát, trust anchor địa phương có thể bị tamper
- frontend không phải chốt chặn cuối
- middleware chỉ là enforcement layer, không phải authority gốc

### 7.2 Điều cần nói chính xác hơn

Nói "SDK là điểm yếu dễ tấn công nhất" cần được đặt trong đúng ngữ cảnh:

- đúng nếu đang nói về **attacker có quyền sửa runtime**
- không đúng nếu đang nói về **remote attacker không có foothold**

Đây là sai lầm thường gặp trong security review:

- trộn lẫn "dễ tamper sau khi đã có shell" với "dễ bị khai thác từ xa"

Senior-level analysis luôn phải chỉ rõ attacker cần những quyền gì trước khi abuse.

---

## 8. Bài học kiến trúc quan trọng

### 8.1 Local license enforcement không phải anti-tamper tuyệt đối

Bất kỳ cơ chế cấp phép nào chạy hoàn toàn trên máy do đối phương kiểm soát đều gặp giới hạn:

- đối phương có thể đổi code
- đối phương có thể đổi dependency
- đối phương có thể đổi config
- đối phương có thể đổi artifact build

Vì vậy, bài toán này không nên được đóng khung là:

- "làm sao để không ai patch được"

mà nên được đóng khung là:

- "làm sao để patching trở nên đắt đỏ"
- "làm sao để giá trị của patching giảm xuống"
- "làm sao để server-side vẫn giữ được một phần authority"

### 8.2 Trust anchor cần được gọi tên rõ ràng

Một security engineer tốt luôn chỉ ra:

- trust anchor nằm ở đâu
- authority nằm ở đâu
- asset nào thực sự được bảo vệ
- lớp nào chỉ là consumer của trust đó

Trong case này:

- trust anchor: verification path + trust material + trusted authority configuration
- consumer layers: license service, license state, middleware, frontend

### 8.3 "Có ký số" không đồng nghĩa "an toàn tuyệt đối"

Chữ ký số chỉ bảo vệ được nếu:

- verifier không bị sửa
- trust store không bị sửa
- nguồn authority không bị đổi

Nếu cả ba thứ này đều nằm trên host do đối phương kiểm soát, chữ ký số vẫn chỉ còn ý nghĩa một phần.

---

## 9. Hardening recommendations

Không có giải pháp ma thuật, nhưng có thể nâng chi phí tấn công.

### 9.1 Giảm giá trị của local-only enforcement

- chuyển một phần authority sang server-side nếu có thể
- tránh để toàn bộ enterprise entitlement chỉ được quyết định bởi local runtime
- với những tính năng giá trị cao, cần có thành phần xác nhận từ phía dịch vụ do n8n kiểm soát

### 9.2 Tăng integrity assurance cho artifact

- ký image
- xác minh provenance của build
- SBOM
- checksum verification trong CI/CD
- policy chặn image không được ký

### 9.3 Tamper evidence thay vì chỉ tamper resistance

- phát hiện state bất thường
- phát hiện cert/entitlement transitions phi lý
- phát hiện host nói với endpoint cấp phép khác thông lệ
- thu telemetry và anomaly detection

### 9.4 Hạn chế config drift ở trust boundary

- kiểm soát chặt các biến môi trường liên quan license
- audit thay đổi `N8N_LICENSE_SERVER_URL`
- audit artifact distribution
- coi private package và build pipeline là tài sản nhạy cảm

### 9.5 Defense in depth

- route-level enforcement
- service-level enforcement
- quota-level enforcement
- audit logging
- telemetry

Không lớp nào một mình đủ, nhưng tổng hợp nhiều lớp sẽ tăng chi phí tấn công.

---

## 10. Framework tư duy cho Security Dev hướng tới Senior

Nếu muốn nâng cấp cách phân tích, hãy tự hỏi 10 câu sau:

1. Asset thực sự đang được bảo vệ là gì?
2. Trust anchor nằm ở đâu?
3. Authority nằm ở local hay remote?
4. Attacker model cụ thể là ai?
5. Attacker cần quyền gì trước khi abuse?
6. Đâu là exploit từ xa, đâu là tamper sau khi đã có foothold?
7. Lớp nào là source of truth, lớp nào chỉ là consumer?
8. Nếu verifier bị sửa, chữ ký còn ý nghĩa gì?
9. Nếu host không đáng tin, còn gì có thể đẩy authority về server-side?
10. Rủi ro còn lại được chấp nhận hay cần thay đổi kiến trúc?

Nếu trả lời rõ 10 câu này, bạn đã đang phân tích ở mức Senior hơn rất nhiều.

---

## 11. Code references cần đọc lại

- `packages/cli/src/license.ts`
- `packages/@n8n/backend-common/src/license-state.ts`
- `packages/cli/src/controller.registry.ts`
- `packages/@n8n/decorators/src/controller/licensed.ts`
- `packages/cli/src/services/frontend.service.ts`
- `packages/@n8n/config/src/configs/license.config.ts`

---

## 12. Tổng kết

Nhận định "điểm yếu chí mạng nhất nằm ở `@n8n_io/license-sdk`" là **đúng trong attacker model attacker sửa được runtime**.

Nhận định đó không nên được diễn đạt thành:

- "remote attacker có thể đánh thẳng vào SDK"

mà nên được diễn đạt thành:

- "khi đối phương kiểm soát host/container/runtime, trust anchor local có thể bị thay đổi; do đó SDK verification path trở thành điểm chí mạng nhất của mô hình cấp phép local"

Đó là cách diễn đạt vững hơn, chính xác hơn, và gần với tư duy của một Senior Security Dev.

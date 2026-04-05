# Chạy n8n từ mã nguồn ở local

Tài liệu này gom lại các cách chạy `n8n` từ mã nguồn trong repo này, theo hướng thực dụng:

- cần gì để chạy
- nên dùng cách nào trong từng tình huống
- lệnh cụ thể
- URL nào nên mở
- khi nào phải `build` lại
- cách giữ dữ liệu local riêng để test cho sạch

Tài liệu này bám theo:

- [`CONTRIBUTING.md`](/Applications/n8n/n8n/CONTRIBUTING.md)
- [`package.json`](/Applications/n8n/n8n/package.json)
- [`packages/cli/package.json`](/Applications/n8n/n8n/packages/cli/package.json)
- [`packages/frontend/editor-ui/package.json`](/Applications/n8n/n8n/packages/frontend/editor-ui/package.json)
- [`docker/images/n8n/README.md`](/Applications/n8n/n8n/docker/images/n8n/README.md)

## 1. Tổng quan nhanh

Nếu chỉ cần một rule of thumb:

- Muốn chạy nhanh một instance local gần giống production: dùng `pnpm build > build.log 2>&1` rồi `pnpm start`
- Muốn sửa backend và frontend trong lúc dev: chạy 2 terminal, một cho `packages/cli`, một cho `packages/frontend/editor-ui`
- Muốn dev nhanh nhưng đỡ tốn tài nguyên hơn `pnpm dev`: dùng `pnpm dev:be` hoặc `pnpm dev:fe`
- Muốn test trong môi trường sạch, gần thực tế nhiều cấu hình DB/queue: dùng stack local qua `n8n-containers`
- Muốn chạy runtime bằng container thay vì source: dùng Docker hoặc Dev Container

## 2. Yêu cầu môi trường

### Node.js

`CONTRIBUTING.md` khuyên dùng:

- `Node.js 24+`

Repo hiện cũng khai báo trong [`package.json`](/Applications/n8n/n8n/package.json):

- `node >= 22.16`

Khuyến nghị thực tế:

- nếu bắt đầu mới, dùng `Node 24`
- nếu máy bạn đang ở `22.16+`, nhiều trường hợp vẫn chạy được, nhưng khi gặp lỗi lạ trong dev thì nên nâng lên `24`

### pnpm

Repo đang pin:

- `pnpm@10.32.1`

Nên bật qua `corepack`:

```bash
corepack enable
corepack prepare pnpm@10.32.1 --activate
```

### Build tools

Trên macOS thường không cần cài thêm.

Trên Linux/Windows, xem thêm phần `Build tools` trong [`CONTRIBUTING.md`](/Applications/n8n/n8n/CONTRIBUTING.md).

## 3. Chuẩn bị lần đầu

Chạy từ root repo:

```bash
cd /Applications/n8n/n8n
pnpm install
pnpm build > build.log 2>&1
tail -n 20 build.log
```

Ý nghĩa:

- `pnpm install`: cài và link toàn bộ workspace
- `pnpm build > build.log 2>&1`: build toàn repo, đúng chuẩn repo này
- `tail -n 20 build.log`: xem nhanh build có fail hay không

Nếu build lỗi, đọc tiếp:

```bash
tail -n 50 build.log
```

## 4. Cách 1: Chạy nhanh một local instance gần production nhất

Đây là cách tốt nhất nếu bạn:

- chỉ cần app chạy ổn ở local
- muốn mở UI nhanh ở `localhost:5678`
- không cần hot reload frontend/backend ngay lập tức

Lệnh:

```bash
cd /Applications/n8n/n8n
pnpm build > build.log 2>&1
tail -n 20 build.log
pnpm start
```

Mở:

```text
http://localhost:5678
```

Đặc điểm:

- dùng bản đã build
- hành vi gần production hơn so với `dev`
- phù hợp để kiểm tra flow tổng thể, auth, enterprise flags, API, UI cơ bản

Lưu ý:

- nếu bạn sửa TypeScript source, thường phải `build` lại rồi restart
- `pnpm start` không phải là hot reload fullstack

## 5. Cách 2: Dev fullstack chuẩn nhất với 2 terminal

Đây là cách được dùng nhiều nhất khi sửa cả backend lẫn frontend.

### Terminal 1: backend

```bash
pushd /Applications/n8n/n8n/packages/cli
pnpm dev
```

### Terminal 2: frontend

```bash
pushd /Applications/n8n/n8n/packages/frontend/editor-ui
pnpm dev
```

URL nên mở:

- `http://localhost:8080`

Backend API vẫn chạy ở:

- `http://localhost:5678`

### Tại sao cần 2 terminal?

Vì đây là 2 process khác nhau:

- `packages/cli` chạy backend Node.js, watch TypeScript, restart server
- `packages/frontend/editor-ui` chạy Vite dev server cho UI

### Khác nhau giữa `:5678` và `:8080`

`http://localhost:5678`

- backend n8n đang tự serve UI
- phù hợp khi bạn không cần frontend HMR
- thường dùng để xem hành vi “app đã build”

`http://localhost:8080`

- frontend chạy bằng Vite dev server
- đổi file Vue/TS frontend sẽ reload nhanh hơn
- frontend gọi API về backend ở `http://localhost:5678/`

Khuyến nghị:

- đang sửa UI: mở `:8080`
- đang chỉ kiểm tra backend đã build: mở `:5678`

## 6. Cách 3: Dev toàn repo từ root

Nếu muốn để turbo tự watch nhiều package cùng lúc:

```bash
cd /Applications/n8n/n8n
pnpm dev
```

Cách này:

- tự chạy nhiều process song song
- tiện khi bạn thay đổi nhiều package
- nhưng nặng máy hơn đáng kể

Khi nên dùng:

- bạn đang sửa cross-package
- bạn không muốn tự mở nhiều terminal package-level

Khi không nên dùng:

- máy yếu
- bạn chỉ sửa backend hoặc chỉ sửa frontend
- bạn muốn tập trung vào một vùng nhỏ của repo

## 7. Cách 4: Chỉ dev backend

Nếu bạn chủ yếu sửa API, controller, service, DB, middleware:

```bash
cd /Applications/n8n/n8n
pnpm dev:be
```

Hoặc chạy trực tiếp trong package:

```bash
pushd /Applications/n8n/n8n/packages/cli
pnpm dev
```

URL:

- thường dùng `http://localhost:5678`

Khi nên dùng:

- sửa backend
- debug license state, middleware, service logic
- không cần Vite frontend riêng

## 8. Cách 5: Chỉ dev frontend

Nếu bạn chỉ sửa UI, component, route, modal, paywall, settings page:

### Cách nhẹ

Terminal 1:

```bash
cd /Applications/n8n/n8n
pnpm start
```

Terminal 2:

```bash
pushd /Applications/n8n/n8n/packages/frontend/editor-ui
pnpm dev
```

Mở:

- `http://localhost:8080`

Hoặc từ root:

```bash
cd /Applications/n8n/n8n
pnpm dev:fe
```

Khi nên dùng:

- backend không đổi nhiều
- bạn chỉ cần frontend HMR
- muốn giảm tải hơn so với `pnpm dev`

## 9. Cách 6: Dev AI/LangChain packages

Repo có script riêng:

```bash
cd /Applications/n8n/n8n
pnpm dev:ai
```

Cách này chỉ chạy nhóm package cần thiết cho AI node development.

## 10. Cách 7: Dev có `.env.local`

Nếu muốn local config rõ ràng hơn, tạo file môi trường riêng:

```bash
cd /Applications/n8n/n8n
cp .env.local.example .env.local
```

Sau đó chạy command với `dotenvx`:

```bash
cd /Applications/n8n/n8n
pnpm exec dotenvx run -f .env.local -- pnpm dev:be
```

Hoặc:

```bash
cd /Applications/n8n/n8n
pnpm exec dotenvx run -f .env.local -- pnpm start
```

Lưu ý:

- dùng `$HOME`, không dùng `~` trong `.env.local`
- ví dụ đúng:

```bash
N8N_USER_FOLDER=$HOME/.n8n-dev-lab
```

## 11. Cách 8: Chạy với user folder riêng để giữ dữ liệu sạch

Đây là cách rất nên dùng nếu bạn:

- không muốn đụng dữ liệu `~/.n8n` hiện có
- muốn tạo nhiều local instance test song song
- muốn test feature trên database sạch

Ví dụ:

```bash
pushd /Applications/n8n/n8n/packages/cli
N8N_USER_FOLDER=$HOME/.n8n-enterprise-lab pnpm dev
```

Hoặc:

```bash
cd /Applications/n8n/n8n
N8N_USER_FOLDER=$HOME/.n8n-enterprise-lab pnpm start
```

Bạn có thể tạo nhiều folder khác nhau:

- `$HOME/.n8n-dev-a`
- `$HOME/.n8n-dev-b`
- `$HOME/.n8n-enterprise-lab`

Khi nào nên dùng:

- test onboarding từ đầu
- test settings/credentials/workflows riêng biệt
- tránh làm bẩn local instance đang dùng hằng ngày

## 12. Cách 9: Dev package cụ thể, không cần watch toàn repo

### Ví dụ: sửa `nodes-base`

Terminal 1:

```bash
pushd /Applications/n8n/n8n/packages/nodes-base
pnpm dev
```

Terminal 2:

```bash
pushd /Applications/n8n/n8n/packages/cli
N8N_DEV_RELOAD=true pnpm dev
```

### Ví dụ: watch package node cụ thể

Terminal 1:

```bash
pushd /Applications/n8n/n8n/packages/nodes-base
pnpm watch
```

Terminal 2:

```bash
pushd /Applications/n8n/n8n/packages/cli
N8N_DEV_RELOAD=true pnpm dev
```

Ý nghĩa của `N8N_DEV_RELOAD=true`:

- hỗ trợ hot reload tốt hơn khi phát triển nodes/credentials
- đổi file có thể được phát hiện mà không cần restart thủ công quá nhiều

Đổi lại:

- watcher tốn CPU/RAM hơn

## 13. Cách 10: Chạy local stack nhiều cấu hình bằng `n8n-containers`

Đây không phải cách “chạy source trực tiếp” thuần nhất, nhưng rất hữu ích để test local trong nhiều cấu hình runtime.

### Bước 1: chuẩn bị image

Từ source hiện tại:

```bash
cd /Applications/n8n/n8n
pnpm build:docker
```

Hoặc dùng image có sẵn:

```bash
N8N_DOCKER_IMAGE=n8nio/n8n:latest
```

### Bước 2: chạy stack

SQLite:

```bash
cd /Applications/n8n/n8n
pnpm --filter n8n-containers stack:sqlite
```

Postgres:

```bash
cd /Applications/n8n/n8n
pnpm --filter n8n-containers stack:postgres
```

Queue:

```bash
cd /Applications/n8n/n8n
pnpm --filter n8n-containers stack:queue
```

Multi-main:

```bash
cd /Applications/n8n/n8n
pnpm --filter n8n-containers stack:multi-main
```

Khi nên dùng:

- test PostgreSQL thay vì SQLite
- test queue mode
- test nhiều main/worker
- kiểm tra hành vi gần production hơn

## 14. Cách 11: Chạy bằng Docker runtime

Nếu mục tiêu là chạy app nhanh bằng container, không cần dev source trực tiếp:

```bash
docker volume create n8n_data

docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

Mở:

- `http://localhost:5678`

Khi nên dùng:

- muốn một môi trường sạch, dễ reset
- không cần watch source
- muốn đối chiếu hành vi runtime với bản source local

Khi không nên dùng:

- bạn đang sửa code trong repo liên tục
- bạn cần debug source TypeScript frontend/backend nhanh

## 15. Cách 12: Dùng Dev Container

Nếu bạn dùng VS Code + Docker, `CONTRIBUTING.md` có luồng Dev Container.

Phù hợp khi bạn muốn:

- cô lập môi trường dev
- tránh cài nhiều dependency trực tiếp lên máy host
- giữ môi trường nhất quán hơn giữa các máy

Nhược điểm:

- nặng hơn so với chạy source native
- file watching có thể chậm hơn tuỳ setup

## 16. Nên dùng cách nào?

### Muốn app chạy ngay để khám phá UI/API

Chọn:

- `pnpm build > build.log 2>&1`
- `pnpm start`

### Muốn sửa backend và frontend song song

Chọn:

- `packages/cli -> pnpm dev`
- `packages/frontend/editor-ui -> pnpm dev`

### Muốn chỉ sửa backend

Chọn:

- `pnpm dev:be`

### Muốn chỉ sửa frontend

Chọn:

- backend chạy `pnpm start`
- frontend chạy `packages/frontend/editor-ui -> pnpm dev`

### Muốn môi trường test sạch, không đụng dữ liệu cũ

Chọn:

- `N8N_USER_FOLDER=$HOME/.n8n-something`

### Muốn test Postgres/queue/multi-main

Chọn:

- `pnpm --filter n8n-containers stack:*`

### Muốn chỉ chạy runtime container

Chọn:

- Docker

## 17. Khi nào phải build lại?

Bạn thường phải `build` lại khi:

- đang chạy `pnpm start`
- đã sửa TypeScript source nhưng app không phản ánh thay đổi
- bạn vừa đổi code ngoài phạm vi watcher hiện tại
- bạn vừa đổi package shared mà backend/frontend đang dùng

Lệnh chuẩn:

```bash
cd /Applications/n8n/n8n
pnpm build > build.log 2>&1
tail -n 20 build.log
```

Sau đó restart process đang chạy.

## 18. Cách debug khi app không phản ánh code mới

Checklist ngắn:

1. Bạn đang chạy `pnpm start` hay `pnpm dev`?
2. Nếu là `pnpm start`, bạn đã `build` lại chưa?
3. Bạn đang mở `:5678` hay `:8080`?
4. Nếu sửa frontend mà mở `:5678`, có thể bạn đang nhìn bản UI đã build thay vì Vite dev server
5. Nếu sửa backend nhưng chỉ restart frontend, backend sẽ không đổi

## 19. Các URL nên nhớ

- App/backend tiêu chuẩn: `http://localhost:5678`
- Frontend dev server: `http://localhost:8080`

Rule of thumb:

- `:5678` là backend n8n
- `:8080` là frontend dev server

## 20. Một luồng local tối ưu để nghiên cứu source

Nếu mục tiêu là đọc code, test behavior, và debug nhanh:

### Cách gọn nhất

```bash
cd /Applications/n8n/n8n
pnpm install
pnpm build > build.log 2>&1
tail -n 20 build.log
pnpm start
```

### Cách tốt nhất để debug fullstack

Terminal 1:

```bash
pushd /Applications/n8n/n8n/packages/cli
pnpm dev
```

Terminal 2:

```bash
pushd /Applications/n8n/n8n/packages/frontend/editor-ui
pnpm dev
```

Mở:

- `http://localhost:8080`

Nếu muốn giữ instance sạch:

```bash
pushd /Applications/n8n/n8n/packages/cli
N8N_USER_FOLDER=$HOME/.n8n-enterprise-lab pnpm dev
```

## 21. Ghi chú cuối

- Trong repo này, frontend editor nằm ở `packages/frontend/editor-ui`
- Một số tài liệu cũ có thể ghi ngắn là `packages/editor-ui`, nhưng khi chạy lệnh bạn nên dùng đúng path thật trong repo hiện tại
- Khi nghi ngờ app đang chạy code cũ, hãy ưu tiên kiểm tra lại `build`, `restart`, và URL bạn đang mở trước

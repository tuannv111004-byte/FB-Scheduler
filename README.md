# PostOps

PostOps là một dashboard frontend để quản lý lịch đăng bài cho nhiều Facebook Page. Dự án được xây bằng Next.js App Router, TypeScript, Tailwind CSS v4, bộ UI theo `shadcn/ui` + Radix, và quản lý state bằng `zustand`.

Hiện tại project hoạt động như một UI prototype/local app:

- Dữ liệu được lấy từ `lib/mock-data.ts`
- State dùng store trong bộ nhớ tại `lib/store.ts`
- Chưa có backend, database, authentication, upload media thật hay đồng bộ với Facebook API

## Tính năng chính

- Dashboard tổng quan số lượng page active, bài đăng trong ngày, bài đã đăng, bài trễ và slot còn trống
- Quản lý Facebook Page: thêm, sửa, bật/tắt hoạt động, xoá page
- Quản lý Post: tạo, sửa, nhân bản, xoá, lọc theo ngày/page/trạng thái, đánh dấu đã đăng
- Schedule board theo ngày và khung giờ để nhìn nhanh slot trống, slot trễ, bài cần đăng
- Notifications cho các bài trễ, slot thiếu, trạng thái hệ thống
- Trang settings ở mức giao diện để mô phỏng cấu hình

## Công nghệ sử dụng

- `Next.js 16` với App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `shadcn/ui` + `Radix UI`
- `zustand` cho client state
- `date-fns` cho xử lý ngày giờ
- `lucide-react` cho icon
- `@vercel/analytics` cho analytics ở môi trường production

## Cài đặt và chạy local

Yêu cầu:

- Node.js 20+ khuyến nghị
- `pnpm` khuyến nghị vì repo đang dùng `pnpm-lock.yaml`

Chạy project:

```bash
pnpm install
```

Mở trình duyệt tại `http://localhost:3000`.

Các script có sẵn:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## Cấu trúc project

```text
.
|- app/
|  |- page.tsx                 # Dashboard
|  |- pages/page.tsx           # Quản lý Facebook pages
|  |- posts/page.tsx           # Quản lý posts
|  |- schedule/page.tsx        # Lịch đăng theo ngày/slot
|  |- notifications/page.tsx   # Danh sách cảnh báo/thông báo
|  |- settings/page.tsx        # Giao diện cài đặt
|  |- layout.tsx               # Metadata, layout gốc, analytics
|  |- globals.css              # Theme và token giao diện
|- components/
|  |- dashboard/               # Widget tổng quan trang chủ
|  |- notifications/           # UI danh sách notifications
|  |- pages/                   # Danh sách + modal quản lý page
|  |- posts/                   # Danh sách + modal quản lý post
|  |- schedule/                # Bảng lịch đăng
|  |- ui/                      # Bộ component UI tái sử dụng
|  |- header.tsx               # Header dùng chung
|  |- sidebar.tsx              # Sidebar desktop
|  |- mobile-sidebar.tsx       # Sidebar mobile
|  |- status-badge.tsx         # Badge trạng thái bài đăng
|- hooks/                      # Custom hooks phụ trợ
|- lib/
|  |- mock-data.ts             # Dữ liệu mẫu
|  |- store.ts                 # Zustand store và actions
|  |- types.ts                 # Kiểu dữ liệu domain
|  |- utils.ts                 # Helper utilities
|- public/                     # Icon và ảnh placeholder
|- components.json             # Cấu hình shadcn/ui
|- next.config.mjs             # Cấu hình Next.js
|- tsconfig.json               # Alias `@/*`
```

## Các route hiện có

- `/`: dashboard tổng quan lịch đăng trong ngày
- `/pages`: quản lý danh sách Facebook page
- `/posts`: quản lý bài đăng theo ngày
- `/schedule`: bảng lịch đăng theo slot thời gian
- `/notifications`: danh sách cảnh báo và thông báo
- `/settings`: giao diện cài đặt

## Luồng dữ liệu hiện tại

Store chính nằm ở `lib/store.ts`.

- `pages`: danh sách page
- `posts`: danh sách bài đăng
- `notifications`: thông báo hệ thống
- `selectedDate`: ngày đang được chọn để filter dữ liệu

Các thao tác chính:

- Quản lý page: `addPage`, `updatePage`, `deletePage`, `togglePageActive`
- Quản lý post: `addPost`, `updatePost`, `deletePost`, `duplicatePost`, `markAsPosted`, `updatePostStatus`
- Quản lý notification: `markNotificationRead`, `markAllNotificationsRead`, `clearNotifications`

Vì store chỉ nằm ở client memory, reload trang sẽ trả dữ liệu về trạng thái mock ban đầu.

## Ghi chú kỹ thuật đáng chú ý

- `next.config.mjs` đang bật `typescript.ignoreBuildErrors = true`, nghĩa là build có thể vẫn chạy dù còn lỗi TypeScript. Đây là cấu hình cần lưu ý nếu muốn đưa dự án lên production nghiêm túc.
- `images.unoptimized = true`, nên ảnh đang không đi qua pipeline tối ưu của Next Image.
- `app/layout.tsx` chỉ mount `@vercel/analytics` khi `NODE_ENV === "production"`.
- Theme hiện được định nghĩa qua CSS variables trong `app/globals.css`, với giao diện tông tối là mặc định.

## Hướng mở rộng hợp lý

- Kết nối database thật để lưu page/post/notification
- Thêm authentication và phân quyền người dùng
- Đồng bộ với Facebook Graph API hoặc một scheduler backend riêng
- Upload ảnh thật thay cho `picsum.photos`
- Thêm validation/business rules cho time slots, tránh trùng lịch
- Bổ sung test cho store và các flow CRUD chính

## File nên đọc đầu tiên nếu muốn tiếp tục phát triển

- `package.json`: scripts và dependencies
- `app/page.tsx`: entry dashboard
- `lib/store.ts`: logic state trung tâm
- `lib/mock-data.ts`: dữ liệu mẫu và ngữ cảnh domain
- `components/schedule/schedule-board.tsx`: màn hình nghiệp vụ quan trọng nhất
- `components/posts/posts-list.tsx` và `components/pages/pages-list.tsx`: flow CRUD chính

# Update v1.1

## Tong quan

Ban cap nhat nay tap trung vao 3 phan chinh:
- bo sung khu vuc `Notes` dang sticky note va luu that vao Supabase
- cai thien trai nghiem trang `/posts` voi filter duoc ghi nho local
- dieu chinh `Daily Schedule` theo thu tu slot co dinh, trong do `04:00` nam o cuoi va duoc tinh la ngay ke tiep

## Thay doi chinh

### 1. Notes board moi
- Tao route `/notes` thanh sticky-notes board thay vi trang trong
- Moi note co:
  - tao moi
  - sua
  - xoa co canh bao xac nhan
  - copy nhanh noi dung
  - keo tha doi thu tu
- Notes duoc luu vao Supabase bang bang `notes`
- Them CRUD helper cho notes trong `lib/supabase.ts`
- Them type `NoteInput` va `StickyNote` trong `lib/types.ts`

### 2. Supabase schema cho notes
- Them bang `notes`
- Them index `sort_order`
- Bat RLS
- Them policy `select / insert / update / delete` cho `anon`

Luu y:
- Muon `/notes` hoat dong day du thi can chay phan schema moi tren Supabase

### 3. Cai thien UI/UX Notes
- Note dai trong board co vung cuon rieng
- Modal `Edit Note` duoc tang chieu cao va co cuon
- Drag note da doi sang kieu custom:
  - khong con ghost image mo cua browser
  - card that di theo con tro
  - khong bi boi den text khi keo
- Them motion nhe cho card de board bot tinh

### 4. Ghi nho trang thai trong /posts
- Luu localStorage cho:
  - `selectedDate`
  - `filterPage`
  - `filterStatus`
  - `searchQuery`
  - `zoomImagesOnHover`
- Chinh cach khoi tao state theo pattern doc localStorage ngay trong `useState`
- Tach `selectedDate` cua `/posts` thanh state local cua man nay

### 5. Daily Schedule duoc sap xep lai
- `Daily Schedule` hien thi theo thu tu co dinh:
  - `08:00`
  - `15:00`
  - `20:00`
  - `23:00`
  - `04:00 (+1d)`
- Slot `04:00` duoc xem la cua ngay tiep theo:
  - doc post tu `selectedDate + 1`
  - tao post moi tai slot nay cung mo dung ngay tiep theo

## File da anh huong
- `app/notes/page.tsx`
- `components/notes/note-modal.tsx`
- `components/notes/notes-board.tsx`
- `components/posts/posts-list.tsx`
- `components/schedule/schedule-board.tsx`
- `lib/supabase.ts`
- `lib/types.ts`
- `supabase/schema.sql`

## Ghi chu
- Da tung thu drag/swap post trong `/posts` nhung da go bo lai
- Notes hien tai can Supabase de luu du lieu that

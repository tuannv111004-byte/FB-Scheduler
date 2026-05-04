# Update v1.5

## Overview

This update focuses on faster post production and safer data movement:
- added bulk post scheduling from `.zip` and `.rar` image archives
- improved post image handling, paste workflow, filters, and slot highlights
- added full Supabase backup/import from Settings
- improved TMDb crawl reset and page initialization behavior

## Main Changes

### 1. Bulk archive post scheduling
- Post creation modal now supports uploading `.zip` or `.rar` archives.
- Extracted images are scheduled automatically into empty slots for the selected page.
- Scheduling starts from the selected date and selected time slot.
- Existing non-skipped posts are treated as occupied slots and are skipped.
- Each created post stores a note with the source archive and image filename.
- Bulk scheduling requires Supabase storage because images are uploaded before posts are created.

### 2. Archive extraction API
- Added `/api/posts/extract-archive`.
- Server-side extraction supports:
  - `.zip` through `jszip`
  - `.rar` through `unrar-js`
- Supported image extensions:
  - `.jpg`
  - `.jpeg`
  - `.png`
  - `.webp`
  - `.gif`
- Extracted images are sorted naturally by filename before scheduling.

### 3. Shared post image processing
- Moved 1080x1350 image normalization into `lib/post-image-processing.ts`.
- Reused the same crop/fit/focus behavior for:
  - normal single post upload
  - image URL processing
  - pasted images
  - bulk archive images
- Image helpers now live outside the modal so future workflows can reuse them.

### 4. Post modal paste workflow
- Pasting an image still attaches it to the post.
- Pasting an image URL fills the Image URL field and checks dimensions.
- Pasting a regular URL fills the Ads Link field.
- Pasting plain text fills the Caption field.
- Caption is no longer required, which allows image-only scheduled posts.

### 5. `/posts` filtering and ordering
- Posts are now sorted by scheduled date, time slot, and creation time.
- Added time-slot filter with multi-select support.
- Added multi-select highlight target times.
- Highlight settings are saved in local preferences.
- Special next-day `04:00` slots are displayed with `(+1d)` where applicable.

### 6. Data import/export
- Settings now includes `Data Import / Export`.
- Export creates a full PostOps JSON backup.
- Backup includes:
  - pages
  - vias
  - page_vias
  - posts
  - notes
  - sources
  - Poster Lab franchises
  - Poster Lab sequels
- Import supports:
  - `Merge`: upserts rows by ID
  - `Replace`: deletes current Supabase rows before restoring the backup
- Import validates the backup format before writing data.

### 7. Supabase storage setup
- Schema now creates the `post-images` storage bucket when possible.
- Added storage policies for public read, insert, update, and delete on `post-images`.
- This supports uploaded post images and bulk archive scheduling.

### 8. Poster Lab and page fixes
- Added `Reset Crawl` for TMDb crawl results and selected candidates.
- Pages list now initializes app data if it opens before the store is ready.
- Schedule board empty-slot styling was adjusted for lower visual weight.

## Files Added
- `app/api/posts/extract-archive/route.ts`
- `lib/bulk-archive-scheduling.ts`
- `lib/data-transfer.ts`
- `lib/post-image-processing.ts`
- `types/unrar-js.d.ts`
- `update v1.5.md`

## Files Updated
- `app/settings/page.tsx`
- `components/pages/pages-list.tsx`
- `components/poster-lab/poster-lab-manager.tsx`
- `components/posts/post-modal.tsx`
- `components/posts/posts-list.tsx`
- `components/schedule/schedule-board.tsx`
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `supabase/schema.sql`

## Dependencies Added
- `jszip`
- `unrar-js`

## Database Note

For existing Supabase projects:
- run the updated storage bucket and storage policy section from `supabase/schema.sql`
- make sure the `post-images` bucket exists and is public

For fresh setups:
- running the full `supabase/schema.sql` file is enough.

## Verification

- `npm.cmd run build` passes.

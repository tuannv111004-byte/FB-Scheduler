# Update v1.6

## Overview

This update connects Composer, the Daily Feji extension, and Scheduler more tightly:
- one-click extension launch from Composer
- Scheduler result import by `schedulerPostId`
- Daily-hosted article images with safe Supabase cleanup
- Composer autosave with IndexedDB
- Next.js security patch update

## Main Changes

### 1. Composer to extension one-click flow
- Added an **Extension** button in Composer.
- Composer sends generated JSON directly to the Chrome extension through a content-script bridge.
- The extension can start the Daily/Feji batch without manually copying JSON into the popup.
- Composer now sends the current app origin as the Scheduler URL automatically.
- The extension import token and target status are configurable in Composer and persisted locally.

### 2. Extension bridge
- Added `Extension/scheduler-bridge.js`.
- The bridge listens for Composer messages and forwards them to the extension background worker.
- `manifest.json` now injects the bridge into web pages so the Scheduler app can trigger extension work.

### 3. Scheduler import by post ID
- `/api/extension/daily-results` now updates posts directly by `schedulerPostId` when every item has one.
- Page/date/start-time lookup is only needed for legacy items without `schedulerPostId`.
- Error messages now identify missing post IDs in the current Scheduler database.
- This supports one JSON containing posts from many pages and time slots.

### 4. Daily image upload and Supabase cleanup
- The extension uploads description images to Daily through Daily's presigned upload API.
- Saved Daily articles use `blog.igallery.blog/assets/...` URLs instead of Supabase URLs.
- The extension sends temporary description image URLs back as `cleanupImageUrls`.
- Scheduler deletes only safe temporary Supabase description images after successful import.
- `post.image_url` is protected and is never deleted, so thumbnails remain intact.

### 5. Composer autosave and reset
- Composer drafts, import text, filters, and selected scheduled posts are autosaved.
- Autosave now uses IndexedDB to avoid `localStorage` quota errors for large article HTML.
- Added a **Reset** button to clear Composer draft/autosave state.
- Extension token/status config remains separate and is not cleared by draft reset.

### 6. TinyMCE type fix
- Removed the unsupported `tinymce` prop from the TinyMCE React component.
- Kept TinyMCE loaded through side-effect imports.

### 7. Dependency update
- Updated Next.js from `16.2.4` to `16.2.6`.
- This resolves the high-severity Next.js audit findings.
- Remaining moderate audit findings are from nested Next/PostCSS audit metadata and should not be fixed by the suggested forced downgrade.

## Files Added
- `Extension/scheduler-bridge.js`
- `update v1.6.md`

## Files Updated
- `Extension/background.js`
- `Extension/manifest.json`
- `app/api/extension/daily-results/route.ts`
- `components/composer/article-composer.tsx`
- `components/composer/tinymce-html-editor.tsx`
- `package.json`
- `package-lock.json`

## Verification

- `node --check Extension/background.js` passes.
- `node --check Extension/scheduler-bridge.js` passes.
- `npm.cmd run build` passes.

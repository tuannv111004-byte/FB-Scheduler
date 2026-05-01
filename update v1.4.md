# Update v1.4

## Overview

This update improves daily production workflow across `Poster Lab` and `/posts`:
- expanded Poster Lab into a faster cached workspace
- added ChatGPT title-only sequel batch import
- improved Random tab persistence and layout
- improved `/posts` filtering and time-slot visibility

## Main Changes

### 1. Poster Lab local cache
- Added stale-while-revalidate style local cache for Poster Lab data.
- `/poster-lab` now renders cached data immediately when revisiting the page.
- Supabase and TMDb still refresh in the background and remain the source of truth.
- Cached data includes:
  - franchises
  - fake sequels
  - TMDb genres
  - cache timestamp

### 2. Poster Lab tab and random persistence
- Poster Lab now remembers the active tab:
  - `Manage`
  - `Generate`
  - `Random`
- Random tab now remembers the last selected random sequel.
- Returning to `/poster-lab` restores the same tab and random selection when possible.

### 3. Random tab layout update
- Random tab now shows original movie metadata beside the random fake sequel card.
- Original movie block includes:
  - TMDb poster
  - franchise/movie name
  - latest official title
  - genre/source/release date
  - overview
  - TMDb genre tags
- Other sequels for the same movie are shown inside the original movie block.
- Random fake sequel remains a separate large card.

### 4. Copy workflow improvement
- Copying a Poster Lab idea now automatically marks that sequel as used.
- UI updates immediately after the copy/save status change.

### 5. ChatGPT title-only sequel generation
- ChatGPT batch prompt was simplified to return sequel titles only.
- Supported JSON format:
  - `{ "Movie Title": "Sequel Title" }`
  - `{ "Movie Title": ["Sequel Title 1", "Sequel Title 2"] }`
- Import now accepts this title-only JSON format and maps movie keys back to saved franchises.

### 6. Poster Lab caption support
- Fake sequels now support a `caption` field.
- Caption can be edited in the sequel modal.
- Caption is included in copied Poster Lab ideas when present.
- Supabase schema and mapping helpers were extended for sequel captions.

### 7. TMDb crawl/import upgrades
- TMDb crawl now supports larger crawl ranges and result counts.
- Imported collection entries use the latest released movie in the collection.
- Standalone movies can be included or skipped.
- Already-imported movies can be hidden or shown.
- Crawl state is stored locally so generated candidate lists survive navigation.
- Crawl metadata now reports:
  - scanned pages
  - skipped existing movies
  - skipped standalone movies

### 8. Poster Lab management improvements
- Added tabbed layout for:
  - Manage
  - Generate
  - Random
- Added search, genre filter, source filter, pagination, and list/grid/compact layouts for franchises.
- Added clear-all movies and clear-sequels flows with confirmation dialogs.
- Manage view now shows richer selected movie metadata and attached sequel cards.

### 9. `/posts` improvements
- Page filter now supports selecting multiple pages.
- Time slots are shown as highlighted badges instead of plain text.
- Added configurable time-slot highlight window.
- Default highlight window is `+/- 30` minutes.
- Example: an `08:00` slot highlights from `07:30` to `08:30`.
- Highlight setting is saved in local preferences.

### 10. Schedule adjustment
- Schedule board handling was adjusted for special next-day slots such as `04:00`.

## Files Added
- `update v1.4.md`

## Files Updated
- `app/api/poster-lab/tmdb/discover/route.ts`
- `components/poster-lab/poster-lab-manager.tsx`
- `components/poster-lab/sequel-modal.tsx`
- `components/posts/posts-list.tsx`
- `components/schedule/schedule-board.tsx`
- `lib/poster-lab.ts`
- `lib/supabase.ts`
- `lib/types.ts`
- `supabase/schema.sql`

## Database Note

For existing Supabase projects:
- run the `poster_lab_sequels.caption` column migration if it has not been applied.

For fresh setups:
- running the full `supabase/schema.sql` file is enough.

## Verification

- `npx tsc --noEmit` passes.
- `npm run lint` could not run in this environment because `eslint` is not available.

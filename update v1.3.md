# Update v1.3

## Overview

This update expands `Poster Lab` into a practical movie intake tool:
- added TMDb-powered bulk crawl/import for real movies
- extended `Poster Lab` storage to keep movie metadata
- kept the fake sequel workflow on top of the imported real titles

## Main Changes

### 1. TMDb crawl import for `/poster-lab`
- Added a new `TMDb Crawl Import` block inside `/poster-lab`
- You can now:
  - choose a TMDb genre/category
  - choose how many TMDb pages to crawl
  - choose max result count
  - choose minimum vote count
  - choose sort order
- Crawled movies are shown in a preview table before import
- Each crawled movie can be selected individually
- Added `Select All New`
- Added `Import Selected`

### 2. Server-side TMDb integration
- Added internal API routes so the TMDb token stays on the server
- New routes:
  - `/api/poster-lab/tmdb/genres`
  - `/api/poster-lab/tmdb/discover`
- The app now fetches:
  - real TMDb genre list
  - discover/movie results by selected genre

### 3. Poster Lab metadata expansion
- Extended franchise storage to keep real movie metadata from TMDb:
  - `tmdb_movie_id`
  - `tmdb_genre_ids`
  - `tmdb_genre_names`
  - `release_date`
  - `overview`
  - `poster_path`
  - `backdrop_path`
  - `source_category`
- Imported entries use the real movie title as:
  - `franchiseName`
  - `latestOfficialTitle`

### 4. Duplicate-safe batch import
- Added bulk insert support for Poster Lab franchises
- Import now skips TMDb movies that already exist in DB
- Added a unique index for `tmdb_movie_id` to help keep imports clean

### 5. Poster Lab workflow kept intact
- Existing fake sequel flow remains usable after import
- You can still:
  - add franchise manually
  - add fake sequel manually
  - random fake sequel from full pool
  - copy idea
  - mark sequel as used / unused

## Files Added
- `app/api/poster-lab/tmdb/genres/route.ts`
- `app/api/poster-lab/tmdb/discover/route.ts`
- `lib/poster-lab.ts`
- `update v1.3.md`

## Files Updated
- `.env.example`
- `components/poster-lab/poster-lab-manager.tsx`
- `lib/types.ts`
- `lib/supabase.ts`
- `supabase/schema.sql`

## Database Note

For existing Supabase projects:
- run the new `poster_lab_franchises` column additions
- run the unique index for `tmdb_movie_id`

For fresh setups:
- running the full `supabase/schema.sql` file is enough

## Env Note

Required for TMDb crawl/import:
- `TMDB_READ_ACCESS_TOKEN`

# Update v1.2

## Overview

This update expands the internal management side of the app:
- added `Via` management with many-to-many page linking
- added `Sources` management for research/storage
- improved schedule slot ordering logic
- improved post recognition in `/posts`

## Main Changes

### 1. New `/via` management
- Added a dedicated `/via` page for storing via account data
- Each via now supports:
  - account name
  - via link
  - password
  - display name
  - 2FA
  - Outlook email
  - Outlook password
  - via email
  - avatar URL
  - status
  - location
- One via can link to multiple pages
- One page can link to multiple vias
- Added create, edit, delete flow with confirmation

### 2. Via database support
- Added `vias` table
- Added `page_vias` pivot table for many-to-many relationships
- Added `account_link` field for via profile link
- Added Supabase CRUD helpers for vias and page relationships

### 3. New `/sources` management
- Added a dedicated `/sources` page for saving information sources
- Each source supports:
  - name
  - url
  - type
  - description
  - notes
  - active status
- Added create, edit, delete flow with confirmation
- Added quick external link opening from the table

### 4. Sources database support
- Added `sources` table
- Added indexes for `type` and `is_active`
- Added Supabase CRUD helpers for sources

### 5. Sidebar navigation updates
- Added `Via` to desktop and mobile sidebar
- Added `Sources` to desktop and mobile sidebar

### 6. Daily Schedule adjustment
- Daily Schedule order is now fixed as:
  - `08:00`
  - `15:00`
  - `20:00`
  - `22:00`
  - `04:00 (+1d)`
- `04:00` is treated as the next day slot

### 7. `/posts` recognition improvement
- When interacting with a post in `/posts`, that row now becomes highlighted
- Highlight applies to actions like:
  - copy image
  - copy caption
  - copy ads link
  - mark as posted
  - edit
  - delete
  - duplicate
- Highlighted rows now have a clearer visual treatment with a left accent and separate hover style

## Files Added
- `app/via/page.tsx`
- `app/sources/page.tsx`
- `components/via/via-manager.tsx`
- `components/via/via-modal.tsx`
- `components/sources/sources-manager.tsx`
- `components/sources/source-modal.tsx`
- `update v1.2.md`

## Files Updated
- `components/sidebar.tsx`
- `components/mobile-sidebar.tsx`
- `components/posts/posts-list.tsx`
- `components/schedule/schedule-board.tsx`
- `lib/types.ts`
- `lib/supabase.ts`
- `supabase/schema.sql`

## Database Note

For existing Supabase projects:
- run only the new schema blocks for `vias`, `page_vias`, `account_link`, and `sources`

For fresh setups:
- running the full `supabase/schema.sql` file is enough

# PostOps Project Structure

This document is the maintenance map for the project. Keep it updated when adding a
new feature, route, API endpoint, extension capability, or database table.

## High-Level Layout

```text
.
|- app/                         Next.js App Router pages and API routes
|- components/                  React UI and feature components
|- hooks/                       Shared React hooks
|- lib/                         Domain types, data access, stores, utilities
|- Extension/                   Chrome extension for Daily Feji automation
|- public/                      Static assets and TinyMCE skins
|- supabase/                    Database schema and storage policies
|- types/                       Ambient TypeScript declarations
|- proxy.ts                     App access gate / middleware-like proxy
|- apps-script-webapp.gs        Google Apps Script backup receiver
```

## App Routes

### Shell and access

```text
app/layout.tsx                  Root layout, theme provider, bootstrap, analytics
app/login/page.tsx              Password login UI
proxy.ts                        Protects app routes and most API routes
```

### Main product pages

```text
app/page.tsx                    Dashboard
app/pages/page.tsx              Facebook page management
app/posts/page.tsx              Post management table
app/schedule/page.tsx           Daily schedule board
app/composer/page.tsx           Article/Daily Feji composer
app/trend-calendar/page.tsx     Event timing board
app/notes/page.tsx              Sticky notes board
app/poster-lab/page.tsx         Poster Lab
app/players/page.tsx            Sports team/player data
app/sources/page.tsx            Source/link library
app/via/page.tsx                VIA account management
app/notifications/page.tsx      Generated alerts and warnings
app/settings/page.tsx           Theme, backup, import/export settings
```

### API routes

```text
app/api/auth/login/route.ts                 App password login
app/api/auth/logout/route.ts                App logout
app/api/backup/google/route.ts              Supabase to Google Sheets backup
app/api/extension/daily-results/route.ts    Extension import endpoint
app/api/posts/extract-archive/route.ts      ZIP/RAR image extraction
app/api/poster-lab/tmdb/genres/route.ts     TMDb genre proxy
app/api/poster-lab/tmdb/discover/route.ts   TMDb discover proxy
app/api/trend-calendar/verify/route.ts      Trend calendar verification helper
```

## Shared App Components

```text
components/header.tsx           Page header and mobile sidebar trigger
components/sidebar.tsx          Desktop sidebar navigation
components/mobile-sidebar.tsx   Mobile navigation drawer
components/app-bootstrap.tsx    Initializes the Zustand store
components/theme-provider.tsx   Theme provider wrapper
components/theme-toggle.tsx     Theme toggle control
components/status-badge.tsx     Shared post status badge
components/ui/                  shadcn/Radix UI primitives
```

## Feature Components

### Dashboard

```text
components/dashboard/stats-cards.tsx        Top-level daily stats
components/dashboard/alerts-widget.tsx      Unread notification cards
components/dashboard/page-summary.tsx       Per-page status summary
components/dashboard/upcoming-slots.tsx     Upcoming scheduled posts
components/dashboard/missing-slots.tsx      Empty slot warnings
components/backup/backup-safety-alert.tsx   Backup health warning banner
```

### Pages and posts

```text
components/pages/pages-list.tsx             Page list, edit/delete actions
components/pages/page-modal.tsx             Page create/edit dialog
components/posts/posts-list.tsx             Post table, filters, copy tools
components/posts/post-modal.tsx             Post create/edit and bulk archive scheduler
components/schedule/schedule-board.tsx      Calendar grid, slot actions, drag/drop
```

### Composer and automation

```text
components/composer/article-composer.tsx    Main article composer workflow
components/composer/tinymce-html-editor.tsx TinyMCE HTML editor wrapper
```

### Other modules

```text
components/event-timing/event-timing-manager.tsx   Trend calendar UI
components/notes/notes-board.tsx                   Notes board
components/notes/note-modal.tsx                    Note create/edit dialog
components/poster-lab/poster-lab-manager.tsx       Poster Lab main manager
components/poster-lab/franchise-modal.tsx          Franchise create/edit dialog
components/poster-lab/sequel-modal.tsx             Sequel create/edit dialog
components/players/players-manager.tsx             Teams and players manager
components/sources/sources-manager.tsx             Source list and actions
components/sources/source-modal.tsx                Source create/edit dialog
components/via/via-manager.tsx                     VIA account list
components/via/via-modal.tsx                       VIA create/edit dialog
components/notifications/notifications-list.tsx    Notifications page list
```

## Data and Domain Layer

```text
lib/types.ts                       Domain TypeScript types
lib/store.ts                       Zustand store for pages/posts/notifications
lib/supabase.ts                    Supabase client, table mappers, CRUD helpers
lib/mock-data.ts                   Local fallback/demo data
lib/utils.ts                       Shared utility helpers
lib/data-transfer.ts               JSON backup export/import
lib/backup-health.ts               Client backup health tracking
lib/post-image-processing.ts       Image resize/crop utilities
lib/bulk-archive-scheduling.ts     ZIP image extraction and slot assignment
lib/event-timing.ts                Trend/event timing dataset and helpers
lib/poster-lab.ts                  Poster Lab constants/helpers
```

## Extension

```text
Extension/manifest.json        Chrome extension manifest
Extension/background.js        Main Daily/Feji automation service worker
Extension/popup.html           Extension popup UI
Extension/popup.css            Popup styles
Extension/popup.js             Popup state and Scheduler API config
Extension/scheduler-bridge.js  Content script bridge from app to extension
Extension/README.md            Extension setup and workflow notes
```

The extension talks to:

```text
app/api/extension/daily-results/route.ts
```

## Database and Backup

```text
supabase/schema.sql            Tables, indexes, storage bucket, RLS policies
GOOGLE_BACKUP.md               Google backup setup notes
apps-script-webapp.gs          Apps Script receiver used by Google backup
.env.example                   Environment variable reference
```

## Current Pain Points

```text
README.md                      Appears to have encoding issues and older project notes
next.config.mjs                ignoreBuildErrors is enabled
supabase/schema.sql            anon policies allow broad CRUD access
Extension/popup.html           Domain timing text is older than background.js rules
Extension/background.js        Large single file; good candidate for splitting
components/composer/article-composer.tsx
components/poster-lab/poster-lab-manager.tsx
components/posts/posts-list.tsx
components/schedule/schedule-board.tsx
                                Large feature files; good candidates for local hooks/helpers
```

## Suggested Future Structure

Do this gradually. Move one feature at a time and run `npm run build` after each
step.

```text
features/
|- posts/
|  |- components/
|  |- hooks/
|  |- utils/
|  |- types.ts
|- schedule/
|- composer/
|- poster-lab/
|- via/
|- sources/
|- players/
|- notes/
|- backup/

shared/
|- components/
|- hooks/
|- lib/
|- types/

server/
|- supabase/
|- backup/
|- extension/

extension/
|- background/
|  |- daily.js
|  |- feji.js
|  |- scheduler.js
|  |- state.js
|- popup/
|- bridge/
```

## Refactor Order

1. Documentation only: keep this file current.
2. Extract pure helpers from large files into nearby `*.utils.ts` files.
3. Extract large UI sections into local components under the same feature folder.
4. Move feature folders only after imports are stable.
5. Split `Extension/background.js` into smaller extension modules if the target
   browser build flow supports it.
6. Tighten TypeScript by removing `ignoreBuildErrors` after type errors are fixed.
7. Revisit Supabase RLS and move sensitive writes behind server routes.

## Naming Rules

```text
*.page.tsx              Do not use this in app routes; Next expects page.tsx.
*-manager.tsx           Main feature screen component.
*-modal.tsx             Dialog for create/edit flows.
*.utils.ts              Pure helpers with no React state.
*.hooks.ts or use-*.ts  React hooks.
*.server.ts             Server-only helpers.
*.client.ts             Browser-only helpers.
```

For the current codebase, prefer colocating new helpers beside the feature that
uses them first. Promote to `lib/` only when at least two unrelated features need
the same helper.

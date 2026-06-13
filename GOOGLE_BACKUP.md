# Google Sheets Backup

Supabase remains the primary database. Google is only a backup target.

The backup route exports all Supabase tables and sends them to Google Apps Script. Apps Script then replaces the matching tabs in Google Sheets, so the backup looks like database tables instead of a single JSON file.

## Environment

```env
GOOGLE_APPS_SCRIPT_WEBAPP_URL=https://script.google.com/macros/s/your_deployment_id/exec
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id
GOOGLE_DRIVE_MAKE_PUBLIC=true
GOOGLE_APPS_SCRIPT_TOKEN=your_script_token
GOOGLE_BACKUP_TOKEN=your_script_token
GOOGLE_BACKUP_READY_POST_LIMIT=50
```

`GOOGLE_APPS_SCRIPT_URL` also works if you prefer that name. `GOOGLE_BACKUP_TOKEN` is used by manual/API calls; `GOOGLE_APPS_SCRIPT_TOKEN` is sent to Apps Script.

After changing `.env.local`, restart the Next dev server.

## Apps Script

Use [apps-script-webapp.gs](/c:/Tool/tools/FB-Scheduler/apps-script-webapp.gs) as the full Apps Script file.

In Apps Script:

1. Paste the full file into `Code.gs`.
2. Open `Project Settings` > `Script Properties`.
3. Add `POC_TOKEN` with the same value as `GOOGLE_APPS_SCRIPT_TOKEN`.
4. Deploy > New deployment > Web app.
5. Set `Execute as` to `Me`.
6. Set `Who has access` to `Anyone`.
7. Copy the `/exec` URL into `GOOGLE_APPS_SCRIPT_WEBAPP_URL`.

## What Gets Synced

Each backup run replaces these tabs with current Supabase rows. The `posts` tab only includes posts with `status = ready`; posted or other statuses are skipped. By default, only the next 50 ready posts are synced. Change `GOOGLE_BACKUP_READY_POST_LIMIT` if you need a different number.

- `pages`
- `vias`
- `page_vias`
- `posts`
- `notes`
- `sources`
- `sports_teams`
- `sports_players`
- `poster_lab_franchises`
- `poster_lab_sequels`

The `backup_runs` tab is appended on every run with `exported_at`, `total_rows`, and per-table counts.

## Image Backup

During `posts` backup, Apps Script copies each HTTP `image_url` into the configured Google Drive folder.

The `posts` backup tab includes these extra Drive columns:

- `source_image_url`
- `drive_file_id`
- `drive_web_view_link`
- `drive_direct_url`
- `drive_copy_error`

When image copy succeeds, `posts.image_url` is replaced with the Google Drive thumbnail URL and the original Supabase URL is kept in `source_image_url`.

Copied images are tracked in `backup_media` by `source_url`, so repeated backups reuse existing Drive files instead of uploading duplicates.

## Manual Test

From the app, use Settings > Data Import / Export > `Sync to Google`.

You can also call:

```bash
curl -X POST http://localhost:3000/api/backup/google \
  -H "Authorization: Bearer your_token"
```

## Schedule

`vercel.json` runs `/api/backup/google` daily at `0 17 * * *`, which is 00:00 in UTC+7.

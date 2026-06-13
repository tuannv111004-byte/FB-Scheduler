import { NextResponse } from 'next/server'
import { exportPostOpsBackup } from '@/lib/data-transfer'

export const runtime = 'nodejs'

const accessCookieName = 'postops_access'

const tableNames = [
  'pages',
  'vias',
  'page_vias',
  'posts',
  'notes',
  'sources',
  'sports_teams',
  'sports_players',
  'poster_lab_franchises',
  'poster_lab_sequels',
] as const

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function accessCookieValue(password: string) {
  const salt = process.env.APP_ACCESS_COOKIE_SALT || 'postops'
  return sha256(`${salt}:${password}`)
}

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim())
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

async function hasValidAppSession(request: Request) {
  const configuredPassword = process.env.APP_ACCESS_PASSWORD
  if (!configuredPassword) return process.env.NODE_ENV === 'development'

  const expectedCookieValue = await accessCookieValue(configuredPassword)
  return getCookieValue(request, accessCookieName) === expectedCookieValue
}

async function isAuthorized(request: Request) {
  if (request.headers.get('x-vercel-cron')) return true

  const token = process.env.GOOGLE_BACKUP_TOKEN || process.env.GOOGLE_APPS_SCRIPT_TOKEN
  if (token) {
    const authorization = request.headers.get('authorization')
    if (authorization === `Bearer ${token}`) return true

    const requestUrl = new URL(request.url)
    if (requestUrl.searchParams.get('token') === token) return true
  }

  return hasValidAppSession(request)
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function getOptionalEnv(name: string) {
  const value = process.env[name]
  return value?.trim() || undefined
}

function getBackupPostLimit() {
  const rawValue = getOptionalEnv('GOOGLE_BACKUP_READY_POST_LIMIT')
  if (!rawValue) return 50

  const value = Number(rawValue)
  if (!Number.isFinite(value) || value < 1) return 50
  return Math.floor(value)
}

function compareReadyPosts(a: Record<string, unknown>, b: Record<string, unknown>) {
  const aDate = String(a.post_date || '')
  const bDate = String(b.post_date || '')
  if (aDate !== bDate) return aDate.localeCompare(bDate)

  const aTime = String(a.time_slot || '')
  const bTime = String(b.time_slot || '')
  return aTime.localeCompare(bTime)
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized()

  try {
    const scriptUrl = getOptionalEnv('GOOGLE_APPS_SCRIPT_URL') || getOptionalEnv('GOOGLE_APPS_SCRIPT_WEBAPP_URL')
    if (!scriptUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL or GOOGLE_APPS_SCRIPT_WEBAPP_URL is not configured.')

    const scriptToken = getOptionalEnv('GOOGLE_APPS_SCRIPT_TOKEN') || getOptionalEnv('GOOGLE_BACKUP_TOKEN')
    if (!scriptToken) throw new Error('GOOGLE_APPS_SCRIPT_TOKEN or GOOGLE_BACKUP_TOKEN is not configured.')

    const backup = await exportPostOpsBackup()
    const readyPostLimit = getBackupPostLimit()
    backup.tables.posts = backup.tables.posts
      .filter((post) => post.status === 'ready')
      .sort(compareReadyPosts)
      .slice(0, readyPostLimit)
    const counts = Object.fromEntries(tableNames.map((tableName) => [tableName, backup.tables[tableName]?.length ?? 0]))
    const totalRows = Object.values(counts).reduce((sum, count) => sum + count, 0)

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'backup-postops-database',
        token: scriptToken,
        sheetId: getRequiredEnv('GOOGLE_SHEET_ID'),
        folderId: getOptionalEnv('GOOGLE_DRIVE_FOLDER_ID'),
        makePublic: process.env.GOOGLE_DRIVE_MAKE_PUBLIC === 'true',
        exportedAt: backup.exportedAt,
        tables: backup.tables,
        counts,
        totalRows,
      }),
    })

    const result = await response.json().catch(() => null) as {
      ok?: boolean
      error?: string
      spreadsheetUrl?: string
      totalRows?: number
      counts?: Record<string, number>
    } | null

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'Google Apps Script database backup failed.')
    }

    return NextResponse.json({
      ok: true,
      provider: 'apps-script',
      exportedAt: backup.exportedAt,
      spreadsheetUrl: result.spreadsheetUrl,
      totalRows: result.totalRows ?? totalRows,
      counts: result.counts ?? counts,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Google database backup failed.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return POST(request)
}

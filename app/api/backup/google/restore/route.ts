import { NextResponse } from 'next/server'
import {
  backupVersion,
  importPostOpsBackup,
  isPostOpsBackup,
  type ImportMode,
  type PostOpsBackup,
} from '@/lib/data-transfer'

export const runtime = 'nodejs'

const accessCookieName = 'postops_access'

const tableNames = [
  'pages',
  'vias',
  'page_vias',
  'posts',
  'notes',
  'sources',
] as const

type TableName = (typeof tableNames)[number]
type BackupRow = Record<string, unknown>

const allowedColumns: Record<TableName, string[]> = {
  pages: ['id', 'name', 'page_url', 'logo_url', 'brand_color', 'is_active', 'posts_per_day', 'time_slots', 'notes', 'created_at', 'updated_at'],
  vias: ['id', 'account_name', 'account_link', 'account_password', 'display_name', 'two_factor_code', 'outlook_email', 'outlook_password', 'via_email', 'avatar_url', 'description', 'notes', 'status', 'location', 'created_at', 'updated_at'],
  page_vias: ['page_id', 'via_id', 'created_at'],
  posts: ['id', 'page_id', 'post_date', 'time_slot', 'image_path', 'image_url', 'caption', 'ads_link', 'status', 'notes', 'created_at', 'updated_at'],
  notes: ['id', 'title', 'content', 'color', 'sort_order', 'created_at', 'updated_at'],
  sources: ['id', 'name', 'url', 'type', 'description', 'notes', 'is_active', 'created_at', 'updated_at'],
}

const stringArrayColumns: Partial<Record<TableName, string[]>> = {
  pages: ['time_slots'],
}

const booleanColumns: Partial<Record<TableName, string[]>> = {
  pages: ['is_active'],
  sources: ['is_active'],
}

const numberColumns: Partial<Record<TableName, string[]>> = {
  pages: ['posts_per_day'],
  notes: ['sort_order'],
}

const booleanDefaults: Partial<Record<TableName, Record<string, boolean>>> = {
  pages: { is_active: true },
  sources: { is_active: true },
}

const numberDefaults: Partial<Record<TableName, Record<string, number>>> = {
  pages: { posts_per_day: 1 },
  notes: { sort_order: 0 },
}

const nullableDateColumns: Partial<Record<TableName, string[]>> = {}

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

function parseImportMode(value: unknown): ImportMode {
  return value === 'replace' ? 'replace' : 'merge'
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === '' || value === null || value === undefined) return fallback
  return String(value).toLowerCase() === 'true'
}

function parseNumberOrNull(value: unknown, fallback: number | null = null) {
  if (value === '' || value === null || value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeRow(tableName: TableName, row: BackupRow) {
  const normalized = allowedColumns[tableName].reduce((result, column) => {
    result[column] = row[column] === undefined ? '' : row[column]
    return result
  }, {} as BackupRow)

  for (const column of stringArrayColumns[tableName] ?? []) {
    normalized[column] = parseStringArray(row[column])
  }

  for (const column of booleanColumns[tableName] ?? []) {
    normalized[column] = parseBoolean(row[column], booleanDefaults[tableName]?.[column] ?? false)
  }

  for (const column of numberColumns[tableName] ?? []) {
    normalized[column] = parseNumberOrNull(row[column], numberDefaults[tableName]?.[column] ?? null)
  }

  for (const column of nullableDateColumns[tableName] ?? []) {
    if (normalized[column] === '') normalized[column] = null
  }

  return normalized
}

function normalizeGoogleBackup(value: unknown): PostOpsBackup {
  if (!value || typeof value !== 'object') {
    throw new Error('Google restore returned an invalid response.')
  }

  const source = value as { tables?: Partial<Record<TableName, BackupRow[]>>; exportedAt?: unknown }
  const tables = tableNames.reduce(
    (result, tableName) => {
      const rows = Array.isArray(source.tables?.[tableName]) ? source.tables[tableName] : []
      result[tableName] = rows.map((row) => normalizeRow(tableName, row))
      return result
    },
    {} as PostOpsBackup['tables']
  )

  return {
    app: 'postops',
    version: backupVersion,
    exportedAt: typeof source.exportedAt === 'string' ? source.exportedAt : new Date().toISOString(),
    tables,
  }
}

function summarizeImport(summary: Record<string, number>) {
  return Object.values(summary).reduce((sum, count) => sum + count, 0)
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized()

  try {
    let payload: { mode?: unknown } = {}
    try {
      payload = (await request.json()) as { mode?: unknown }
    } catch {
      payload = {}
    }

    const mode = parseImportMode(payload.mode)
    const scriptUrl = getOptionalEnv('GOOGLE_APPS_SCRIPT_URL') || getOptionalEnv('GOOGLE_APPS_SCRIPT_WEBAPP_URL')
    if (!scriptUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL or GOOGLE_APPS_SCRIPT_WEBAPP_URL is not configured.')

    const scriptToken = getOptionalEnv('GOOGLE_APPS_SCRIPT_TOKEN') || getOptionalEnv('GOOGLE_BACKUP_TOKEN')
    if (!scriptToken) throw new Error('GOOGLE_APPS_SCRIPT_TOKEN or GOOGLE_BACKUP_TOKEN is not configured.')

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'restore-postops-database',
        token: scriptToken,
        sheetId: getRequiredEnv('GOOGLE_SHEET_ID'),
      }),
    })

    const result = await response.json().catch(() => null) as {
      ok?: boolean
      error?: string
      tables?: unknown
      exportedAt?: string
      spreadsheetUrl?: string
      totalRows?: number
    } | null

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'Google Apps Script restore failed.')
    }

    const backup = normalizeGoogleBackup(result)
    if (!isPostOpsBackup(backup)) {
      throw new Error('Google Sheets data is not a valid PostOps backup.')
    }

    const summary = await importPostOpsBackup(backup, mode)

    return NextResponse.json({
      ok: true,
      provider: 'apps-script',
      mode,
      exportedAt: backup.exportedAt,
      spreadsheetUrl: result.spreadsheetUrl,
      sourceRows: result.totalRows ?? 0,
      importedRows: summarizeImport(summary),
      summary,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Google Sheets restore failed.',
      },
      { status: 500 }
    )
  }
}

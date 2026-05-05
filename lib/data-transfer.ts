import { isSupabaseConfigured, supabase } from './supabase'

export const backupVersion = 1

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

const deleteOrder = [
  'page_vias',
  'posts',
  'sports_players',
  'sports_teams',
  'poster_lab_sequels',
  'poster_lab_franchises',
  'notes',
  'sources',
  'vias',
  'pages',
] as const

const insertOrder = [
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

type BackupTableName = (typeof tableNames)[number]

type BackupRow = Record<string, unknown>

export type PostOpsBackup = {
  app: 'postops'
  version: number
  exportedAt: string
  tables: Record<BackupTableName, BackupRow[]>
}

export type ImportMode = 'merge' | 'replace'

export type ImportSummary = Record<BackupTableName, number>

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Export/import needs Supabase credentials.')
  }

  return supabase
}

function emptyTables(): Record<BackupTableName, BackupRow[]> {
  return tableNames.reduce(
    (result, tableName) => {
      result[tableName] = []
      return result
    },
    {} as Record<BackupTableName, BackupRow[]>
  )
}

function allRowsFilterColumn(tableName: BackupTableName) {
  return tableName === 'page_vias' ? 'page_id' : 'id'
}

function upsertConflictTarget(tableName: BackupTableName) {
  return tableName === 'page_vias' ? 'page_id,via_id' : 'id'
}

export function isPostOpsBackup(value: unknown): value is PostOpsBackup {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<PostOpsBackup>
  if (candidate.app !== 'postops' || typeof candidate.version !== 'number') return false
  if (!candidate.tables || typeof candidate.tables !== 'object') return false

  return tableNames.every((tableName) => Array.isArray(candidate.tables?.[tableName]))
}

export async function exportPostOpsBackup(): Promise<PostOpsBackup> {
  const client = requireClient()
  const tables = emptyTables()

  for (const tableName of tableNames) {
    const { data, error } = await client.from(tableName).select('*')
    if (error) throw error
    tables[tableName] = (data ?? []) as BackupRow[]
  }

  return {
    app: 'postops',
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    tables,
  }
}

export async function importPostOpsBackup(backup: PostOpsBackup, mode: ImportMode): Promise<ImportSummary> {
  const client = requireClient()

  if (!isPostOpsBackup(backup)) {
    throw new Error('Invalid PostOps backup file.')
  }

  if (mode === 'replace') {
    for (const tableName of deleteOrder) {
      const { error } = await client.from(tableName).delete().not(allRowsFilterColumn(tableName), 'is', null)
      if (error) throw error
    }
  }

  const summary = tableNames.reduce(
    (result, tableName) => {
      result[tableName] = 0
      return result
    },
    {} as ImportSummary
  )

  for (const tableName of insertOrder) {
    const rows = backup.tables[tableName] ?? []
    if (rows.length === 0) continue

    const { error } = await client.from(tableName).upsert(rows, {
      onConflict: upsertConflictTarget(tableName),
    })
    if (error) throw error
    summary[tableName] = rows.length
  }

  return summary
}

export function buildBackupFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `postops-backup-${stamp}.json`
}

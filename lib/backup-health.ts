export const backupHealthStorageKey = 'postops:backup-health'
export const backupHealthChangedEvent = 'postops:backup-health-changed'

export const backupWarningAfterMs = 24 * 60 * 60 * 1000
export const backupCriticalAfterMs = 3 * backupWarningAfterMs

export type BackupMethod = 'json' | 'google'

export type BackupHealthRecord = {
  lastAttemptAt: string
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastError: string | null
  lastMethod: BackupMethod
  totalRows: number | null
}

function isBackupMethod(value: unknown): value is BackupMethod {
  return value === 'json' || value === 'google'
}

export function isBackupHealthRecord(value: unknown): value is BackupHealthRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BackupHealthRecord>

  return (
    typeof candidate.lastAttemptAt === 'string' &&
    (candidate.lastSuccessAt === null || typeof candidate.lastSuccessAt === 'string') &&
    (candidate.lastFailureAt === null || typeof candidate.lastFailureAt === 'string') &&
    (candidate.lastError === null || typeof candidate.lastError === 'string') &&
    isBackupMethod(candidate.lastMethod) &&
    (candidate.totalRows === null || typeof candidate.totalRows === 'number')
  )
}

export function readBackupHealth(): BackupHealthRecord | null {
  if (typeof window === 'undefined') return null

  try {
    const rawValue = window.localStorage.getItem(backupHealthStorageKey)
    if (!rawValue) return null
    const parsed = JSON.parse(rawValue) as unknown
    return isBackupHealthRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeBackupHealth(record: BackupHealthRecord) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(backupHealthStorageKey, JSON.stringify(record))
    window.dispatchEvent(new CustomEvent(backupHealthChangedEvent, { detail: record }))
  } catch {
    // Backup tracking is best-effort and must never turn a successful backup into a failure.
  }
}

export function recordBackupSuccess(input: {
  method: BackupMethod
  completedAt?: string
  totalRows?: number | null
}) {
  const completedAt = input.completedAt || new Date().toISOString()
  writeBackupHealth({
    lastAttemptAt: completedAt,
    lastSuccessAt: completedAt,
    lastFailureAt: null,
    lastError: null,
    lastMethod: input.method,
    totalRows: input.totalRows ?? null,
  })
}

export function recordBackupFailure(method: BackupMethod, error: unknown) {
  const previous = readBackupHealth()
  const failedAt = new Date().toISOString()
  const message = error instanceof Error ? error.message : 'Unknown backup error.'

  writeBackupHealth({
    lastAttemptAt: failedAt,
    lastSuccessAt: previous?.lastSuccessAt ?? null,
    lastFailureAt: failedAt,
    lastError: message,
    lastMethod: method,
    totalRows: previous?.totalRows ?? null,
  })
}

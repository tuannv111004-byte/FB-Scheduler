'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  backupCriticalAfterMs,
  backupHealthChangedEvent,
  backupHealthStorageKey,
  backupWarningAfterMs,
  isBackupHealthRecord,
  readBackupHealth,
  type BackupHealthRecord,
} from '@/lib/backup-health'

type BackupSafetyAlertProps = {
  showHealthy?: boolean
}

function formatBackupDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'an unknown time'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function methodLabel(record: BackupHealthRecord) {
  return record.lastMethod === 'google' ? 'Google Sheets' : 'downloaded JSON'
}

export function BackupSafetyAlert({ showHealthy = false }: BackupSafetyAlertProps) {
  const [record, setRecord] = useState<BackupHealthRecord | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setRecord(readBackupHealth())

    const handleCustomChange = (event: Event) => {
      const nextRecord = (event as CustomEvent<unknown>).detail
      setRecord(isBackupHealthRecord(nextRecord) ? nextRecord : readBackupHealth())
      setNow(Date.now())
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === backupHealthStorageKey) {
        setRecord(readBackupHealth())
        setNow(Date.now())
      }
    }
    const timer = window.setInterval(() => setNow(Date.now()), 15 * 60 * 1000)

    window.addEventListener(backupHealthChangedEvent, handleCustomChange)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(backupHealthChangedEvent, handleCustomChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const status = useMemo(() => {
    if (!record?.lastSuccessAt) {
      return {
        level: 'critical' as const,
        title: record?.lastError ? 'Backup failed — data is not protected' : 'No verified backup yet',
        description: record?.lastError
          ? `The latest attempt failed: ${record.lastError}`
          : 'Create a JSON or Google Sheets backup now so Supabase quota or connectivity problems cannot leave your data stranded.',
      }
    }

    const successTime = new Date(record.lastSuccessAt).getTime()
    const age = Number.isNaN(successTime) ? Number.POSITIVE_INFINITY : now - successTime

    if (record.lastError && record.lastFailureAt && record.lastFailureAt > record.lastSuccessAt) {
      return {
        level: 'critical' as const,
        title: 'Latest backup attempt failed',
        description: `${record.lastError} Your last successful ${methodLabel(record)} backup was ${formatBackupDate(record.lastSuccessAt)}.`,
      }
    }
    if (age >= backupCriticalAfterMs) {
      return {
        level: 'critical' as const,
        title: 'Backup critically overdue',
        description: `The last successful ${methodLabel(record)} backup was ${formatBackupDate(record.lastSuccessAt)}. Back up now before making more changes.`,
      }
    }
    if (age >= backupWarningAfterMs) {
      return {
        level: 'warning' as const,
        title: 'Daily backup overdue',
        description: `The last successful ${methodLabel(record)} backup was ${formatBackupDate(record.lastSuccessAt)}. A fresh backup is recommended.`,
      }
    }
    return {
      level: 'healthy' as const,
      title: 'Backup protection is current',
      description: `Last successful ${methodLabel(record)} backup: ${formatBackupDate(record.lastSuccessAt)}${record.totalRows !== null ? ` (${record.totalRows.toLocaleString()} rows)` : ''}.`,
    }
  }, [now, record])

  if (!mounted || (status.level === 'healthy' && !showHealthy)) return null

  const isCritical = status.level === 'critical'
  const Icon = isCritical ? AlertCircle : status.level === 'warning' ? AlertTriangle : CheckCircle2

  return (
    <Alert
      variant={isCritical ? 'destructive' : 'default'}
      className={status.level === 'warning' ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300' : undefined}
    >
      <Icon />
      <AlertTitle>{status.title}</AlertTitle>
      <AlertDescription>
        <p>{status.description}</p>
        {status.level !== 'healthy' && (
          <Link href="/settings" className="font-medium underline underline-offset-4">
            Open backup controls
          </Link>
        )}
      </AlertDescription>
    </Alert>
  )
}

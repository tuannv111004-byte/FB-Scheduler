"use client"

import { useEffect, useRef, useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  Bell,
  Clock,
  CloudDownload,
  CloudUpload,
  Database,
  Download,
  Loader2,
  Settings,
  Upload,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  buildBackupFileName,
  exportPostOpsBackup,
  importPostOpsBackup,
  isPostOpsBackup,
  type ImportMode,
  type ImportSummary,
} from '@/lib/data-transfer'
import { isSupabaseConfigured } from '@/lib/supabase'
import { BackupSafetyAlert } from '@/components/backup/backup-safety-alert'
import { recordBackupFailure, recordBackupSuccess } from '@/lib/backup-health'

function downloadJsonFile(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function summarizeImport(summary: ImportSummary) {
  return Object.entries(summary)
    .filter(([, count]) => count > 0)
    .map(([tableName, count]) => `${tableName}: ${count}`)
    .join(', ')
}

type GoogleBackupResponse = {
  ok: boolean
  error?: string
  totalRows?: number
  spreadsheetUrl?: string
  exportedAt?: string
}

type GoogleRestoreResponse = {
  ok: boolean
  error?: string
  importedRows?: number
  sourceRows?: number
  summary?: ImportSummary
  spreadsheetUrl?: string
  exportedAt?: string
  mode?: ImportMode
}

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isGoogleBackingUp, setIsGoogleBackingUp] = useState(false)
  const [isGoogleRestoring, setIsGoogleRestoring] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [googleRestoreDialogOpen, setGoogleRestoreDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDarkMode = mounted ? resolvedTheme !== 'light' : true
  const supabaseDataActionsDisabled = !isSupabaseConfigured || isExporting || isImporting || isGoogleRestoring
  const googleBackupDisabled = isGoogleBackingUp || isGoogleRestoring || isExporting || isImporting
  const googleRestoreDisabled = !isSupabaseConfigured || isGoogleRestoring || isGoogleBackingUp || isExporting || isImporting

  const handleExportAll = async () => {
    setIsExporting(true)
    try {
      const backup = await exportPostOpsBackup()
      downloadJsonFile(buildBackupFileName(), backup)
      const totalRows = Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0)
      recordBackupSuccess({ method: 'json', completedAt: backup.exportedAt, totalRows })
      toast({
        title: 'Export complete',
        description: 'PostOps backup JSON has been downloaded.',
      })
    } catch (error) {
      recordBackupFailure('json', error)
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Could not export data.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleGoogleBackup = async () => {
    setIsGoogleBackingUp(true)
    try {
      const response = await fetch('/api/backup/google', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const result = (await response.json().catch(() => null)) as GoogleBackupResponse | null

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not create Google backup.')
      }

      recordBackupSuccess({
        method: 'google',
        completedAt: result.exportedAt,
        totalRows: result.totalRows,
      })

      toast({
        title: 'Google backup complete',
        description: `Synced ${result.totalRows ?? 0} Supabase rows to Google Sheets.`,
      })

      if (result.spreadsheetUrl) {
        window.open(result.spreadsheetUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      recordBackupFailure('google', error)
      toast({
        title: 'Google backup failed',
        description: error instanceof Error ? error.message : 'Could not create Google backup.',
        variant: 'destructive',
      })
    } finally {
      setIsGoogleBackingUp(false)
    }
  }

  const handleGoogleRestore = async () => {
    setIsGoogleRestoring(true)
    try {
      const response = await fetch('/api/backup/google/restore', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: importMode }),
      })
      const result = (await response.json().catch(() => null)) as GoogleRestoreResponse | null

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not restore from Google Sheets.')
      }

      const description = result.summary
        ? summarizeImport(result.summary)
        : `Imported ${result.importedRows ?? 0} rows from Google Sheets.`

      toast({
        title: 'Google restore complete',
        description: description || 'No rows were imported.',
      })

      setGoogleRestoreDialogOpen(false)
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      toast({
        title: 'Google restore failed',
        description: error instanceof Error ? error.message : 'Could not restore from Google Sheets.',
        variant: 'destructive',
      })
    } finally {
      setIsGoogleRestoring(false)
    }
  }

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return
    setPendingImportFile(file)
  }

  const handleImportConfirmed = async () => {
    if (!pendingImportFile) return

    setIsImporting(true)
    try {
      const fileText = await pendingImportFile.text()
      const parsed = JSON.parse(fileText) as unknown

      if (!isPostOpsBackup(parsed)) {
        throw new Error('This file is not a valid PostOps backup.')
      }

      const summary = await importPostOpsBackup(parsed, importMode)
      const description = summarizeImport(summary)
      toast({
        title: 'Import complete',
        description: description || 'No rows were imported.',
      })
      setPendingImportFile(null)
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Could not import data.',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Settings" subtitle="Configure your PostOps preferences" />
        <div className="p-6 space-y-6">
          {/* General Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">General Settings</CardTitle>
              </div>
              <CardDescription>Basic application configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">Switch between dark and light theme</p>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  disabled={!mounted}
                />
              </div>
              <div className="flex justify-end">
                <ThemeToggle />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact View</Label>
                  <p className="text-xs text-muted-foreground">Use smaller spacing in tables</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Notification Settings</CardTitle>
              </div>
              <CardDescription>Configure how you receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Browser Notifications</Label>
                  <p className="text-xs text-muted-foreground">Show desktop notifications for due posts</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Late Post Alerts</Label>
                  <p className="text-xs text-muted-foreground">Alert when posts are overdue</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Empty Slot Warnings</Label>
                  <p className="text-xs text-muted-foreground">Warn about unfilled time slots</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder">Reminder Time (minutes before)</Label>
                <Input
                  id="reminder"
                  type="number"
                  defaultValue={15}
                  className="w-32"
                  min={5}
                  max={60}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Schedule Settings</CardTitle>
              </div>
              <CardDescription>Default posting schedule configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultSlots">Default Posts Per Day</Label>
                <Input
                  id="defaultSlots"
                  type="number"
                  defaultValue={5}
                  className="w-32"
                  min={1}
                  max={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  defaultValue="Asia/Ho_Chi_Minh (UTC+7)"
                  disabled
                  className="w-64"
                />
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <BackupSafetyAlert showHealthy />

          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Data Import / Export</CardTitle>
              </div>
              <CardDescription>Back up or restore Supabase data as a PostOps JSON file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label>Backup file</Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Export includes pages, posts, notes, vias, page links, and sources.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportAll}
                  disabled={supabaseDataActionsDisabled}
                  className="gap-2"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export All
                </Button>
              </div>

              <div className="grid gap-4 rounded-md border border-border p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="space-y-1">
                  <Label>Google Sheets backup</Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Pages, vias, notes, and sources auto-save to Google Sheets after each change. Use this to sync ready posts or restore data manually.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleBackup}
                    disabled={googleBackupDisabled}
                    className="gap-2"
                  >
                    {isGoogleBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Sync to Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGoogleRestoreDialogOpen(true)}
                    disabled={googleRestoreDisabled}
                    className="gap-2"
                  >
                    {isGoogleRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                    Restore from Google
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <Label>Import mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Merge updates matching IDs. Replace clears existing data before import.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 rounded-md border border-border p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={importMode === 'merge' ? 'default' : 'ghost'}
                      onClick={() => setImportMode('merge')}
                      disabled={isImporting || isGoogleRestoring}
                    >
                      Merge
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={importMode === 'replace' ? 'default' : 'ghost'}
                      onClick={() => setImportMode('replace')}
                      disabled={isImporting || isGoogleRestoring}
                    >
                      Replace
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportFileChange}
                    disabled={supabaseDataActionsDisabled}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={supabaseDataActionsDisabled}
                    className="gap-2 md:w-fit"
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Choose Backup JSON
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    The app refreshes after a successful import so every page reads the restored data.
                  </p>
                </div>

                {importMode === 'replace' && (
                  <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Replace mode deletes current Supabase rows before restoring the selected backup.</span>
                  </div>
                )}
              </div>

              {!isSupabaseConfigured && (
                <p className="text-xs text-destructive">
                  Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to use import/export.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button>Save Settings</Button>
          </div>
        </div>
      </main>

      <AlertDialog open={Boolean(pendingImportFile)} onOpenChange={(open) => !open && setPendingImportFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingImportFile?.name} will be imported in {importMode} mode.
              {importMode === 'replace'
                ? ' Existing Supabase data will be deleted first.'
                : ' Existing rows with the same IDs will be updated.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportConfirmed} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={googleRestoreDialogOpen} onOpenChange={setGoogleRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from Google Sheets?</AlertDialogTitle>
            <AlertDialogDescription>
              Google Sheets will be imported in {importMode} mode.
              {importMode === 'replace'
                ? ' Existing Supabase data will be deleted first. The Google backup posts tab only contains ready posts.'
                : ' Existing rows with the same IDs will be updated. The Google backup posts tab only contains ready posts.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGoogleRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGoogleRestore} disabled={isGoogleRestoring}>
              {isGoogleRestoring ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

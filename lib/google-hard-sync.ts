"use client"

let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncInFlight = false
let syncPending = false

async function runGoogleSheetHardSync(reason: string) {
  if (typeof window === 'undefined') return

  if (syncInFlight) {
    syncPending = true
    return
  }

  syncInFlight = true
  try {
    const response = await fetch(`/api/backup/google?hardSync=1&reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
    })

    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(result?.error || 'Google Sheets hard sync failed.')
    }
  } catch (error) {
    console.warn('Google Sheets hard sync failed:', error)
  } finally {
    syncInFlight = false
    if (syncPending) {
      syncPending = false
      scheduleGoogleSheetHardSync(reason)
    }
  }
}

export function scheduleGoogleSheetHardSync(reason = 'data-change') {
  if (typeof window === 'undefined') return

  if (syncTimer) {
    window.clearTimeout(syncTimer)
  }

  syncTimer = window.setTimeout(() => {
    syncTimer = null
    void runGoogleSheetHardSync(reason)
  }, 1200)
}

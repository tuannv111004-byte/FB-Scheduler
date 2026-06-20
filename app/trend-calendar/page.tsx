"use client"

import { EventTimingManager } from '@/components/event-timing/event-timing-manager'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'

export default function TrendCalendarPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Trend Calendar" subtitle="Auto-rank nearby entertainment moments for AI concept content" />
        <div className="p-6">
          <EventTimingManager />
        </div>
      </main>
    </div>
  )
}


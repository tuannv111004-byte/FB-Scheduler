"use client"

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { ScheduleBoard } from '@/components/schedule/schedule-board'

export default function SchedulePage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Daily Schedule" subtitle="View and manage posts by time slot" />
        <div className="p-6">
          <ScheduleBoard />
        </div>
      </main>
    </div>
  )
}

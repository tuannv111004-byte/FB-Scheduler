"use client"

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { AlertsWidget } from '@/components/dashboard/alerts-widget'
import { PageSummaryWidget } from '@/components/dashboard/page-summary'
import { UpcomingSlotsWidget } from '@/components/dashboard/upcoming-slots'
import { MissingSlotsWidget } from '@/components/dashboard/missing-slots'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Dashboard" subtitle="Overview of today's posting schedule" />
        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <StatsCards />

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Alerts & Page Summary */}
            <div className="space-y-6">
              <AlertsWidget />
              <PageSummaryWidget />
            </div>

            {/* Middle Column - Upcoming Slots */}
            <div className="lg:col-span-2 space-y-6">
              <UpcomingSlotsWidget />
              <MissingSlotsWidget />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

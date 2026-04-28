"use client"

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { NotificationsList } from '@/components/notifications/notifications-list'

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Notifications" subtitle="Stay updated on your posting schedule" />
        <div className="p-6">
          <NotificationsList />
        </div>
      </main>
    </div>
  )
}

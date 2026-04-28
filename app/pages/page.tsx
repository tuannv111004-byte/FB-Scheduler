"use client"

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { PagesList } from '@/components/pages/pages-list'

export default function PagesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Page Management" subtitle="Manage your Facebook pages and posting schedules" />
        <div className="p-6">
          <PagesList />
        </div>
      </main>
    </div>
  )
}

"use client"

import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { SourcesManager } from '@/components/sources/sources-manager'

export default function SourcesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Sources" subtitle="Research and information source storage" />
        <div className="p-6">
          <SourcesManager />
        </div>
      </main>
    </div>
  )
}

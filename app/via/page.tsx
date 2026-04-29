"use client"

import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { ViaManager } from '@/components/via/via-manager'

export default function ViaPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Via Management" subtitle="Store via credentials and page relationships" />
        <div className="p-6">
          <ViaManager />
        </div>
      </main>
    </div>
  )
}

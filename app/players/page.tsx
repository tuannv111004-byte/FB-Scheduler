"use client"

import { Header } from '@/components/header'
import { PlayersManager } from '@/components/players/players-manager'
import { Sidebar } from '@/components/sidebar'

export default function PlayersPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Team" subtitle="Team and player profile cards" />
        <div className="p-6">
          <PlayersManager />
        </div>
      </main>
    </div>
  )
}

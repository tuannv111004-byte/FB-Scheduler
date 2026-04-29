"use client"

import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { PosterLabManager } from '@/components/poster-lab/poster-lab-manager'

export default function PosterLabPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Poster Lab" subtitle="Real franchises with fictional next-movie poster concepts" />
        <div className="p-6">
          <PosterLabManager />
        </div>
      </main>
    </div>
  )
}

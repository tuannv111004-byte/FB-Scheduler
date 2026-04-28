"use client"

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

export default function NotesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Notes" subtitle="Draft notes and planning space" />
        <div className="p-6" />
      </main>
    </div>
  )
}

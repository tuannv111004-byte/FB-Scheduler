"use client"

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { NotesBoard } from '@/components/notes/notes-board'

export default function NotesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Notes" subtitle="Sticky notes board backed by Supabase" />
        <div className="p-6">
          <NotesBoard />
        </div>
      </main>
    </div>
  )
}

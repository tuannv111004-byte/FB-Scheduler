"use client"

import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { ArticleComposer } from '@/components/composer/article-composer'

export default function ComposerPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Composer" subtitle="Draft article JSON for Daily Feji workflows" />
        <div className="p-6">
          <ArticleComposer />
        </div>
      </main>
    </div>
  )
}

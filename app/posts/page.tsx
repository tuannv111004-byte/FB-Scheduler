"use client"

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { PostsList } from '@/components/posts/posts-list'

export default function PostsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Post Management" subtitle="Create and manage your scheduled posts" />
        <div className="p-6">
          <PostsList />
        </div>
      </main>
    </div>
  )
}

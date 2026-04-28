"use client"

import { create } from 'zustand'
import type { FacebookPage, PageInput, Post, PostInput, Notification, PostStatus } from './types'
import { mockPages, mockPosts } from './mock-data'
import {
  createPageRemote,
  createPostRemote,
  deletePageRemote,
  deletePostRemote,
  fetchPagesRemote,
  fetchPostsRemote,
  isSupabaseConfigured,
  updatePageRemote,
  updatePostRemote,
} from './supabase'

interface AppState {
  pages: FacebookPage[]
  posts: Post[]
  notifications: Notification[]
  selectedDate: string
  isInitialized: boolean
  isSyncing: boolean
  initializeApp: () => Promise<void>
  addPage: (page: PageInput) => Promise<void>
  updatePage: (id: string, updates: Partial<PageInput>) => Promise<void>
  deletePage: (id: string) => Promise<void>
  togglePageActive: (id: string) => Promise<void>
  addPost: (post: PostInput) => Promise<void>
  updatePost: (id: string, updates: Partial<PostInput>) => Promise<void>
  deletePost: (id: string) => Promise<void>
  duplicatePost: (id: string) => Promise<void>
  markAsPosted: (id: string) => Promise<void>
  updatePostStatus: (id: string, status: PostStatus) => Promise<void>
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
  setSelectedDate: (date: string) => void
  getPageById: (id: string) => FacebookPage | undefined
  getPostsForPage: (pageId: string, date?: string) => Post[]
  getPostForSlot: (pageId: string, date: string, timeSlot: string) => Post | undefined
  getActivePages: () => FacebookPage[]
  getUnreadNotifications: () => Notification[]
}

function buildNotifications(
  pages: FacebookPage[],
  posts: Post[],
  selectedDate: string,
  previousNotifications: Notification[] = []
) {
  const previousReadState = new Map(previousNotifications.map((notification) => [notification.id, notification.isRead]))
  const notifications: Notification[] = []

  for (const page of pages.filter((item) => item.isActive)) {
    const pagePosts = posts.filter((post) => post.pageId === page.id && post.postDate === selectedDate)

    for (const slot of page.timeSlots) {
      const slotPost = pagePosts.find((post) => post.timeSlot === slot)
      if (!slotPost) {
        const id = `missing-${page.id}-${selectedDate}-${slot}`
        notifications.push({
          id,
          type: 'warning',
          title: 'Missing Slot',
          message: `${page.name} has no post for ${slot}`,
          pageId: page.id,
          timeSlot: slot,
          timestamp: new Date(),
          isRead: previousReadState.get(id) ?? false,
        })
      }
    }
  }

  for (const post of posts.filter((item) => item.postDate === selectedDate)) {
    if (post.status === 'late' || post.status === 'due_now') {
      const id = `${post.status}-${post.id}`
      notifications.push({
        id,
        type: post.status === 'late' ? 'error' : 'info',
        title: post.status === 'late' ? 'Late Post' : 'Due Soon',
        message:
          post.status === 'late'
            ? `${post.caption.slice(0, 48)}${post.caption.length > 48 ? '...' : ''} is overdue`
            : `${post.caption.slice(0, 48)}${post.caption.length > 48 ? '...' : ''} is due now`,
        postId: post.id,
        pageId: post.pageId,
        timeSlot: post.timeSlot,
        timestamp: post.updatedAt,
        isRead: previousReadState.get(id) ?? false,
      })
    }
  }

  return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

function withDerivedState(
  pages: FacebookPage[],
  posts: Post[],
  selectedDate: string,
  previousNotifications: Notification[]
) {
  return {
    pages,
    posts,
    notifications: buildNotifications(pages, posts, selectedDate, previousNotifications),
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  pages: isSupabaseConfigured ? [] : mockPages,
  posts: isSupabaseConfigured ? [] : mockPosts,
  notifications: buildNotifications(
    isSupabaseConfigured ? [] : mockPages,
    isSupabaseConfigured ? [] : mockPosts,
    new Date().toISOString().split('T')[0]
  ),
  selectedDate: new Date().toISOString().split('T')[0],
  isInitialized: !isSupabaseConfigured,
  isSyncing: false,

  initializeApp: async () => {
    if (!isSupabaseConfigured || get().isInitialized) return

    set({ isSyncing: true })
    try {
      const [pages, posts] = await Promise.all([fetchPagesRemote(), fetchPostsRemote()])
      const selectedDate = get().selectedDate
      set((state) => ({
        ...withDerivedState(pages, posts, selectedDate, state.notifications),
        isInitialized: true,
        isSyncing: false,
      }))
    } catch (error) {
      console.error('Failed to initialize Supabase data:', error)
      set({
        pages: mockPages,
        posts: mockPosts,
        notifications: buildNotifications(mockPages, mockPosts, get().selectedDate),
        isInitialized: true,
        isSyncing: false,
      })
    }
  },
  
  addPage: async (pageData) => {
    set({ isSyncing: true })
    try {
      const newPage = isSupabaseConfigured
        ? await createPageRemote(pageData)
        : {
            ...pageData,
            id: `page-${Math.random().toString(36).substring(2, 15)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

      set((state) => ({
        ...withDerivedState(
          [...state.pages, newPage],
          state.posts,
          state.selectedDate,
          state.notifications
        ),
        isSyncing: false,
      }))
    } catch (error) {
      set({ isSyncing: false })
      throw error
    }
  },
  
  updatePage: async (id, updates) => {
    set({ isSyncing: true })
    try {
      const updatedPage = isSupabaseConfigured
        ? await updatePageRemote(id, updates)
        : null

      set((state) => {
        const pages = state.pages.map((page) =>
          page.id === id ? updatedPage ?? { ...page, ...updates, updatedAt: new Date() } : page
        )
        return {
          ...withDerivedState(pages, state.posts, state.selectedDate, state.notifications),
          isSyncing: false,
        }
      })
    } catch (error) {
      set({ isSyncing: false })
      throw error
    }
  },
  
  deletePage: async (id) => {
    set({ isSyncing: true })
    try {
      if (isSupabaseConfigured) {
        await deletePageRemote(id)
      }
      set((state) => {
        const pages = state.pages.filter((page) => page.id !== id)
        const posts = state.posts.filter((post) => post.pageId !== id)
        return {
          ...withDerivedState(pages, posts, state.selectedDate, state.notifications),
          isSyncing: false,
        }
      })
    } catch (error) {
      set({ isSyncing: false })
      throw error
    }
  },
  
  togglePageActive: async (id) => {
    const page = get().pages.find((item) => item.id === id)
    if (!page) return
    await get().updatePage(id, { isActive: !page.isActive })
  },
  
  addPost: async (postData) => {
    set({ isSyncing: true })
    try {
      const newPost = isSupabaseConfigured
        ? await createPostRemote(postData)
        : {
            ...postData,
            id: `post-${Math.random().toString(36).substring(2, 15)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

      set((state) => ({
        ...withDerivedState(
          state.pages,
          [...state.posts, newPost],
          state.selectedDate,
          state.notifications
        ),
        isSyncing: false,
      }))
    } catch (error) {
      set({ isSyncing: false })
      throw error
    }
  },
  
  updatePost: async (id, updates) => {
    set({ isSyncing: true })
    try {
      const updatedPost = isSupabaseConfigured
        ? await updatePostRemote(id, updates)
        : null

      set((state) => {
        const posts = state.posts.map((post) =>
          post.id === id ? updatedPost ?? { ...post, ...updates, updatedAt: new Date() } : post
        )
        return {
          ...withDerivedState(state.pages, posts, state.selectedDate, state.notifications),
          isSyncing: false,
        }
      })
    } catch (error) {
      set({ isSyncing: false })
      throw error
    }
  },
  
  deletePost: async (id) => {
    set({ isSyncing: true })
    try {
      if (isSupabaseConfigured) {
        await deletePostRemote(id)
      }
      set((state) => {
        const posts = state.posts.filter((post) => post.id !== id)
        return {
          ...withDerivedState(state.pages, posts, state.selectedDate, state.notifications),
          isSyncing: false,
        }
      })
    } catch (error) {
      set({ isSyncing: false })
      throw error
    }
  },
  
  duplicatePost: async (id) => {
    const post = get().posts.find((p) => p.id === id)
    if (post) {
      await get().addPost({
        pageId: post.pageId,
        postDate: post.postDate,
        timeSlot: post.timeSlot,
        imagePath: post.imagePath,
        imageUrl: post.imageUrl,
        caption: post.caption,
        adsLink: post.adsLink,
        status: 'draft',
        notes: post.notes,
      })
    }
  },
  
  markAsPosted: async (id) => {
    await get().updatePostStatus(id, 'posted')
  },
  
  updatePostStatus: async (id, status) => {
    await get().updatePost(id, { status })
  },
  
  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif
      ),
    }))
  },
  
  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((notif) => ({ ...notif, isRead: true })),
    }))
  },
  
  clearNotifications: () => {
    set({ notifications: [] })
  },
  
  setSelectedDate: (date) => {
    set((state) => ({
      selectedDate: date,
      notifications: buildNotifications(state.pages, state.posts, date, state.notifications),
    }))
  },
  
  getPageById: (id) => {
    return get().pages.find((page) => page.id === id)
  },
  
  getPostsForPage: (pageId, date) => {
    const targetDate = date || get().selectedDate
    return get().posts.filter(
      (post) => post.pageId === pageId && post.postDate === targetDate
    )
  },
  
  getPostForSlot: (pageId, date, timeSlot) => {
    return get().posts.find(
      (post) => post.pageId === pageId && post.postDate === date && post.timeSlot === timeSlot
    )
  },
  
  getActivePages: () => {
    return get().pages.filter((page) => page.isActive)
  },
  
  getUnreadNotifications: () => {
    return get().notifications.filter((notif) => !notif.isRead)
  },
}))

export type PostStatus = 
  | 'draft' 
  | 'scheduled' 
  | 'ready' 
  | 'due_now' 
  | 'posted' 
  | 'late' 
  | 'skipped'

export interface PageInput {
  name: string
  pageUrl: string
  logoUrl?: string
  brandColor: string
  isActive: boolean
  postsPerDay: number
  timeSlots: string[]
  notes: string
}

export interface FacebookPage extends PageInput {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface PostInput {
  pageId: string
  postDate: string
  timeSlot: string
  imagePath?: string
  imageUrl?: string
  caption: string
  adsLink?: string
  status: PostStatus
  notes: string
}

export interface Post extends PostInput {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface Notification {
  id: string
  type: 'warning' | 'error' | 'info' | 'success'
  title: string
  message: string
  postId?: string
  pageId?: string
  timeSlot?: string
  timestamp: Date
  isRead: boolean
}

export interface DailyStats {
  totalPages: number
  totalPostsToday: number
  postedCount: number
  pendingCount: number
  emptySlots: number
  lateCount: number
}

export interface PageSummary {
  page: FacebookPage
  postsToday: number
  postedCount: number
  missingSlots: number
  status: 'good' | 'warning' | 'critical'
}

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

export interface NoteInput {
  title: string
  content: string
  color: string
  sortOrder: number
}

export interface StickyNote extends NoteInput {
  id: string
  createdAt: Date
  updatedAt: Date
}

export type ViaStatus = 'active' | 'inactive' | 'checkpoint'

export type ViaLocation = 'personal_laptop' | 'company_computer'

export interface ViaInput {
  accountName: string
  accountLink: string
  accountPassword: string
  displayName: string
  twoFactorCode: string
  outlookEmail: string
  outlookPassword: string
  viaEmail: string
  avatarUrl?: string
  status: ViaStatus
  location: ViaLocation
  pageIds: string[]
}

export interface ViaAccount extends ViaInput {
  id: string
  createdAt: Date
  updatedAt: Date
}

export type SourceType = 'website' | 'social' | 'news' | 'community' | 'tool' | 'other'

export interface SourceInput {
  name: string
  url: string
  type: SourceType
  description: string
  notes: string
  isActive: boolean
}

export interface SourceItem extends SourceInput {
  id: string
  createdAt: Date
  updatedAt: Date
}

export type PosterLabGenre =
  | 'action'
  | 'horror'
  | 'sci_fi'
  | 'fantasy'
  | 'thriller'
  | 'drama'
  | 'romance'
  | 'comedy'
  | 'mystery'
  | 'crime'
  | 'animation'
  | 'other'

export type PosterLabImportSort =
  | 'popularity.desc'
  | 'vote_average.desc'
  | 'primary_release_date.desc'
  | 'revenue.desc'

export interface PosterLabFranchiseInput {
  franchiseName: string
  latestOfficialTitle: string
  genre: PosterLabGenre
  notes: string
  tmdbMovieId?: number | null
  tmdbGenreIds?: number[]
  tmdbGenreNames?: string[]
  releaseDate?: string
  overview?: string
  posterPath?: string
  backdropPath?: string
  sourceCategory?: string
}

export interface PosterLabFranchise extends PosterLabFranchiseInput {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface PosterLabTmdbGenre {
  id: number
  name: string
}

export interface PosterLabTmdbCandidate extends PosterLabFranchiseInput {
  tmdbMovieId: number
}

export interface PosterLabTmdbDiscoverRequest {
  genreId?: number
  genreName?: string
  pageCount: number
  maxResults: number
  sortBy: PosterLabImportSort
  minVoteCount: number
  existingTmdbMovieIds?: number[]
  includeExisting?: boolean
  includeStandalone?: boolean
}

export interface PosterLabSequelInput {
  franchiseId: string
  fakeTitle: string
  releaseYear: number
  tagline: string
  synopsis: string
  visualHook: string
  prompt: string
  caption: string
  isUsed: boolean
}

export interface PosterLabSequel extends PosterLabSequelInput {
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

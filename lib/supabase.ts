import { createClient } from '@supabase/supabase-js'
import type {
  FacebookPage,
  NoteInput,
  PageInput,
  PosterLabFranchise,
  PosterLabFranchiseInput,
  PosterLabGenre,
  PosterLabSequel,
  PosterLabSequelInput,
  PosterLabTmdbCandidate,
  Post,
  PostInput,
  PostStatus,
  SourceInput,
  SourceItem,
  SourceType,
  StickyNote,
  ViaAccount,
  ViaInput,
  ViaLocation,
  ViaStatus,
} from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

declare global {
  interface Window {
    __postopsSupabase?: ReturnType<typeof createClient>
  }
}

function getSupabaseClient() {
  if (!isSupabaseConfigured) return null

  if (typeof window === 'undefined') {
    return createClient(supabaseUrl!, supabaseKey!)
  }

  if (!window.__postopsSupabase) {
    window.__postopsSupabase = createClient(supabaseUrl!, supabaseKey!)
  }

  return window.__postopsSupabase
}

export const supabase = getSupabaseClient()

type PageRow = {
  id: string
  name: string
  page_url: string | null
  logo_url: string | null
  brand_color: string | null
  is_active: boolean
  posts_per_day: number
  time_slots: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

type PostRow = {
  id: string
  page_id: string
  post_date: string
  time_slot: string
  image_path: string | null
  image_url: string | null
  caption: string
  ads_link: string | null
  status: PostStatus
  notes: string | null
  created_at: string
  updated_at: string
}

type NoteRow = {
  id: string
  title: string
  content: string
  color: string
  sort_order: number
  created_at: string
  updated_at: string
}

type ViaRow = {
  id: string
  account_name: string
  account_link: string | null
  account_password: string
  display_name: string
  two_factor_code: string
  outlook_email: string
  outlook_password: string
  via_email: string
  avatar_url: string | null
  status: ViaStatus
  location: ViaLocation
  created_at: string
  updated_at: string
  page_vias?: Array<{
    page_id: string
  }>
}

type SourceRow = {
  id: string
  name: string
  url: string
  type: SourceType
  description: string
  notes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type PosterLabFranchiseRow = {
  id: string
  franchise_name: string
  latest_official_title: string
  genre: PosterLabGenre
  notes: string
  tmdb_movie_id: number | null
  tmdb_genre_ids: number[] | null
  tmdb_genre_names: string[] | null
  release_date: string | null
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  source_category: string | null
  created_at: string
  updated_at: string
}

type PosterLabSequelRow = {
  id: string
  franchise_id: string
  fake_title: string
  release_year: number
  tagline: string
  synopsis: string
  visual_hook: string
  prompt: string
  is_used: boolean
  created_at: string
  updated_at: string
}

function mapPageRow(row: PageRow): FacebookPage {
  return {
    id: row.id,
    name: row.name,
    pageUrl: row.page_url ?? '',
    logoUrl: row.logo_url ?? undefined,
    brandColor: row.brand_color ?? '#14b8a6',
    isActive: row.is_active,
    postsPerDay: row.posts_per_day,
    timeSlots: row.time_slots ?? [],
    notes: row.notes ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapPostRow(row: PostRow): Post {
  return {
    id: row.id,
    pageId: row.page_id,
    postDate: row.post_date,
    timeSlot: row.time_slot,
    imagePath: row.image_path ?? undefined,
    imageUrl: row.image_url ?? undefined,
    caption: row.caption,
    adsLink: row.ads_link ?? undefined,
    status: row.status,
    notes: row.notes ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapNoteRow(row: NoteRow): StickyNote {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapViaRow(row: ViaRow): ViaAccount {
  return {
    id: row.id,
    accountName: row.account_name,
    accountLink: row.account_link ?? '',
    accountPassword: row.account_password,
    displayName: row.display_name,
    twoFactorCode: row.two_factor_code,
    outlookEmail: row.outlook_email,
    outlookPassword: row.outlook_password,
    viaEmail: row.via_email,
    avatarUrl: row.avatar_url ?? undefined,
    status: row.status,
    location: row.location,
    pageIds: row.page_vias?.map((item) => item.page_id) ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapSourceRow(row: SourceRow): SourceItem {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    type: row.type,
    description: row.description,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapPosterLabFranchiseRow(row: PosterLabFranchiseRow): PosterLabFranchise {
  return {
    id: row.id,
    franchiseName: row.franchise_name,
    latestOfficialTitle: row.latest_official_title,
    genre: row.genre,
    notes: row.notes,
    tmdbMovieId: row.tmdb_movie_id,
    tmdbGenreIds: row.tmdb_genre_ids ?? [],
    tmdbGenreNames: row.tmdb_genre_names ?? [],
    releaseDate: row.release_date ?? undefined,
    overview: row.overview ?? undefined,
    posterPath: row.poster_path ?? undefined,
    backdropPath: row.backdrop_path ?? undefined,
    sourceCategory: row.source_category ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapPosterLabSequelRow(row: PosterLabSequelRow): PosterLabSequel {
  return {
    id: row.id,
    franchiseId: row.franchise_id,
    fakeTitle: row.fake_title,
    releaseYear: row.release_year,
    tagline: row.tagline,
    synopsis: row.synopsis,
    visualHook: row.visual_hook,
    prompt: row.prompt,
    isUsed: row.is_used,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function pagePayload(input: PageInput) {
  return {
    name: input.name,
    page_url: input.pageUrl || null,
    logo_url: input.logoUrl || null,
    brand_color: input.brandColor,
    is_active: input.isActive,
    posts_per_day: input.postsPerDay,
    time_slots: input.timeSlots,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  }
}

function postPayload(input: PostInput) {
  return {
    page_id: input.pageId,
    post_date: input.postDate,
    time_slot: input.timeSlot,
    image_path: input.imagePath || null,
    image_url: input.imageUrl || null,
    caption: input.caption,
    ads_link: input.adsLink || null,
    status: input.status,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  }
}

function notePayload(input: NoteInput) {
  return {
    title: input.title,
    content: input.content,
    color: input.color,
    sort_order: input.sortOrder,
    updated_at: new Date().toISOString(),
  }
}

function viaPayload(input: ViaInput) {
  return {
    account_name: input.accountName,
    account_link: input.accountLink || null,
    account_password: input.accountPassword,
    display_name: input.displayName,
    two_factor_code: input.twoFactorCode,
    outlook_email: input.outlookEmail,
    outlook_password: input.outlookPassword,
    via_email: input.viaEmail,
    avatar_url: input.avatarUrl || null,
    status: input.status,
    location: input.location,
    updated_at: new Date().toISOString(),
  }
}

function sourcePayload(input: SourceInput) {
  return {
    name: input.name,
    url: input.url,
    type: input.type,
    description: input.description,
    notes: input.notes,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  }
}

function posterLabFranchisePayload(input: PosterLabFranchiseInput) {
  return {
    franchise_name: input.franchiseName,
    latest_official_title: input.latestOfficialTitle,
    genre: input.genre,
    notes: input.notes,
    tmdb_movie_id: input.tmdbMovieId ?? null,
    tmdb_genre_ids: input.tmdbGenreIds?.length ? input.tmdbGenreIds : null,
    tmdb_genre_names: input.tmdbGenreNames?.length ? input.tmdbGenreNames : null,
    release_date: input.releaseDate || null,
    overview: input.overview || null,
    poster_path: input.posterPath || null,
    backdrop_path: input.backdropPath || null,
    source_category: input.sourceCategory || null,
    updated_at: new Date().toISOString(),
  }
}

function posterLabSequelPayload(input: PosterLabSequelInput) {
  return {
    franchise_id: input.franchiseId,
    fake_title: input.fakeTitle,
    release_year: input.releaseYear,
    tagline: input.tagline,
    synopsis: input.synopsis,
    visual_hook: input.visualHook,
    prompt: input.prompt,
    is_used: input.isUsed,
    updated_at: new Date().toISOString(),
  }
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  }
  return supabase
}

export async function fetchPagesRemote() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('pages')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as PageRow[]).map(mapPageRow)
}

export async function fetchPostsRemote() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('posts')
    .select('*')
    .order('post_date', { ascending: true })
    .order('time_slot', { ascending: true })

  if (error) throw error
  return (data as PostRow[]).map(mapPostRow)
}

export async function createPageRemote(input: PageInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('pages')
    .insert(pagePayload(input))
    .select('*')
    .single()

  if (error) throw error
  return mapPageRow(data as PageRow)
}

export async function updatePageRemote(id: string, updates: Partial<PageInput>) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.name !== undefined) payload.name = updates.name
  if (updates.pageUrl !== undefined) payload.page_url = updates.pageUrl || null
  if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl || null
  if (updates.brandColor !== undefined) payload.brand_color = updates.brandColor
  if (updates.isActive !== undefined) payload.is_active = updates.isActive
  if (updates.postsPerDay !== undefined) payload.posts_per_day = updates.postsPerDay
  if (updates.timeSlots !== undefined) payload.time_slots = updates.timeSlots
  if (updates.notes !== undefined) payload.notes = updates.notes || null

  const { data, error } = await client
    .from('pages')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapPageRow(data as PageRow)
}

export async function deletePageRemote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('pages').delete().eq('id', id)
  if (error) throw error
}

export async function createPostRemote(input: PostInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('posts')
    .insert(postPayload(input))
    .select('*')
    .single()

  if (error) throw error
  return mapPostRow(data as PostRow)
}

export async function fetchNotesRemote() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('notes')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as NoteRow[]).map(mapNoteRow)
}

export async function createNoteRemote(input: NoteInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('notes')
    .insert(notePayload(input))
    .select('*')
    .single()

  if (error) throw error
  return mapNoteRow(data as NoteRow)
}

export async function fetchViasRemote() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('vias')
    .select('*, page_vias(page_id)')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as ViaRow[]).map(mapViaRow)
}

export async function fetchSourcesRemote() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sources')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as SourceRow[]).map(mapSourceRow)
}

export async function createSourceRemote(input: SourceInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sources')
    .insert(sourcePayload(input))
    .select('*')
    .single()

  if (error) throw error
  return mapSourceRow(data as SourceRow)
}

export async function fetchPosterLabFranchisesRemote() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('poster_lab_franchises')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as PosterLabFranchiseRow[]).map(mapPosterLabFranchiseRow)
}

export async function createPosterLabFranchiseRemote(input: PosterLabFranchiseInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('poster_lab_franchises')
    .insert(posterLabFranchisePayload(input))
    .select('*')
    .single()

  if (error) throw error
  return mapPosterLabFranchiseRow(data as PosterLabFranchiseRow)
}

export async function updatePosterLabFranchiseRemote(
  id: string,
  updates: Partial<PosterLabFranchiseInput>
) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.franchiseName !== undefined) payload.franchise_name = updates.franchiseName
  if (updates.latestOfficialTitle !== undefined) payload.latest_official_title = updates.latestOfficialTitle
  if (updates.genre !== undefined) payload.genre = updates.genre
  if (updates.notes !== undefined) payload.notes = updates.notes
  if (updates.tmdbMovieId !== undefined) payload.tmdb_movie_id = updates.tmdbMovieId
  if (updates.tmdbGenreIds !== undefined) payload.tmdb_genre_ids = updates.tmdbGenreIds.length ? updates.tmdbGenreIds : null
  if (updates.tmdbGenreNames !== undefined) payload.tmdb_genre_names = updates.tmdbGenreNames.length ? updates.tmdbGenreNames : null
  if (updates.releaseDate !== undefined) payload.release_date = updates.releaseDate || null
  if (updates.overview !== undefined) payload.overview = updates.overview || null
  if (updates.posterPath !== undefined) payload.poster_path = updates.posterPath || null
  if (updates.backdropPath !== undefined) payload.backdrop_path = updates.backdropPath || null
  if (updates.sourceCategory !== undefined) payload.source_category = updates.sourceCategory || null

  const { data, error } = await client
    .from('poster_lab_franchises')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapPosterLabFranchiseRow(data as PosterLabFranchiseRow)
}

export async function deletePosterLabFranchiseRemote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('poster_lab_franchises').delete().eq('id', id)
  if (error) throw error
}

export async function createPosterLabFranchisesBulkRemote(items: PosterLabTmdbCandidate[]) {
  if (items.length === 0) {
    return [] as PosterLabFranchise[]
  }

  const client = requireSupabase()
  const tmdbMovieIds = items.map((item) => item.tmdbMovieId)

  const { data: existingRows, error: existingError } = await client
    .from('poster_lab_franchises')
    .select('tmdb_movie_id')
    .in('tmdb_movie_id', tmdbMovieIds)

  if (existingError) throw existingError

  const existingIds = new Set(
    ((existingRows as Array<{ tmdb_movie_id: number | null }> | null) ?? [])
      .map((row) => row.tmdb_movie_id)
      .filter((value): value is number => typeof value === 'number')
  )

  const uniqueItems = items.filter((item) => !existingIds.has(item.tmdbMovieId))
  if (uniqueItems.length === 0) {
    return [] as PosterLabFranchise[]
  }

  const { data, error } = await client
    .from('poster_lab_franchises')
    .insert(uniqueItems.map((item) => posterLabFranchisePayload(item)))
    .select('*')

  if (error) throw error
  return (data as PosterLabFranchiseRow[]).map(mapPosterLabFranchiseRow)
}

export async function fetchPosterLabSequelsRemote() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('poster_lab_sequels')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as PosterLabSequelRow[]).map(mapPosterLabSequelRow)
}

export async function createPosterLabSequelRemote(input: PosterLabSequelInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('poster_lab_sequels')
    .insert(posterLabSequelPayload(input))
    .select('*')
    .single()

  if (error) throw error
  return mapPosterLabSequelRow(data as PosterLabSequelRow)
}

export async function updatePosterLabSequelRemote(id: string, updates: Partial<PosterLabSequelInput>) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.franchiseId !== undefined) payload.franchise_id = updates.franchiseId
  if (updates.fakeTitle !== undefined) payload.fake_title = updates.fakeTitle
  if (updates.releaseYear !== undefined) payload.release_year = updates.releaseYear
  if (updates.tagline !== undefined) payload.tagline = updates.tagline
  if (updates.synopsis !== undefined) payload.synopsis = updates.synopsis
  if (updates.visualHook !== undefined) payload.visual_hook = updates.visualHook
  if (updates.prompt !== undefined) payload.prompt = updates.prompt
  if (updates.isUsed !== undefined) payload.is_used = updates.isUsed

  const { data, error } = await client
    .from('poster_lab_sequels')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapPosterLabSequelRow(data as PosterLabSequelRow)
}

export async function deletePosterLabSequelRemote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('poster_lab_sequels').delete().eq('id', id)
  if (error) throw error
}

export async function updateSourceRemote(id: string, updates: Partial<SourceInput>) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.name !== undefined) payload.name = updates.name
  if (updates.url !== undefined) payload.url = updates.url
  if (updates.type !== undefined) payload.type = updates.type
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.notes !== undefined) payload.notes = updates.notes
  if (updates.isActive !== undefined) payload.is_active = updates.isActive

  const { data, error } = await client
    .from('sources')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapSourceRow(data as SourceRow)
}

export async function deleteSourceRemote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('sources').delete().eq('id', id)
  if (error) throw error
}

async function replaceViaPageLinks(viaId: string, pageIds: string[]) {
  const client = requireSupabase()

  const { error: deleteError } = await client.from('page_vias').delete().eq('via_id', viaId)
  if (deleteError) throw deleteError

  if (pageIds.length === 0) return

  const { error: insertError } = await client.from('page_vias').insert(
    pageIds.map((pageId) => ({
      via_id: viaId,
      page_id: pageId,
    }))
  )

  if (insertError) throw insertError
}

export async function createViaRemote(input: ViaInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('vias')
    .insert(viaPayload(input))
    .select('*')
    .single()

  if (error) throw error

  const viaId = (data as ViaRow).id
  await replaceViaPageLinks(viaId, input.pageIds)

  const { data: refreshedData, error: refreshedError } = await client
    .from('vias')
    .select('*, page_vias(page_id)')
    .eq('id', viaId)
    .single()

  if (refreshedError) throw refreshedError
  return mapViaRow(refreshedData as ViaRow)
}

export async function updateViaRemote(id: string, updates: Partial<ViaInput>) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.accountName !== undefined) payload.account_name = updates.accountName
  if (updates.accountLink !== undefined) payload.account_link = updates.accountLink || null
  if (updates.accountPassword !== undefined) payload.account_password = updates.accountPassword
  if (updates.displayName !== undefined) payload.display_name = updates.displayName
  if (updates.twoFactorCode !== undefined) payload.two_factor_code = updates.twoFactorCode
  if (updates.outlookEmail !== undefined) payload.outlook_email = updates.outlookEmail
  if (updates.outlookPassword !== undefined) payload.outlook_password = updates.outlookPassword
  if (updates.viaEmail !== undefined) payload.via_email = updates.viaEmail
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl || null
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.location !== undefined) payload.location = updates.location

  const { error } = await client.from('vias').update(payload).eq('id', id)
  if (error) throw error

  if (updates.pageIds !== undefined) {
    await replaceViaPageLinks(id, updates.pageIds)
  }

  const { data: refreshedData, error: refreshedError } = await client
    .from('vias')
    .select('*, page_vias(page_id)')
    .eq('id', id)
    .single()

  if (refreshedError) throw refreshedError
  return mapViaRow(refreshedData as ViaRow)
}

export async function deleteViaRemote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('vias').delete().eq('id', id)
  if (error) throw error
}

export async function updateNoteRemote(id: string, updates: Partial<NoteInput>) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.title !== undefined) payload.title = updates.title
  if (updates.content !== undefined) payload.content = updates.content
  if (updates.color !== undefined) payload.color = updates.color
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder

  const { data, error } = await client
    .from('notes')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapNoteRow(data as NoteRow)
}

export async function deleteNoteRemote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('notes').delete().eq('id', id)
  if (error) throw error
}

export async function updatePostRemote(id: string, updates: Partial<PostInput>) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.pageId !== undefined) payload.page_id = updates.pageId
  if (updates.postDate !== undefined) payload.post_date = updates.postDate
  if (updates.timeSlot !== undefined) payload.time_slot = updates.timeSlot
  if (updates.imagePath !== undefined) payload.image_path = updates.imagePath || null
  if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl || null
  if (updates.caption !== undefined) payload.caption = updates.caption
  if (updates.adsLink !== undefined) payload.ads_link = updates.adsLink || null
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.notes !== undefined) payload.notes = updates.notes || null

  const { data, error } = await client
    .from('posts')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapPostRow(data as PostRow)
}

export async function deletePostRemote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('posts').delete().eq('id', id)
  if (error) throw error
}

export async function uploadPostImage(file: File) {
  const client = requireSupabase()
  const fileExtension = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExtension}`
  const filePath = `posts/${fileName}`

  const { error: uploadError } = await client.storage
    .from('post-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) throw uploadError

  const { data } = client.storage.from('post-images').getPublicUrl(filePath)

  return {
    imagePath: filePath,
    imageUrl: data.publicUrl,
  }
}

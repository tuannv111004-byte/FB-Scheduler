import { createClient } from '@supabase/supabase-js'
import type { PostStatus } from '@/lib/types'

export const runtime = 'nodejs'

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type PageRow = {
  id: string
  name: string | null
  page_url: string | null
  media_type: 'image' | 'video' | null
  is_active: boolean | null
}

type PostRow = {
  id: string
  page_id: string
  post_date: string
  time_slot: string
  image_url: string | null
  caption: string | null
  ads_link: string | null
  status: PostStatus
  notes: string | null
  updated_at: string
}

const allowedFetchStatuses: PostStatus[] = ['scheduled', 'ready', 'due_now', 'late']
const allowedUpdateStatuses: PostStatus[] = ['scheduled', 'ready', 'due_now', 'posted', 'late', 'skipped']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  })
}

function errorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage
  const status = error instanceof ApiError ? error.status : 500

  if (status >= 500) {
    console.error('[facebook-publisher]', error)
  }

  return jsonResponse({ error: message }, { status })
}

function requireImportToken(request: Request) {
  const configuredToken = process.env.EXTENSION_IMPORT_TOKEN
  if (!configuredToken) {
    throw new ApiError('EXTENSION_IMPORT_TOKEN is not configured on the scheduler app.', 503)
  }

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  return token === configuredToken
}

function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new ApiError('Supabase environment variables are missing.', 503)
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  })
}

function readDate(value: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value! : ''
}

function readTime(value: string | null) {
  return /^\d{2}:\d{2}$/.test(value ?? '') ? value! : ''
}

function compareSchedule(firstDate: string, firstTime: string, secondDate: string, secondTime: string) {
  if (firstDate !== secondDate) return firstDate.localeCompare(secondDate)
  return firstTime.localeCompare(secondTime)
}

function normalizeStatuses(value: string | null) {
  const requested = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const statuses = requested.filter((item): item is PostStatus =>
    allowedFetchStatuses.includes(item as PostStatus)
  )

  return statuses.length > 0 ? statuses : allowedFetchStatuses
}

function makeFacebookPostUrl(pageUrl: string) {
  const trimmed = pageUrl.trim()
  if (!trimmed) return 'https://www.facebook.com/'

  try {
    const url = new URL(trimmed)
    if (!url.hostname.includes('facebook.com')) return trimmed
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`
    return url.toString()
  } catch {
    return trimmed
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function GET(request: Request) {
  try {
    if (!requireImportToken(request)) {
      return jsonResponse({ error: 'Unauthorized.' }, { status: 401 })
    }

    const requestUrl = new URL(request.url)
    const nowDate = readDate(requestUrl.searchParams.get('date'))
    const nowTime = readTime(requestUrl.searchParams.get('time'))
    if (!nowDate || !nowTime) {
      throw new ApiError('date and time query params are required, using YYYY-MM-DD and HH:mm.', 400)
    }

    const limit = Math.min(Math.max(Number(requestUrl.searchParams.get('limit') || '10') || 10, 1), 50)
    const statuses = normalizeStatuses(requestUrl.searchParams.get('statuses'))
    const supabase = createServerSupabaseClient()

    const { data: pagesData, error: pagesError } = await supabase
      .from('pages')
      .select('id,name,page_url,media_type,is_active')
      .eq('is_active', true)

    if (pagesError) throw pagesError

    const pages = ((pagesData as PageRow[] | null) ?? []).filter((page) => page.id)
    const pageById = new Map(pages.map((page) => [page.id, page]))

    if (pages.length === 0) {
      return jsonResponse({ posts: [] })
    }

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('id,page_id,post_date,time_slot,image_url,caption,ads_link,status,notes,updated_at')
      .in(
        'page_id',
        pages.map((page) => page.id)
      )
      .in('status', statuses)
      .lte('post_date', nowDate)
      .order('post_date', { ascending: true })
      .order('time_slot', { ascending: true })

    if (postsError) throw postsError

    const duePosts = ((postsData as PostRow[] | null) ?? [])
      .filter((post) => {
        const page = pageById.get(post.page_id)
        if (!page) return false
        return compareSchedule(post.post_date, post.time_slot, nowDate, nowTime) <= 0
      })
      .slice(0, limit)
      .map((post) => {
        const page = pageById.get(post.page_id)
        return {
          id: post.id,
          pageId: post.page_id,
          pageName: page?.name ?? 'Untitled page',
          pageUrl: page?.page_url ?? '',
          facebookUrl: makeFacebookPostUrl(page?.page_url ?? ''),
          mediaType: page?.media_type === 'video' ? 'video' : 'image',
          postDate: post.post_date,
          timeSlot: post.time_slot,
          caption: post.caption ?? '',
          mediaUrl: post.image_url ?? '',
          adsLink: post.ads_link ?? '',
          status: post.status,
          notes: post.notes ?? '',
          updatedAt: post.updated_at,
        }
      })

    return jsonResponse({ posts: duePosts })
  } catch (error) {
    return errorResponse(error, 'Failed to load due Facebook posts.')
  }
}

export async function POST(request: Request) {
  try {
    if (!requireImportToken(request)) {
      return jsonResponse({ error: 'Unauthorized.' }, { status: 401 })
    }

    const payload = (await request.json()) as { postId?: unknown; status?: unknown; notes?: unknown }
    const postId = typeof payload.postId === 'string' ? payload.postId.trim() : ''
    const status = typeof payload.status === 'string' ? payload.status.trim() : ''
    const notes = typeof payload.notes === 'string' ? payload.notes.trim() : ''

    if (!postId) throw new ApiError('postId is required.', 400)
    if (!allowedUpdateStatuses.includes(status as PostStatus)) {
      throw new ApiError('status is invalid.', 400)
    }

    const supabase = createServerSupabaseClient()
    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (notes) {
      updatePayload.notes = notes
    }

    const { data, error } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', postId)
      .select('id,status,post_date,time_slot,caption')
      .single()

    if (error) throw error

    return jsonResponse({ ok: true, post: data })
  } catch (error) {
    return errorResponse(error, 'Failed to update Facebook post status.')
  }
}

import { createClient } from '@supabase/supabase-js'
import type { PostStatus } from '@/lib/types'

export const runtime = 'nodejs'

type DailyResultItem = {
  title?: unknown
  image?: unknown
  dailyLink?: unknown
  shortLink?: unknown
  domain?: unknown
  status?: unknown
  error?: unknown
}

type ImportRequest = {
  pageId?: unknown
  startDate?: unknown
  startTimeSlot?: unknown
  status?: unknown
  items?: unknown
}

type PageRow = {
  id: string
  time_slots: string[] | null
}

type ExistingPostRow = {
  id: string
  post_date: string
  time_slot: string
  status: PostStatus
  ads_link: string | null
  notes: string | null
}

const allowedStatuses: PostStatus[] = [
  'draft',
  'scheduled',
  'ready',
  'due_now',
  'posted',
  'late',
  'skipped',
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseTimeSlotMinutes(timeSlot: string) {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

function resolveStartPosition(timeSlots: string[], startDate: string, startTimeSlot: string) {
  if (!startTimeSlot) {
    return {
      slotIndex: 0,
      targetDate: startDate,
    }
  }

  const exactSlotIndex = timeSlots.indexOf(startTimeSlot)
  if (exactSlotIndex >= 0) {
    return {
      slotIndex: exactSlotIndex,
      targetDate: startDate,
    }
  }

  const startMinutes = parseTimeSlotMinutes(startTimeSlot)
  if (startMinutes === null) {
    return {
      slotIndex: 0,
      targetDate: startDate,
    }
  }

  const nextSlotIndex = timeSlots.findIndex((timeSlot) => {
    const slotMinutes = parseTimeSlotMinutes(timeSlot)
    return slotMinutes !== null && slotMinutes >= startMinutes
  })

  if (nextSlotIndex >= 0) {
    return {
      slotIndex: nextSlotIndex,
      targetDate: startDate,
    }
  }

  return {
    slotIndex: 0,
    targetDate: addOneDay(startDate),
  }
}

function addOneDay(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setDate(date.getDate() + 1)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildNotes(item: Required<Pick<NormalizedDailyItem, 'title' | 'image' | 'shortLink'>>) {
  return [
    'Imported from Daily Feji extension.',
    `Title: ${item.title}`,
    `Short link: ${item.shortLink}`,
    item.image ? `Image: ${item.image}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function compareSchedule(firstDate: string, firstTimeSlot: string, secondDate: string, secondTimeSlot: string) {
  if (firstDate !== secondDate) {
    return firstDate.localeCompare(secondDate)
  }

  const firstMinutes = parseTimeSlotMinutes(firstTimeSlot)
  const secondMinutes = parseTimeSlotMinutes(secondTimeSlot)
  if (firstMinutes !== null && secondMinutes !== null && firstMinutes !== secondMinutes) {
    return firstMinutes - secondMinutes
  }

  return firstTimeSlot.localeCompare(secondTimeSlot)
}

function appendNotes(currentNotes: string | null, importedNotes: string) {
  return [currentNotes?.trim() ?? '', importedNotes.trim()].filter(Boolean).join('\n\n')
}

type NormalizedDailyItem = {
  title: string
  image: string
  dailyLink: string
  shortLink: string
  domain: string
}

function normalizeItems(value: unknown) {
  const rawItems = Array.isArray(value) ? value : value ? [value] : []
  const errors: string[] = []
  const items: NormalizedDailyItem[] = []

  rawItems.forEach((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object') {
      errors.push(`Item ${index + 1}: must be an object.`)
      return
    }

    const item = rawItem as DailyResultItem
    const itemStatus = readString(item.status)
    if (itemStatus && itemStatus !== 'done') return

    const normalizedItem = {
      title: readString(item.title),
      image: readString(item.image),
      dailyLink: readString(item.dailyLink),
      shortLink: readString(item.shortLink),
      domain: readString(item.domain),
    }

    if (!normalizedItem.title) errors.push(`Item ${index + 1}: title is required.`)
    if (!normalizedItem.image) errors.push(`Item ${index + 1}: image is required.`)
    if (!normalizedItem.shortLink) errors.push(`Item ${index + 1}: shortLink is required.`)

    if (normalizedItem.title && normalizedItem.image && normalizedItem.shortLink) {
      items.push(normalizedItem)
    }
  })

  if (errors.length > 0) {
    throw new Error(errors.slice(0, 10).join('\n'))
  }

  if (items.length === 0) {
    throw new Error('No completed Daily Feji results were provided.')
  }

  return items
}

function requireImportToken(request: Request) {
  const configuredToken = process.env.EXTENSION_IMPORT_TOKEN
  if (!configuredToken) {
    throw new Error('EXTENSION_IMPORT_TOKEN is not configured on the scheduler app.')
  }

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (token !== configuredToken) {
    return false
  }

  return true
}

function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are missing.')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function POST(request: Request) {
  try {
    if (!requireImportToken(request)) {
      return jsonResponse({ error: 'Unauthorized.' }, { status: 401 })
    }

    const payload = (await request.json()) as ImportRequest
    const pageId = readString(payload.pageId)
    const startDate = readString(payload.startDate)
    const startTimeSlot = readString(payload.startTimeSlot)
    const postStatusValue = readString(payload.status)
    const postStatus: PostStatus = allowedStatuses.includes(postStatusValue as PostStatus)
      ? (postStatusValue as PostStatus)
      : 'draft'

    if (!pageId) {
      return jsonResponse({ error: 'pageId is required.' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return jsonResponse({ error: 'startDate must use YYYY-MM-DD format.' }, { status: 400 })
    }

    const items = normalizeItems(payload.items)
    const supabase = createServerSupabaseClient()

    const { data: pageData, error: pageError } = await supabase
      .from('pages')
      .select('id,time_slots')
      .eq('id', pageId)
      .single()

    if (pageError) throw pageError

    const page = pageData as PageRow
    const sortedSlots = [...(page.time_slots ?? [])].sort((first, second) => {
      const firstMinutes = parseTimeSlotMinutes(first)
      const secondMinutes = parseTimeSlotMinutes(second)

      if (firstMinutes !== null && secondMinutes !== null && firstMinutes !== secondMinutes) {
        return firstMinutes - secondMinutes
      }

      return first.localeCompare(second)
    })

    if (sortedSlots.length === 0) {
      return jsonResponse({ error: 'Selected page has no time slots configured.' }, { status: 400 })
    }

    const { data: existingPostsData, error: postsError } = await supabase
      .from('posts')
      .select('id,post_date,time_slot,status,ads_link,notes')
      .eq('page_id', pageId)

    if (postsError) throw postsError

    const startPosition = resolveStartPosition(sortedSlots, startDate, startTimeSlot)
    const startDateForSearch = startPosition.targetDate
    const startTimeSlotForSearch = sortedSlots[startPosition.slotIndex]

    const existingPosts = ((existingPostsData as ExistingPostRow[] | null) ?? []).sort((first, second) =>
      compareSchedule(first.post_date, first.time_slot, second.post_date, second.time_slot)
    )

    const candidatePosts = existingPosts.filter((post) => {
      if (post.status === 'skipped') return false
      if (readString(post.ads_link)) return false
      if (!sortedSlots.includes(post.time_slot)) return false

      return compareSchedule(
        post.post_date,
        post.time_slot,
        startDateForSearch,
        startTimeSlotForSearch
      ) >= 0
    })

    if (candidatePosts.length < items.length) {
      return jsonResponse(
        {
          error: `Not enough posts with empty adsLink from ${startDateForSearch} ${startTimeSlotForSearch}. Needed ${items.length}, found ${candidatePosts.length}.`,
        },
        { status: 400 }
      )
    }

    const updatedRows = []

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const post = candidatePosts[index]
      const importedNotes = [
        buildNotes(item),
        item.dailyLink ? `Daily link: ${item.dailyLink}` : '',
        item.domain ? `Domain: ${item.domain}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const { data: updatedPostRows, error: updateError } = await supabase
        .from('posts')
        .update({
          ads_link: item.shortLink,
          notes: appendNotes(post.notes, importedNotes),
          status: postStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .select('id,post_date,time_slot,caption,ads_link')

      if (updateError) throw updateError
      if (updatedPostRows?.[0]) {
        updatedRows.push(updatedPostRows[0])
      }
    }

    return jsonResponse({
      updated: updatedRows.length,
      posts: updatedRows,
    })
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Failed to import Daily Feji results.',
      },
      { status: 500 }
    )
  }
}

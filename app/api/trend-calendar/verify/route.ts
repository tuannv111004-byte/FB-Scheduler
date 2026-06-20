import { NextResponse } from 'next/server'
import { eventTimingRecords } from '@/lib/event-timing'

type SearchCandidate = {
  title: string
  link: string
  snippet: string
  displayedLink?: string
  date?: string
  type?: 'news' | 'youtube'
}

function buildSearchQuery(eventName: string, recentDays: number) {
  return `"${eventName}" 2026 date official latest when:${recentDays}d`
}

function buildGoogleSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function buildYouTubeSearchUrl(eventName: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${eventName} 2026`)}`
}

function buildGoogleNewsRssUrl(query: string) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
}

function buildYouTubeRssUrl(query: string) {
  return `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(query)}`
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function getTagValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

function stripHtml(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
}

function extractSourceFromTitle(title: string) {
  const parts = title.split(' - ')
  return parts.length > 1 ? parts[parts.length - 1] : undefined
}

function parseGoogleNewsRss(xml: string, recentDays: number): SearchCandidate[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  const cutoff = Date.now() - recentDays * 86400000

  return items.map((item) => {
    const title = getTagValue(item, 'title')
    const link = getTagValue(item, 'link')
    const pubDate = getTagValue(item, 'pubDate')
    const publishedAt = pubDate ? new Date(pubDate).getTime() : Number.NaN
    const description = stripHtml(getTagValue(item, 'description'))

    return {
      title,
      link,
      snippet: description,
      displayedLink: extractSourceFromTitle(title),
      date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
      type: 'news' as const,
      publishedAt,
    }
  })
    .filter((item) => item.title && item.link && Number.isFinite(item.publishedAt) && item.publishedAt >= cutoff)
    .slice(0, 8)
    .map(({ publishedAt: _publishedAt, ...item }) => item)
}

function parseYouTubeRss(xml: string, recentDays: number): SearchCandidate[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? []
  const cutoff = Date.now() - recentDays * 86400000

  return entries.map((entry) => {
    const title = getTagValue(entry, 'title')
    const videoId = getTagValue(entry, 'yt:videoId')
    const published = getTagValue(entry, 'published')
    const updated = getTagValue(entry, 'updated')
    const author = getTagValue(entry, 'name')
    const publishedAt = published ? new Date(published).getTime() : Number.NaN

    return {
      title,
      link: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
      snippet: updated ? `Updated ${updated.slice(0, 10)}` : '',
      displayedLink: author || 'YouTube',
      date: published ? published.slice(0, 10) : undefined,
      type: 'youtube' as const,
      publishedAt,
    }
  })
    .filter((item) => item.title && item.link && Number.isFinite(item.publishedAt) && item.publishedAt >= cutoff)
    .slice(0, 8)
    .map(({ publishedAt: _publishedAt, ...item }) => item)
}

async function searchFreeNews(query: string, recentDays: number) {
  const response = await fetch(buildGoogleNewsRssUrl(query), {
    headers: {
      Accept: 'application/rss+xml,text/xml',
      'User-Agent': 'PostOps Trend Calendar',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Free news check returned ${response.status}`)
  }

  return parseGoogleNewsRss(await response.text(), recentDays)
}

async function searchYouTube(query: string, recentDays: number) {
  const response = await fetch(buildYouTubeRssUrl(query), {
    headers: {
      Accept: 'application/atom+xml,text/xml',
      'User-Agent': 'PostOps Trend Calendar',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    return [] as SearchCandidate[]
  }

  return parseYouTubeRss(await response.text(), recentDays)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const eventId = typeof body.eventId === 'string' ? body.eventId : ''
    const recentDaysInput = Number(body.recentDays)
    const recentDays = Number.isFinite(recentDaysInput)
      ? Math.min(Math.max(Math.round(recentDaysInput), 1), 14)
      : 4
    const event = eventTimingRecords.find((item) => item.id === eventId)

    if (!event) {
      return NextResponse.json({ message: 'Event not found.' }, { status: 404 })
    }

    const query = buildSearchQuery(event.name, recentDays)
    const searchUrl = buildGoogleSearchUrl(query)
    const youtubeSearchUrl = buildYouTubeSearchUrl(event.name)
    const checkedAt = new Date().toISOString()
    const [newsCandidates, youtubeCandidates] = await Promise.all([
      searchFreeNews(query, recentDays),
      searchYouTube(query, recentDays),
    ])
    const candidates = [...youtubeCandidates, ...newsCandidates]

    return NextResponse.json({
      mode: 'free-google-news-rss',
      eventId: event.id,
      eventName: event.name,
      query,
      searchUrl,
      youtubeSearchUrl,
      checkedAt,
      candidates,
      recentDays,
      message: candidates.length
        ? `Free YouTube/news results found from the last ${recentDays} day${recentDays === 1 ? '' : 's'}. Confirm against the official source before treating the date as final.`
        : `No free YouTube/news result found from the last ${recentDays} day${recentDays === 1 ? '' : 's'}. Use the search link or official site before posting as real news.`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Could not run the free latest-info check.',
      },
      { status: 500 }
    )
  }
}

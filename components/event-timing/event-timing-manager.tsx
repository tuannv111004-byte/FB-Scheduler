"use client"

import { useMemo, useState } from 'react'
import { CalendarDays, Copy, Dices, ExternalLink, RefreshCw, Search, Youtube } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import {
  eventCategoryLabels,
  eventTimingRecords,
  formatEventDateRange,
  getDaysUntil,
  getEventPhase,
  type EventPhase,
  type EventTimingCategory,
  type EventTimingRecord,
} from '@/lib/event-timing'

type CategoryFilter = EventTimingCategory | 'all'
type WindowFilter = '3' | '4' | '7' | 'all'
type VerificationResult = {
  eventId: string
  mode: string
  eventName: string
  query: string
  searchUrl: string
  youtubeSearchUrl?: string
  checkedAt: string
  message: string
  candidates: Array<{
    title: string
    link: string
    snippet: string
    displayedLink?: string
    date?: string
    type?: 'news' | 'youtube'
  }>
  recentDays?: number
}

const phaseLabels: Record<EventPhase, string> = {
  upcoming: 'Upcoming',
  today: 'Today',
  past: 'Past',
  concept: 'Concept',
  tba: 'TBA',
}

const phaseBadgeVariant: Record<EventPhase, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  upcoming: 'default',
  today: 'default',
  past: 'secondary',
  concept: 'outline',
  tba: 'outline',
}

function getTimingLabel(event: EventTimingRecord, today: Date) {
  const phase = getEventPhase(event, today)
  const days = getDaysUntil(event, today)

  if (days === null) {
    return event.category === 'concept' ? 'Flexible concept' : 'No exact date'
  }

  if (phase === 'today') {
    return 'Today'
  }

  if (days > 0) {
    return `In ${days} day${days === 1 ? '' : 's'}`
  }

  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
}

function formatVerifiedDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getSourceDate(event: EventTimingRecord) {
  return event.sourcePublishedAt ?? event.verifiedAt
}

function getVerifiedAgeLabel(value: string, today: Date) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const age = Math.max(0, Math.floor((normalizedToday - date.getTime()) / 86400000))

  if (age === 0) {
    return 'today'
  }

  return `${age} day${age === 1 ? '' : 's'} ago`
}

function getAutoPriority(event: EventTimingRecord, today: Date) {
  const phase = getEventPhase(event, today)
  const days = getDaysUntil(event, today)

  if (phase === 'today') {
    return 0
  }

  if (days !== null && days > 0 && days <= 4) {
    return 1
  }

  if (days !== null && days > 4 && days <= 14) {
    return 2
  }

  if (phase === 'tba') {
    return 3
  }

  if (days !== null && days < 0 && Math.abs(days) <= 4) {
    return 4
  }

  if (phase === 'concept') {
    return 7
  }

  return 6
}

function sortEventsBySmartPriority(events: EventTimingRecord[], today: Date) {
  return [...events].sort((first, second) => {
    const firstPriority = getAutoPriority(first, today)
    const secondPriority = getAutoPriority(second, today)

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority
    }

    const firstDays = getDaysUntil(first, today)
    const secondDays = getDaysUntil(second, today)

    if (firstDays === null && secondDays === null) {
      return second.fitScore - first.fitScore
    }

    if (firstDays === null) {
      return 1
    }

    if (secondDays === null) {
      return -1
    }

    const firstFuture = firstDays >= 0
    const secondFuture = secondDays >= 0

    if (firstFuture !== secondFuture) {
      return firstFuture ? -1 : 1
    }

    const dayDistance = Math.abs(firstDays) - Math.abs(secondDays)

    if (dayDistance !== 0) {
      return dayDistance
    }

    return second.fitScore - first.fitScore
  })
}

function getActionLabel(event: EventTimingRecord, today: Date) {
  const phase = getEventPhase(event, today)
  const days = getDaysUntil(event, today)

  if (phase === 'today') {
    return 'Post now'
  }

  if (days !== null && days > 0 && days <= 4) {
    return 'Prepare now'
  }

  if (days !== null && days > 4 && days <= 14) {
    return 'Next up'
  }

  if (phase === 'concept') {
    return 'Filler concept'
  }

  if (phase === 'tba') {
    return 'Verify date'
  }

  if (days !== null && days < 0 && Math.abs(days) <= 4) {
    return 'Recap angle'
  }

  return 'Archive'
}

function getYouTubeSearchUrl(event: EventTimingRecord) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${event.name} 2026`)}`
}

export function EventTimingManager() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [windowDays, setWindowDays] = useState<WindowFilter>('4')
  const [isCheckingAll, setIsCheckingAll] = useState(false)
  const [checkAllProgress, setCheckAllProgress] = useState({ done: 0, total: 0 })
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [verificationResultsById, setVerificationResultsById] = useState<Record<string, VerificationResult>>({})
  const [randomEventId, setRandomEventId] = useState<string | null>(null)
  const today = useMemo(() => new Date(), [])

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const dayLimit = windowDays === 'all' ? null : Number(windowDays)

    const filtered = eventTimingRecords.filter((event) => {
      const matchesCategory = category === 'all' || event.category === category
      const searchable = [
        event.name,
        event.bestUse,
        event.contentAngle,
        event.statusNote,
        event.usualWindow,
      ].join(' ').toLowerCase()
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)
      const days = getDaysUntil(event, today)
      const matchesWindow = (() => {
        if (dayLimit === null) {
          return true
        }

        if (days === null) {
          return false
        }

        return Math.abs(days) <= dayLimit
      })()

      return matchesCategory && matchesQuery && matchesWindow
    })

    return sortEventsBySmartPriority(filtered, today)
  }, [category, query, today, windowDays])

  const nextUpcomingEvents = useMemo(() => {
    return sortEventsBySmartPriority(
      eventTimingRecords.filter((event) => {
        const days = getDaysUntil(event, today)
        return days !== null && days >= 0
      }),
      today
    ).slice(0, 5)
  }, [today])

  const visibleEvents = useMemo(() => {
    const baseEvents = filteredEvents.length > 0 ? filteredEvents : nextUpcomingEvents
    if (!randomEventId) {
      return baseEvents
    }

    const randomEvent = eventTimingRecords.find((event) => event.id === randomEventId)
    if (!randomEvent) {
      return baseEvents
    }

    return [randomEvent, ...baseEvents.filter((event) => event.id !== randomEvent.id)]
  }, [filteredEvents, nextUpcomingEvents, randomEventId])
  const isFallback = filteredEvents.length === 0

  const pickRandomEvent = () => {
    const pool = filteredEvents.length > 0 ? filteredEvents : eventTimingRecords
    const randomEvent = pool[Math.floor(Math.random() * pool.length)]
    setRandomEventId(randomEvent.id)
    window.open(getYouTubeSearchUrl(randomEvent), '_blank', 'noopener,noreferrer')
    toast({
      title: 'Random YouTube search opened',
      description: randomEvent.name,
    })
  }

  const copyEvents = async () => {
    const lines = [
      `Auto event plan - updated ${today.toISOString().slice(0, 10)}`,
      '',
      'Rank | Event | Time | Action | Source date | Checked | Best use',
      '--- | --- | --- | --- | --- | --- | ---',
      ...visibleEvents.map((event, index) => (
        `${index + 1} | ${event.name} | ${formatEventDateRange(event)} (${getTimingLabel(event, today)}) | ${getActionLabel(event, today)} | ${formatVerifiedDate(getSourceDate(event))} | ${formatVerifiedDate(event.verifiedAt)} | ${event.bestUse}`
      )),
    ]

    await navigator.clipboard.writeText(lines.join('\n'))
    toast({
      title: 'Copied event board',
      description: `${visibleEvents.length} event${visibleEvents.length === 1 ? '' : 's'} copied.`,
    })
  }

  const getRecentCheckDays = () => {
    return windowDays === 'all' ? 4 : Number(windowDays)
  }

  const fetchVerification = async (eventId: string) => {
    const response = await fetch('/api/trend-calendar/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, recentDays: getRecentCheckDays() }),
    })
    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload.message || 'Could not check latest info.')
    }

    return payload as VerificationResult
  }

  const checkAllLatest = async () => {
    const eventsToCheck = eventTimingRecords
    setIsCheckingAll(true)
    setVerificationResult(null)
    setCheckAllProgress({ done: 0, total: eventsToCheck.length })

    let successCount = 0
    let resultCount = 0

    for (const event of eventsToCheck) {
      try {
        const payload = await fetchVerification(event.id)
        successCount += 1
        resultCount += payload.candidates.length
        setVerificationResultsById((current) => ({ ...current, [event.id]: payload }))
      } catch {
        // Keep checking the remaining events; free RSS can occasionally miss or rate-limit.
      } finally {
        setCheckAllProgress((current) => ({ ...current, done: current.done + 1 }))
      }
    }

    setIsCheckingAll(false)
    toast({
      title: 'All-event check complete',
      description: `Checked ${successCount}/${eventsToCheck.length} events and found ${resultCount} free result${resultCount === 1 ? '' : 's'}.`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Window</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">+/- {windowDays === 'all' ? 'All' : windowDays}d</p>
            <p className="mt-1 text-sm text-muted-foreground">Default is the 3-4 day view.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{visibleEvents.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFallback ? 'Showing next upcoming.' : 'In the selected window.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Fit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{visibleEvents[0]?.fitScore ?? 0}/10</p>
            <p className="mt-1 text-sm text-muted-foreground">{visibleEvents[0]?.name ?? 'No event'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Source Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {visibleEvents[0] ? formatVerifiedDate(getSourceDate(visibleEvents[0])) : 'No data'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Published/updated date from the source.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Event Timing Finder
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Automatically ranks what to post, prepare, verify, or use as filler.
              </p>
            </div>
            <Button type="button" onClick={copyEvents}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Board
            </Button>
            <Button type="button" variant="outline" onClick={() => void checkAllLatest()} disabled={isCheckingAll}>
              <RefreshCw className={isCheckingAll ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              {isCheckingAll ? `Checking ${checkAllProgress.done}/${checkAllProgress.total}` : 'Check All'}
            </Button>
            <Button type="button" variant="outline" onClick={pickRandomEvent}>
              <Dices className="mr-2 h-4 w-4" />
              Random
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery('')
                setCategory('all')
                setWindowDays('all')
              }}
            >
              Show All
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search NBA, BET, sneaker, WNBA, gala..."
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(eventCategoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={windowDays} onValueChange={(value) => setWindowDays(value as WindowFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">+/- 3 days</SelectItem>
                <SelectItem value="4">+/- 4 days</SelectItem>
                <SelectItem value="7">+/- 7 days</SelectItem>
                <SelectItem value="all">All events</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isFallback ? (
            <div className="mb-4 rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              No event matched the exact window, so the board is showing the next upcoming usable events.
            </div>
          ) : null}

          {isCheckingAll ? (
            <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              Checking all shows with free Google News RSS: {checkAllProgress.done} / {checkAllProgress.total}
            </div>
          ) : null}

          {verificationResult ? (
            <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-semibold text-foreground">Free latest check: {verificationResult.eventName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{verificationResult.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Checked {new Date(verificationResult.checkedAt).toLocaleString()} via YouTube RSS + Google News RSS
                    {verificationResult.recentDays ? `, last ${verificationResult.recentDays} day${verificationResult.recentDays === 1 ? '' : 's'} only` : ''}.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={verificationResult.youtubeSearchUrl ?? verificationResult.searchUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    YouTube Search
                  </a>
                </Button>
              </div>
              {verificationResult.candidates.length ? (
                <div className="mt-4 grid gap-3">
                  {verificationResult.candidates.map((candidate) => (
                    <a
                      key={candidate.link}
                      href={candidate.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {candidate.date ? <Badge variant="secondary">{candidate.date}</Badge> : null}
                        {candidate.type ? (
                          <Badge variant={candidate.type === 'youtube' ? 'default' : 'outline'}>
                            {candidate.type === 'youtube' ? 'YouTube' : 'News'}
                          </Badge>
                        ) : null}
                        {candidate.displayedLink ? <Badge variant="outline">{candidate.displayedLink}</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">{candidate.title}</p>
                      {candidate.snippet ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{candidate.snippet}</p>
                      ) : null}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Use</TableHead>
                  <TableHead>Angle</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEvents.map((event, index) => {
                  const phase = getEventPhase(event, today)
                  const checkedResult = verificationResultsById[event.id]

                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-semibold text-muted-foreground">
                        #{index + 1}
                      </TableCell>
                      <TableCell className="min-w-52 whitespace-normal">
                        <div className="font-medium text-foreground">{event.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline">{eventCategoryLabels[event.category]}</Badge>
                          <Badge variant="secondary">{event.fitScore}/10</Badge>
                          {event.id === randomEventId ? <Badge>Random Pick</Badge> : null}
                          {checkedResult ? (
                            <Badge variant={checkedResult.candidates.length ? 'default' : 'outline'}>
                              {checkedResult.candidates.length} result{checkedResult.candidates.length === 1 ? '' : 's'}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-40 whitespace-normal">
                        <div>{formatEventDateRange(event)}</div>
                        <div className="text-sm text-muted-foreground">{getTimingLabel(event, today)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={phaseBadgeVariant[phase]}>{phaseLabels[phase]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={index === 0 ? 'default' : 'outline'}>{getActionLabel(event, today)}</Badge>
                      </TableCell>
                      <TableCell className="min-w-36 whitespace-normal">
                        <div className="text-sm font-medium text-foreground">
                          {formatVerifiedDate(getSourceDate(event))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {event.sourcePublishedAt
                            ? `Published ${getVerifiedAgeLabel(event.sourcePublishedAt, today)}`
                            : `Checked ${formatVerifiedDate(event.verifiedAt)}`}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal text-sm text-muted-foreground">
                        {event.bestUse}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal text-sm">
                        {event.contentAngle}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <a href={getYouTubeSearchUrl(event)} target="_blank" rel="noreferrer">
                            <Youtube className="mr-2 h-4 w-4" />
                            YouTube Search
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { Clock, Plus, CheckCircle2 } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import Link from 'next/link'

interface SlotInfo {
  page: { id: string; name: string }
  timeSlot: string
  post: { id: string; caption: string; status: string } | null
  isPast: boolean
}

export function UpcomingSlotsWidget() {
  const { pages, posts, selectedDate, markAsPosted } = useAppStore()

  const activePages = pages.filter((p) => p.isActive)
  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  // Get all slots for today, sorted by time
  const allSlots: SlotInfo[] = []
  activePages.forEach((page) => {
    page.timeSlots.forEach((timeSlot) => {
      const post = posts.find(
        (p) => p.pageId === page.id && p.postDate === selectedDate && p.timeSlot === timeSlot
      )
      allSlots.push({
        page: { id: page.id, name: page.name },
        timeSlot,
        post: post ? { id: post.id, caption: post.caption, status: post.status } : null,
        isPast: timeSlot < currentTime,
      })
    })
  })

  // Sort by time and filter upcoming/current
  const sortedSlots = allSlots
    .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
    .filter((slot) => {
      // Show slots from 2 hours ago to future
      const slotHour = parseInt(slot.timeSlot.split(':')[0])
      const currentHour = now.getHours()
      return slotHour >= currentHour - 2
    })
    .slice(0, 8)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Upcoming Slots
          </CardTitle>
          <Link href="/schedule">
            <Button variant="ghost" size="sm" className="text-xs">
              View Schedule
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedSlots.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No more slots today
            </p>
          ) : (
            sortedSlots.map((slot, idx) => (
              <div
                key={`${slot.page.id}-${slot.timeSlot}-${idx}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-2.5"
              >
                <div className="flex h-10 w-14 flex-col items-center justify-center rounded bg-background">
                  <span className="text-sm font-bold text-foreground">{slot.timeSlot}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{slot.page.name}</p>
                  {slot.post ? (
                    <p className="text-sm text-foreground truncate">{slot.post.caption}</p>
                  ) : (
                    <p className="text-sm text-amber-400">Empty slot</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {slot.post ? (
                    <>
                      <StatusBadge status={slot.post.status as any} size="sm" />
                      {slot.post.status !== 'posted' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          onClick={() => markAsPosted(slot.post!.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Link href={`/posts/new?page=${slot.page.id}&time=${slot.timeSlot}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

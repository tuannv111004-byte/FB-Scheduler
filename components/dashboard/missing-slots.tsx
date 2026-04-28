"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { AlertCircle, Plus } from 'lucide-react'
import Link from 'next/link'

interface MissingSlot {
  page: { id: string; name: string }
  timeSlot: string
  isPast: boolean
}

export function MissingSlotsWidget() {
  const { pages, posts, selectedDate } = useAppStore()

  const activePages = pages.filter((p) => p.isActive)
  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  // Find all missing slots
  const missingSlots: MissingSlot[] = []
  activePages.forEach((page) => {
    page.timeSlots.forEach((timeSlot) => {
      const hasPost = posts.some(
        (p) => p.pageId === page.id && p.postDate === selectedDate && p.timeSlot === timeSlot
      )
      if (!hasPost) {
        missingSlots.push({
          page: { id: page.id, name: page.name },
          timeSlot,
          isPast: timeSlot < currentTime,
        })
      }
    })
  })

  // Sort: past slots first (critical), then upcoming
  const sortedMissingSlots = missingSlots.sort((a, b) => {
    if (a.isPast !== b.isPast) return a.isPast ? -1 : 1
    return a.timeSlot.localeCompare(b.timeSlot)
  })

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertCircle className="h-4 w-4 text-orange-400" />
            Missing Slots
          </CardTitle>
          {sortedMissingSlots.length > 0 && (
            <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">
              {sortedMissingSlots.length} empty
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedMissingSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-500/10 p-3">
              <AlertCircle className="h-6 w-6 text-green-400" />
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">All slots filled!</p>
            <p className="text-xs text-muted-foreground">Every time slot has a post assigned</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sortedMissingSlots.slice(0, 6).map((slot, idx) => (
              <div
                key={`${slot.page.id}-${slot.timeSlot}-${idx}`}
                className={`flex items-center justify-between rounded-lg border p-2.5 ${
                  slot.isPast
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-orange-500/30 bg-orange-500/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-12 items-center justify-center rounded text-sm font-bold ${
                    slot.isPast ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {slot.timeSlot}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{slot.page.name}</p>
                    <p className={`text-xs ${slot.isPast ? 'text-red-400' : 'text-orange-400'}`}>
                      {slot.isPast ? 'Missed' : 'Upcoming'}
                    </p>
                  </div>
                </div>
                <Link href={`/posts/new?page=${slot.page.id}&time=${slot.timeSlot}&date=${selectedDate}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={slot.isPast ? 'text-red-400 hover:text-red-300' : 'text-orange-400 hover:text-orange-300'}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </Link>
              </div>
            ))}
            {sortedMissingSlots.length > 6 && (
              <Link href="/schedule">
                <Button variant="outline" className="w-full" size="sm">
                  View All {sortedMissingSlots.length} Missing Slots
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

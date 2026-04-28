"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import {
  Plus,
  CheckCircle2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { PostModal } from '@/components/posts/post-modal'
import { cn } from '@/lib/utils'
import { format, addDays, subDays } from 'date-fns'
import type { Post } from '@/lib/types'

export function ScheduleBoard() {
  const { pages, posts, selectedDate, setSelectedDate, markAsPosted } = useAppStore()
  const [filterPage, setFilterPage] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [defaultSlot, setDefaultSlot] = useState<{ pageId: string; timeSlot: string } | null>(null)

  const activePages = pages.filter((p) => p.isActive)
  const filteredPages = filterPage === 'all' 
    ? activePages 
    : activePages.filter((p) => p.id === filterPage)

  // Get all unique time slots across selected pages, sorted
  const allTimeSlots = [...new Set(filteredPages.flatMap((p) => p.timeSlots))].sort()

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const isToday = selectedDate === format(now, 'yyyy-MM-dd')

  const getPostForSlot = (pageId: string, timeSlot: string) => {
    return posts.find(
      (p) => p.pageId === pageId && p.postDate === selectedDate && p.timeSlot === timeSlot
    )
  }

  const handlePrevDay = () => {
    setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))
  }

  const handleNextDay = () => {
    setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))
  }

  const handleToday = () => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const handleAddPost = (pageId: string, timeSlot: string) => {
    setEditingPost(null)
    setDefaultSlot({ pageId, timeSlot })
    setModalOpen(true)
  }

  const handleEditPost = (post: Post) => {
    setEditingPost(post)
    setDefaultSlot(null)
    setModalOpen(true)
  }

  const isSlotPast = (timeSlot: string) => {
    return isToday && timeSlot < currentTime
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
          <CardTitle className="text-lg font-semibold">Daily Schedule</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
              <Button variant="outline" size="sm" onClick={handleToday}>
                <Calendar className="h-4 w-4 mr-1" />
                Today
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={handleNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Select value={filterPage} onValueChange={setFilterPage}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Pages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem>
                {activePages.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header Row - Page Names */}
              <div className="flex border-b border-border">
                <div className="w-20 shrink-0 p-3 text-sm font-medium text-muted-foreground">
                  Time
                </div>
                {filteredPages.map((page) => (
                  <div
                    key={page.id}
                    className="flex-1 min-w-40 p-3 text-sm font-medium text-foreground border-l border-border"
                  >
                    <div className="flex items-center gap-2">
                      {page.logoUrl ? (
                        <img
                          src={page.logoUrl}
                          alt=""
                          className="h-6 w-6 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <span
                          className="inline-flex h-3 w-3 rounded-full"
                          style={{ backgroundColor: page.brandColor }}
                        />
                      )}
                      <span>{page.name}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Time Slot Rows */}
              {allTimeSlots.map((timeSlot) => {
                const isPast = isSlotPast(timeSlot)
                return (
                  <div
                    key={timeSlot}
                    className={cn(
                      'flex border-b border-border',
                      isPast && 'bg-muted/30'
                    )}
                  >
                    {/* Time Column */}
                    <div
                      className={cn(
                        'w-20 shrink-0 p-3 text-sm font-medium',
                        isPast ? 'text-muted-foreground' : 'text-foreground'
                      )}
                    >
                      {timeSlot}
                    </div>

                    {/* Page Columns */}
                    {filteredPages.map((page) => {
                      const hasSlot = page.timeSlots.includes(timeSlot)
                      const post = hasSlot ? getPostForSlot(page.id, timeSlot) : null

                      if (!hasSlot) {
                        return (
                          <div
                            key={page.id}
                            className="flex-1 min-w-40 p-2 border-l border-border bg-secondary/20"
                          >
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                              No slot
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={page.id}
                          className="flex-1 min-w-40 p-2 border-l border-border"
                        >
                          {post ? (
                            <div
                              className={cn(
                                'rounded-lg border p-2.5 cursor-pointer transition-colors hover:bg-accent/50',
                                post.status === 'posted' && 'border-green-500/30 bg-green-500/5',
                                post.status === 'late' && 'border-red-500/30 bg-red-500/5',
                                post.status === 'due_now' && 'border-amber-500/30 bg-amber-500/5',
                                post.status === 'scheduled' && 'border-blue-500/30 bg-blue-500/5',
                                post.status === 'ready' && 'border-emerald-500/30 bg-emerald-500/5',
                                post.status === 'draft' && 'border-border bg-secondary/30'
                              )}
                              onClick={() => handleEditPost(post)}
                            >
                              <div className="flex items-start gap-2">
                                {post.imageUrl ? (
                                  <img
                                    src={post.imageUrl}
                                    alt=""
                                    className="h-10 w-10 rounded object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded bg-secondary shrink-0">
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-foreground line-clamp-2">
                                    {post.caption}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <StatusBadge status={post.status} size="sm" />
                                {post.status !== 'posted' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      markAsPosted(post.id)
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              className={cn(
                                'h-full min-h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors',
                                isPast
                                  ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                                  : 'border-border hover:border-primary/50 hover:bg-accent/30'
                              )}
                              onClick={() => handleAddPost(page.id, timeSlot)}
                            >
                              <Plus className={cn(
                                'h-5 w-5',
                                isPast ? 'text-red-400' : 'text-muted-foreground'
                              )} />
                              <span className={cn(
                                'text-xs',
                                isPast ? 'text-red-400' : 'text-muted-foreground'
                              )}>
                                {isPast ? 'Missed' : 'Empty Slot'}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-border">
            <span className="text-xs text-muted-foreground">Status:</span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs text-muted-foreground">Posted</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-xs text-muted-foreground">Scheduled</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs text-muted-foreground">Due Now</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-xs text-muted-foreground">Late</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-gray-400" />
              <span className="text-xs text-muted-foreground">Draft</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <PostModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        post={editingPost}
        defaultPageId={defaultSlot?.pageId}
        defaultTimeSlot={defaultSlot?.timeSlot}
        defaultDate={selectedDate}
      />
    </>
  )
}

"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/lib/store'
import {
  Plus,
  CheckCircle2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  GripVertical,
} from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { PostModal } from '@/components/posts/post-modal'
import { cn } from '@/lib/utils'
import { format, addDays, subDays } from 'date-fns'
import type { Post } from '@/lib/types'

const scheduleSettingsStorageKey = 'postops:schedule-settings'
const defaultScheduleSlots = ['08:00', '15:00', '20:00', '22:00', '04:00'] as const

type ScheduleSettings = {
  selectedPageIds?: string[]
  pageOrderIds?: string[]
  zebraPrimaryColor?: string
  zebraSecondaryColor?: string
  zebraIntensity?: number
  pageGroupSize?: number
  showAllPages?: boolean
  pageGroupIndex?: number
}

function readScheduleSettings(): ScheduleSettings {
  if (typeof window === 'undefined') return {}

  try {
    const rawValue = window.localStorage.getItem(scheduleSettingsStorageKey)
    if (!rawValue) return {}

    const parsedValue = JSON.parse(rawValue)
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {}
  } catch {
    return {}
  }
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
}

function hexToRgba(hex: string, alpha: number) {
  const normalizedHex = hex.replace('#', '')
  if (!/^[\da-f]{6}$/i.test(normalizedHex)) return `rgba(20, 184, 166, ${alpha})`

  const red = parseInt(normalizedHex.slice(0, 2), 16)
  const green = parseInt(normalizedHex.slice(2, 4), 16)
  const blue = parseInt(normalizedHex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function ScheduleBoard() {
  const { pages, posts, selectedDate, setSelectedDate, markAsPosted } = useAppStore()
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(() => {
    const savedValue = readScheduleSettings().selectedPageIds
    return Array.isArray(savedValue) ? savedValue.filter((id) => typeof id === 'string') : []
  })
  const [pageOrderIds, setPageOrderIds] = useState<string[]>(() => {
    const savedValue = readScheduleSettings().pageOrderIds
    return Array.isArray(savedValue) ? savedValue.filter((id) => typeof id === 'string') : []
  })
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
  const [zebraPrimaryColor, setZebraPrimaryColor] = useState(() => {
    const savedValue = readScheduleSettings().zebraPrimaryColor
    return isHexColor(savedValue) ? savedValue : '#94a3b8'
  })
  const [zebraSecondaryColor, setZebraSecondaryColor] = useState(() => {
    const savedValue = readScheduleSettings().zebraSecondaryColor
    return isHexColor(savedValue) ? savedValue : '#14b8a6'
  })
  const [zebraIntensity, setZebraIntensity] = useState(() => {
    const savedValue = readScheduleSettings().zebraIntensity
    return typeof savedValue === 'number' ? Math.max(0, Math.min(savedValue, 30)) : 8
  })
  const [pageGroupSize, setPageGroupSize] = useState(() => {
    const savedValue = readScheduleSettings().pageGroupSize
    return typeof savedValue === 'number' ? Math.max(1, Math.floor(savedValue)) : 4
  })
  const [pageGroupSizeInput, setPageGroupSizeInput] = useState(() => {
    const savedValue = readScheduleSettings().pageGroupSize
    return String(typeof savedValue === 'number' ? Math.max(1, Math.floor(savedValue)) : 4)
  })
  const [showAllPages, setShowAllPages] = useState(() => readScheduleSettings().showAllPages === true)
  const [pageGroupIndex, setPageGroupIndex] = useState(() => {
    const savedValue = readScheduleSettings().pageGroupIndex
    return typeof savedValue === 'number' ? Math.max(0, Math.floor(savedValue)) : 0
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [defaultSlot, setDefaultSlot] = useState<{ pageId: string; timeSlot: string } | null>(null)

  const activePages = pages.filter((p) => p.isActive)
  const activePageOrder = useMemo(() => {
    const pageById = new Map(activePages.map((page) => [page.id, page]))
    const orderedPages = pageOrderIds
      .map((id) => pageById.get(id))
      .filter((page): page is (typeof activePages)[number] => Boolean(page))
    const unorderedPages = activePages.filter((page) => !pageOrderIds.includes(page.id))

    return [...orderedPages, ...unorderedPages]
  }, [activePages, pageOrderIds])
  const selectedPageIdSet = useMemo(() => new Set(selectedPageIds), [selectedPageIds])
  const filteredPages = activePageOrder.filter((p) => selectedPageIdSet.has(p.id))
  const normalizedPageGroupSize = Math.max(1, Math.min(pageGroupSize, Math.max(filteredPages.length, 1)))
  const pagesPerGroup = showAllPages ? Math.max(filteredPages.length, 1) : normalizedPageGroupSize
  const pageGroupCount = Math.max(1, Math.ceil(filteredPages.length / pagesPerGroup))
  const visiblePageStart = pageGroupIndex * pagesPerGroup
  const visiblePages = filteredPages.slice(visiblePageStart, visiblePageStart + pagesPerGroup)
  const visiblePageEnd = visiblePageStart + visiblePages.length
  const allPagesSelected = activePages.length > 0 && selectedPageIds.length === activePages.length
  const pageFilterLabel = activePages.length === 0
    ? 'No Pages'
    : allPagesSelected
    ? 'All Pages'
    : selectedPageIds.length === 1
      ? activePages.find((page) => page.id === selectedPageIds[0])?.name ?? '1 Page'
      : `${selectedPageIds.length} Pages`
  const pageRangeLabel =
    filteredPages.length === 0
      ? 'Pages 0 of 0'
      : `Pages ${visiblePageStart + 1}-${visiblePageEnd} of ${filteredPages.length}`

  const allTimeSlots = defaultScheduleSlots

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const isToday = selectedDate === format(now, 'yyyy-MM-dd')

  const getSlotDate = (timeSlot: string) => {
    return timeSlot === '04:00'
      ? format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd')
      : selectedDate
  }

  const getPostForSlot = (pageId: string, timeSlot: string) => {
    return posts.find(
      (p) => p.pageId === pageId && p.postDate === getSlotDate(timeSlot) && p.timeSlot === timeSlot
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

  const handlePrevPageGroup = () => {
    setPageGroupIndex((current) => Math.max(0, current - 1))
  }

  const handleNextPageGroup = () => {
    setPageGroupIndex((current) => Math.min(pageGroupCount - 1, current + 1))
  }

  const commitPageGroupSizeInput = (value: string) => {
    const nextValue = Math.max(1, Math.floor(Number(value) || 1))
    setPageGroupSize(nextValue)
    setPageGroupSizeInput(String(nextValue))
    setShowAllPages(false)
    setPageGroupIndex(0)
  }

  const toggleAllPages = () => {
    setSelectedPageIds(activePages.map((page) => page.id))
  }

  const togglePage = (pageId: string) => {
    setSelectedPageIds((current) => {
      if (current.includes(pageId)) {
        return current.length > 1 ? current.filter((id) => id !== pageId) : current
      }

      return [...current, pageId]
    })
  }

  const movePage = (fromPageId: string, toPageId: string) => {
    if (fromPageId === toPageId) return

    setPageOrderIds((current) => {
      const activePageIds = activePageOrder.map((page) => page.id)
      const nextOrder = activePageIds.filter((id) => current.includes(id) || id === fromPageId)
      const fromIndex = nextOrder.indexOf(fromPageId)
      const toIndex = nextOrder.indexOf(toPageId)

      if (fromIndex === -1 || toIndex === -1) return current

      const [movedPageId] = nextOrder.splice(fromIndex, 1)
      nextOrder.splice(toIndex, 0, movedPageId)

      return nextOrder
    })
  }

  const handlePageDragOver = (event: React.DragEvent<HTMLDivElement>, targetPageId: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (draggedPageId && draggedPageId !== targetPageId) {
      movePage(draggedPageId, targetPageId)
    }
  }

  const getZebraBackground = (pageIndex: number) => {
    const colorAlpha = zebraIntensity / 100

    return pageIndex % 2 === 0
      ? hexToRgba(zebraPrimaryColor, colorAlpha)
      : hexToRgba(zebraSecondaryColor, colorAlpha)
  }

  const getZebraHeaderBackground = (pageIndex: number) => {
    const colorAlpha = Math.min(0.28, zebraIntensity / 70)

    return pageIndex % 2 === 0
      ? hexToRgba(zebraPrimaryColor, colorAlpha)
      : hexToRgba(zebraSecondaryColor, colorAlpha)
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
    if (timeSlot === '04:00') return false
    return isToday && timeSlot < currentTime
  }

  useEffect(() => {
    if (activePages.length === 0) return

    setSelectedPageIds((current) => {
      const activePageIds = activePages.map((page) => page.id)
      const nextSelectedPageIds = current.filter((id) => activePageIds.includes(id))

      if (nextSelectedPageIds.length > 0) {
        return nextSelectedPageIds
      }

      return activePageIds
    })
  }, [pages])

  useEffect(() => {
    if (activePages.length === 0) return

    setPageOrderIds((current) => {
      const activePageIds = activePages.map((page) => page.id)
      const keptPageIds = current.filter((id) => activePageIds.includes(id))
      const newPageIds = activePageIds.filter((id) => !keptPageIds.includes(id))

      return [...keptPageIds, ...newPageIds]
    })
  }, [pages])

  useEffect(() => {
    setPageGroupIndex((current) => Math.min(current, pageGroupCount - 1))
  }, [pageGroupCount])

  useEffect(() => {
    window.localStorage.setItem(
      scheduleSettingsStorageKey,
      JSON.stringify({
        selectedPageIds,
        pageOrderIds,
        zebraPrimaryColor,
        zebraSecondaryColor,
        zebraIntensity,
        pageGroupSize,
        showAllPages,
        pageGroupIndex,
      } satisfies ScheduleSettings)
    )
  }, [
    selectedPageIds,
    pageOrderIds,
    zebraPrimaryColor,
    zebraSecondaryColor,
    zebraIntensity,
    pageGroupSize,
    showAllPages,
    pageGroupIndex,
  ])

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
          <CardTitle className="text-lg font-semibold">Daily Schedule</CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-44 justify-between">
                  <span className="truncate">{pageFilterLabel}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuCheckboxItem
                  checked={allPagesSelected}
                  onCheckedChange={toggleAllPages}
                  onSelect={(event) => event.preventDefault()}
                >
                  All Pages
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {activePages.map((page) => (
                  <DropdownMenuCheckboxItem
                    key={page.id}
                    checked={selectedPageIdSet.has(page.id)}
                    onCheckedChange={() => togglePage(page.id)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {page.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Input
              type="number"
              min={1}
              max={Math.max(filteredPages.length, 1)}
              value={pageGroupSizeInput}
              onChange={(event) => {
                const nextValue = event.target.value
                setPageGroupSizeInput(nextValue)
                if (nextValue === '') return
                setPageGroupSize(Math.max(1, Math.floor(Number(nextValue) || 1)))
                setShowAllPages(false)
                setPageGroupIndex(0)
              }}
              onBlur={(event) => commitPageGroupSizeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitPageGroupSizeInput(event.currentTarget.value)
                  event.currentTarget.blur()
                }
              }}
              className="w-20"
              title="Pages shown"
            />
            <Button
              variant={showAllPages ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setShowAllPages((current) => !current)
                setPageGroupIndex(0)
              }}
            >
              All
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevPageGroup}
                disabled={pageGroupIndex === 0 || showAllPages}
                title="Previous page group"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-24 text-center text-xs text-muted-foreground">
                {pageRangeLabel}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextPageGroup}
                disabled={pageGroupIndex >= pageGroupCount - 1 || showAllPages}
                title="Next page group"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Input
              type="color"
              value={zebraPrimaryColor}
              onChange={(event) => setZebraPrimaryColor(event.target.value)}
              className="h-9 w-12 cursor-pointer p-1"
              title="Zebra first color"
            />
            <Input
              type="color"
              value={zebraSecondaryColor}
              onChange={(event) => setZebraSecondaryColor(event.target.value)}
              className="h-9 w-12 cursor-pointer p-1"
              title="Zebra second color"
            />
            <Input
              type="range"
              min="0"
              max="30"
              step="1"
              value={zebraIntensity}
              onChange={(event) => setZebraIntensity(Number(event.target.value))}
              className="w-36 cursor-pointer"
              title="Zebra intensity"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="w-max min-w-full border-r border-border">
              {/* Header Row - Page Names */}
              <div className="sticky top-0 z-20 flex border-b-2 border-border bg-card shadow-sm">
                <div className="w-20 shrink-0 border-r border-border bg-muted/50 p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Time
                </div>
                {visiblePages.map((page, pageIndex) => (
                  <div
                    key={page.id}
                    style={{ backgroundColor: getZebraHeaderBackground(pageIndex) }}
                    draggable
                    onDragStart={(event) => {
                      setDraggedPageId(page.id)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', page.id)
                      const dragImage = document.createElement('canvas')
                      dragImage.width = 1
                      dragImage.height = 1
                      event.dataTransfer.setDragImage(dragImage, 0, 0)
                    }}
                    onDragOver={(event) => handlePageDragOver(event, page.id)}
                    onDragEnter={(event) => handlePageDragOver(event, page.id)}
                    onDrop={(event) => {
                      event.preventDefault()
                      setDraggedPageId(null)
                    }}
                    onDragEnd={() => setDraggedPageId(null)}
                    className={cn(
                      'w-44 shrink-0 cursor-grab border-l border-border p-2.5 text-sm font-semibold text-foreground shadow-[inset_0_-1px_0_hsl(var(--border))] transition-[background-color,box-shadow,transform] duration-300 ease-out active:cursor-grabbing',
                      draggedPageId === page.id && 'relative z-10 -translate-y-0.5 scale-[1.015] bg-accent/40 shadow-lg ring-1 ring-primary/40'
                    )}
                    title="Drag to reorder page columns"
                  >
                    <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background/70 px-2 py-1.5 shadow-xs">
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {page.logoUrl ? (
                        <img
                          src={page.logoUrl}
                          alt=""
                          className="h-7 w-7 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                          style={{ backgroundColor: page.brandColor }}
                        >
                          {page.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate">{page.name}</span>
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
                      'flex border-b border-border last:border-b-0',
                      isPast && 'bg-muted/30'
                    )}
                  >
                    {/* Time Column */}
                    <div
                      className={cn(
                        'w-20 shrink-0 border-r border-border p-3 text-sm font-medium',
                        isPast ? 'text-muted-foreground' : 'text-foreground'
                      )}
                    >
                      {timeSlot === '04:00' ? '04:00 (+1d)' : timeSlot}
                    </div>

                    {/* Page Columns */}
                    {visiblePages.map((page, pageIndex) => {
                      const hasSlot = page.timeSlots.includes(timeSlot)
                      const post = hasSlot ? getPostForSlot(page.id, timeSlot) : null
                      const cellBackground = getZebraBackground(pageIndex)

                      if (!hasSlot) {
                        return (
                        <div
                          key={page.id}
                          style={{ backgroundColor: cellBackground }}
                          className={cn(
                            'w-44 shrink-0 border-l border-border p-2 transition-[background-color,box-shadow,transform] duration-300 ease-out',
                            draggedPageId === page.id && 'relative z-10 scale-[1.01] bg-accent/30 shadow-md ring-1 ring-primary/20'
                          )}
                        >
                            <div className="flex h-full min-h-20 items-center justify-center rounded-md border border-dashed border-border/40 bg-muted/45 text-xs text-muted-foreground/55 shadow-inner">
                              No slot
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={page.id}
                          style={{ backgroundColor: cellBackground }}
                          className={cn(
                            'w-44 shrink-0 border-l border-border p-2 transition-[background-color,box-shadow,transform] duration-300 ease-out',
                            draggedPageId === page.id && 'relative z-10 scale-[1.01] bg-accent/20 shadow-md ring-1 ring-primary/20'
                          )}
                        >
                          {post ? (
                            <div
                              className={cn(
                                'rounded-lg border bg-card p-2.5 cursor-pointer shadow-xs transition-colors hover:bg-accent/50',
                                post.status === 'posted' && 'border-green-500/40 shadow-green-500/10',
                                post.status === 'late' && 'border-red-500/40 shadow-red-500/10',
                                post.status === 'due_now' && 'border-amber-500/40 shadow-amber-500/10',
                                post.status === 'scheduled' && 'border-blue-500/40 shadow-blue-500/10',
                                post.status === 'ready' && 'border-emerald-500/40 shadow-emerald-500/10',
                                post.status === 'draft' && 'border-border bg-secondary'
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
                                'h-full min-h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer bg-card shadow-xs transition-colors',
                                isPast
                                  ? 'border-red-500/40 hover:bg-red-500/10'
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
        defaultDate={defaultSlot ? getSlotDate(defaultSlot.timeSlot) : selectedDate}
      />
    </>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
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
  Video,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { PostModal } from '@/components/posts/post-modal'
import { cn } from '@/lib/utils'
import {
  getGoogleDriveThumbnailUrl,
  isGoogleDriveUrl,
  isMediaUploadErrorPath,
  isUploadingMediaPath,
  isVideoUrl,
} from '@/lib/media-utils'
import { format, addDays, subDays } from 'date-fns'
import type { Post } from '@/lib/types'

const scheduleSettingsStorageKey = 'postops:schedule-settings'
const nextDaySlotBoundaryMinutes = 6 * 60

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

function parseTimeSlotMinutes(timeSlot: string) {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

function isNextDaySlot(timeSlot: string) {
  const minutes = parseTimeSlotMinutes(timeSlot)
  return minutes !== null && minutes < nextDaySlotBoundaryMinutes
}

function compareBoardTimeSlots(first: string, second: string) {
  const firstMinutes = parseTimeSlotMinutes(first)
  const secondMinutes = parseTimeSlotMinutes(second)
  const firstIsNextDay = isNextDaySlot(first)
  const secondIsNextDay = isNextDaySlot(second)

  if (firstIsNextDay !== secondIsNextDay) return firstIsNextDay ? 1 : -1
  if (firstMinutes !== null && secondMinutes !== null && firstMinutes !== secondMinutes) {
    return firstMinutes - secondMinutes
  }

  return first.localeCompare(second)
}

export function ScheduleBoard() {
  const { pages, posts, selectedDate, setSelectedDate, markAsPosted, updatePost } = useAppStore()
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
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null)
  const [postDropTarget, setPostDropTarget] = useState<{ pageId: string; timeSlot: string } | null>(null)
  const [dateArrowDropTarget, setDateArrowDropTarget] = useState<'prev' | 'next' | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [defaultSlot, setDefaultSlot] = useState<{ pageId: string; timeSlot: string } | null>(null)
  const scheduleScrollRef = useRef<HTMLDivElement | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const dateArrowHoldTimeoutRef = useRef<number | null>(null)
  const dateArrowHoldTargetRef = useRef<'prev' | 'next' | null>(null)
  const suppressPostClickRef = useRef(false)

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

  const allTimeSlots = useMemo(() => {
    const slots = new Set<string>()
    visiblePages.forEach((page) => {
      page.timeSlots.forEach((slot) => slots.add(slot))
    })

    return [...slots].sort(compareBoardTimeSlots)
  }, [visiblePages])

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const isToday = selectedDate === format(now, 'yyyy-MM-dd')

  const getSlotDate = (timeSlot: string) => {
    return isNextDaySlot(timeSlot)
      ? format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd')
      : selectedDate
  }

  const getPostDateForScheduleDate = (scheduleDate: string, timeSlot: string) => {
    return isNextDaySlot(timeSlot)
      ? format(addDays(new Date(scheduleDate), 1), 'yyyy-MM-dd')
      : scheduleDate
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
    handleDragAutoScroll(event)

    if (draggedPageId && draggedPageId !== targetPageId) {
      movePage(draggedPageId, targetPageId)
    }
  }

  const stopDragAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
  }

  const stopDateArrowHold = () => {
    if (dateArrowHoldTimeoutRef.current !== null) {
      window.clearTimeout(dateArrowHoldTimeoutRef.current)
      dateArrowHoldTimeoutRef.current = null
    }
    dateArrowHoldTargetRef.current = null
  }

  const handleDragAutoScroll = (event: React.DragEvent<HTMLElement>) => {
    if (!draggedPageId && !draggedPostId) return

    const scrollContainer = scheduleScrollRef.current
    if (!scrollContainer) return

    const edgeSize = 72
    const maxStep = 18
    const containerRect = scrollContainer.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    const leftDistance = event.clientX - containerRect.left
    const rightDistance = containerRect.right - event.clientX
    const topDistance = event.clientY
    const bottomDistance = viewportHeight - event.clientY

    const horizontalStep =
      leftDistance < edgeSize
        ? -Math.ceil(((edgeSize - leftDistance) / edgeSize) * maxStep)
        : rightDistance < edgeSize
          ? Math.ceil(((edgeSize - rightDistance) / edgeSize) * maxStep)
          : 0

    const verticalStep =
      topDistance < edgeSize
        ? -Math.ceil(((edgeSize - topDistance) / edgeSize) * maxStep)
        : bottomDistance < edgeSize
          ? Math.ceil(((edgeSize - bottomDistance) / edgeSize) * maxStep)
          : 0

    stopDragAutoScroll()

    if (horizontalStep === 0 && verticalStep === 0) return

    autoScrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollContainer.scrollLeft += horizontalStep
      if (verticalStep !== 0) {
        window.scrollBy({ top: verticalStep, left: 0 })
      }
      autoScrollFrameRef.current = null
    })
  }

  const handlePostDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    pageId: string,
    timeSlot: string
  ) => {
    if (!draggedPostId) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    handleDragAutoScroll(event)
    setPostDropTarget({ pageId, timeSlot })
  }

  const movePostToSlot = async (postId: string, pageId: string, timeSlot: string) => {
    const draggedPost = posts.find((item) => item.id === postId)
    if (!draggedPost) return

    const postDate = getSlotDate(timeSlot)
    const isSameSlot =
      draggedPost.pageId === pageId &&
      draggedPost.postDate === postDate &&
      draggedPost.timeSlot === timeSlot

    if (isSameSlot) return

    const targetPost = posts.find(
      (item) =>
        item.id !== draggedPost.id &&
        item.pageId === pageId &&
        item.postDate === postDate &&
        item.timeSlot === timeSlot
    )

    await updatePost(draggedPost.id, { pageId, postDate, timeSlot })

    if (targetPost) {
      await updatePost(targetPost.id, {
        pageId: draggedPost.pageId,
        postDate: draggedPost.postDate,
        timeSlot: draggedPost.timeSlot,
      })
    }
  }

  const movePostToScheduleDate = async (postId: string, scheduleDate: string) => {
    const draggedPost = posts.find((item) => item.id === postId)
    if (!draggedPost) return

    const postDate = getPostDateForScheduleDate(scheduleDate, draggedPost.timeSlot)
    if (draggedPost.postDate === postDate) return

    const targetPost = posts.find(
      (item) =>
        item.id !== draggedPost.id &&
        item.pageId === draggedPost.pageId &&
        item.postDate === postDate &&
        item.timeSlot === draggedPost.timeSlot
    )

    await updatePost(draggedPost.id, { postDate })

    if (targetPost) {
      await updatePost(targetPost.id, { postDate: draggedPost.postDate })
    }
  }

  const handlePostDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    pageId: string,
    timeSlot: string
  ) => {
    event.preventDefault()

    const postId = draggedPostId || event.dataTransfer.getData('application/postops-post-id')
    setDraggedPostId(null)
    setPostDropTarget(null)
    setDateArrowDropTarget(null)
    stopDragAutoScroll()
    stopDateArrowHold()

    if (!postId) return
    await movePostToSlot(postId, pageId, timeSlot)
  }

  const handleDateArrowDragOver = (
    event: React.DragEvent<HTMLButtonElement>,
    target: 'prev' | 'next'
  ) => {
    if (!draggedPostId) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDateArrowDropTarget(target)

    if (dateArrowHoldTargetRef.current === target && dateArrowHoldTimeoutRef.current !== null) {
      return
    }

    stopDateArrowHold()
    dateArrowHoldTargetRef.current = target
    dateArrowHoldTimeoutRef.current = window.setTimeout(() => {
      setSelectedDate(
        format(
          target === 'prev' ? subDays(new Date(selectedDate), 1) : addDays(new Date(selectedDate), 1),
          'yyyy-MM-dd'
        )
      )
      setPostDropTarget(null)
      setDateArrowDropTarget(null)
      stopDateArrowHold()
    }, 550)
  }

  const handleDateArrowDrop = async (
    event: React.DragEvent<HTMLButtonElement>,
    target: 'prev' | 'next'
  ) => {
    event.preventDefault()

    const postId = draggedPostId || event.dataTransfer.getData('application/postops-post-id')
    setDraggedPostId(null)
    setPostDropTarget(null)
    setDateArrowDropTarget(null)
    stopDragAutoScroll()
    stopDateArrowHold()

    if (!postId) return

    const targetDate = format(
      target === 'prev' ? subDays(new Date(selectedDate), 1) : addDays(new Date(selectedDate), 1),
      'yyyy-MM-dd'
    )
    await movePostToScheduleDate(postId, targetDate)
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
    if (isNextDaySlot(timeSlot)) return false
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
    return () => {
      stopDragAutoScroll()
      stopDateArrowHold()
    }
  }, [])

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
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevDay}
              onDragOver={(event) => handleDateArrowDragOver(event, 'prev')}
              onDragEnter={(event) => handleDateArrowDragOver(event, 'prev')}
              onDragLeave={() => {
                if (dateArrowDropTarget === 'prev') setDateArrowDropTarget(null)
                stopDateArrowHold()
              }}
              onDrop={(event) => {
                void handleDateArrowDrop(event, 'prev')
              }}
              className={cn(
                draggedPostId && 'transition-[background-color,box-shadow,transform]',
                dateArrowDropTarget === 'prev' && 'scale-105 bg-primary/10 shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.55)]'
              )}
              title={draggedPostId ? 'Drop post to move to previous day' : 'Previous day'}
            >
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
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextDay}
              onDragOver={(event) => handleDateArrowDragOver(event, 'next')}
              onDragEnter={(event) => handleDateArrowDragOver(event, 'next')}
              onDragLeave={() => {
                if (dateArrowDropTarget === 'next') setDateArrowDropTarget(null)
                stopDateArrowHold()
              }}
              onDrop={(event) => {
                void handleDateArrowDrop(event, 'next')
              }}
              className={cn(
                draggedPostId && 'transition-[background-color,box-shadow,transform]',
                dateArrowDropTarget === 'next' && 'scale-105 bg-primary/10 shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.55)]'
              )}
              title={draggedPostId ? 'Drop post to move to next day' : 'Next day'}
            >
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
          <div
            ref={scheduleScrollRef}
            onDragOver={handleDragAutoScroll}
            className="overflow-x-auto rounded-lg border border-border"
          >
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
                      stopDragAutoScroll()
                    }}
                    onDragEnd={() => {
                      setDraggedPageId(null)
                      stopDragAutoScroll()
                    }}
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
                      {isNextDaySlot(timeSlot) ? `${timeSlot} (+1d)` : timeSlot}
                    </div>

                    {/* Page Columns */}
                    {visiblePages.map((page, pageIndex) => {
                      const hasSlot = page.timeSlots.includes(timeSlot)
                      const post = hasSlot ? getPostForSlot(page.id, timeSlot) : null
                      const cellBackground = getZebraBackground(pageIndex)
                      const isPostDropTarget =
                        postDropTarget?.pageId === page.id && postDropTarget.timeSlot === timeSlot

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
                          onDragOver={(event) => handlePostDragOver(event, page.id, timeSlot)}
                          onDragEnter={(event) => handlePostDragOver(event, page.id, timeSlot)}
                          onDragLeave={() => {
                            if (isPostDropTarget) setPostDropTarget(null)
                          }}
                          onDrop={(event) => {
                            void handlePostDrop(event, page.id, timeSlot)
                          }}
                          className={cn(
                            'w-44 shrink-0 border-l border-border p-2 transition-[background-color,box-shadow,transform] duration-300 ease-out',
                            draggedPageId === page.id && 'relative z-10 scale-[1.01] bg-accent/20 shadow-md ring-1 ring-primary/20',
                            isPostDropTarget && 'bg-primary/10 shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.55)]'
                          )}
                        >
                          {post ? (
                            <div
                              draggable
                              className={cn(
                                'rounded-lg border bg-card p-2.5 cursor-grab shadow-xs transition-[background-color,box-shadow,transform,opacity] hover:bg-accent/50 active:cursor-grabbing',
                                post.status === 'posted' && 'border-green-500/40 shadow-green-500/10',
                                post.status === 'late' && 'border-red-500/40 shadow-red-500/10',
                                post.status === 'due_now' && 'border-amber-500/40 shadow-amber-500/10',
                                post.status === 'scheduled' && 'border-blue-500/40 shadow-blue-500/10',
                                post.status === 'ready' && 'border-yellow-500/40 shadow-yellow-500/10',
                                post.status === 'draft' && 'border-border bg-secondary',
                                draggedPostId === post.id && 'scale-[0.98] opacity-60 ring-2 ring-primary/40'
                              )}
                              onDragStart={(event) => {
                                suppressPostClickRef.current = true
                                setDraggedPostId(post.id)
                                event.dataTransfer.effectAllowed = 'move'
                                event.dataTransfer.setData('application/postops-post-id', post.id)
                                event.dataTransfer.setData('text/plain', post.id)
                              }}
                              onDragEnd={() => {
                                setDraggedPostId(null)
                                setPostDropTarget(null)
                                setDateArrowDropTarget(null)
                                stopDragAutoScroll()
                                stopDateArrowHold()
                                window.setTimeout(() => {
                                  suppressPostClickRef.current = false
                                }, 0)
                              }}
                              onClick={() => {
                                if (suppressPostClickRef.current) return
                                handleEditPost(post)
                              }}
                              title="Drag to move this post"
                            >
                              <div className="flex items-start gap-2">
                                {isUploadingMediaPath(post.imagePath) ? (
                                  <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10"
                                    title="Uploading video to Google Drive"
                                  >
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  </div>
                                ) : isMediaUploadErrorPath(post.imagePath) ? (
                                  <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-destructive/10"
                                    title="Video upload failed"
                                  >
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                  </div>
                                ) : post.imageUrl ? (
                                  page.mediaType === 'video' || isVideoUrl(post.imageUrl) ? (
                                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-black">
                                      {getGoogleDriveThumbnailUrl(post.imagePath, post.imageUrl) ? (
                                        <img
                                          src={getGoogleDriveThumbnailUrl(post.imagePath, post.imageUrl)}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : !isGoogleDriveUrl(post.imageUrl) ? (
                                        <video
                                          src={post.imageUrl}
                                          className="h-full w-full object-cover"
                                          muted
                                          playsInline
                                          preload="metadata"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                          <Video className="h-4 w-4 text-white drop-shadow" />
                                        </div>
                                      )}
                                      <div className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[8px] font-medium text-white">
                                        VID
                                      </div>
                                    </div>
                                  ) : (
                                    <img
                                      src={post.imageUrl}
                                      alt=""
                                      className="h-10 w-10 rounded object-cover shrink-0"
                                    />
                                  )
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
                                      suppressPostClickRef.current = false
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
              <div className="h-2 w-2 rounded-full bg-yellow-400" />
              <span className="text-xs text-muted-foreground">Ready</span>
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

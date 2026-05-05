"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  CheckCircle2,
  Image as ImageIcon,
  ExternalLink,
  Search,
  ChevronDown,
} from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { PostModal } from './post-modal'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Post, PostStatus } from '@/lib/types'

const copyableImageType = 'image/png'
const targetImageWidth = 1080
const targetImageHeight = 1350
const targetImageRatio = targetImageWidth / targetImageHeight
const postsPreferencesStorageKey = 'postops:posts-preferences'

type PostsPreferences = {
  selectedDate?: string
  filterPage?: string
  filterPageIds?: string[]
  filterTimeSlots?: string[]
  filterStatus?: string
  searchQuery?: string
  zoomImagesOnHover?: boolean
  highlightTargetTime?: string
  highlightTargetTimes?: string[]
  highlightWindowMinutes?: number
}

function readPostsPreferences(): PostsPreferences {
  if (typeof window === 'undefined') return {}

  try {
    const rawValue = window.localStorage.getItem(postsPreferencesStorageKey)
    if (!rawValue) return {}

    const parsedValue = JSON.parse(rawValue)
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {}
  } catch {
    return {}
  }
}

async function convertImageBlobToClipboardPng(imageBlob: Blob) {
  const imageUrl = URL.createObjectURL(imageBlob)

  try {
    const image = new Image()
    const imageLoadPromise = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to load image for clipboard copy.'))
    })

    image.src = imageUrl
    await imageLoadPromise

    const canvas = document.createElement('canvas')
    canvas.width = targetImageWidth
    canvas.height = targetImageHeight

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Image conversion is not supported by this browser.')
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, targetImageWidth, targetImageHeight)

    const sourceRatio = image.naturalWidth / image.naturalHeight
    let drawWidth = targetImageWidth
    let drawHeight = targetImageHeight
    let offsetX = 0
    let offsetY = 0

    if (sourceRatio > targetImageRatio) {
      drawHeight = targetImageHeight
      drawWidth = drawHeight * sourceRatio
      offsetX = (targetImageWidth - drawWidth) / 2
    } else {
      drawWidth = targetImageWidth
      drawHeight = drawWidth / sourceRatio
      offsetY = (targetImageHeight - drawHeight) / 2
    }

    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, copyableImageType)
    })

    if (!pngBlob) {
      throw new Error('Failed to prepare image for clipboard copy.')
    }

    return pngBlob
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

async function readBlobImageSize(imageBlob: Blob) {
  const bitmap = await createImageBitmap(imageBlob)

  try {
    return {
      width: bitmap.width,
      height: bitmap.height,
    }
  } finally {
    bitmap.close()
  }
}

function parseTimeSlotMinutes(timeSlot: string) {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

function addOneDay(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setDate(date.getDate() + 1)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDisplayDateForTimeSlot(selectedDate: string, timeSlot: string) {
  return timeSlot === '04:00' ? addOneDay(selectedDate) : selectedDate
}

function comparePostsBySchedule(first: Post, second: Post) {
  if (first.postDate !== second.postDate) {
    return first.postDate.localeCompare(second.postDate)
  }

  const firstMinutes = parseTimeSlotMinutes(first.timeSlot)
  const secondMinutes = parseTimeSlotMinutes(second.timeSlot)
  if (firstMinutes !== null && secondMinutes !== null && firstMinutes !== secondMinutes) {
    return firstMinutes - secondMinutes
  }

  if (first.timeSlot !== second.timeSlot) {
    return first.timeSlot.localeCompare(second.timeSlot)
  }

  return first.createdAt.getTime() - second.createdAt.getTime()
}

export function PostsList() {
  const {
    posts,
    pages,
    addPost,
    deletePost,
    duplicatePost,
    markAsPosted,
    selectedDate: initialSelectedDate,
  } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<Post | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    const savedValue = readPostsPreferences().selectedDate
    return typeof savedValue === 'string' && savedValue ? savedValue : initialSelectedDate
  })
  const [filterPageIds, setFilterPageIds] = useState<string[]>(() => {
    const preferences = readPostsPreferences()
    if (Array.isArray(preferences.filterPageIds)) {
      return preferences.filterPageIds.filter((id) => typeof id === 'string')
    }

    return typeof preferences.filterPage === 'string' && preferences.filterPage !== 'all'
      ? [preferences.filterPage]
      : []
  })
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    const savedValue = readPostsPreferences().filterStatus
    return typeof savedValue === 'string' && savedValue ? savedValue : 'all'
  })
  const [filterTimeSlots, setFilterTimeSlots] = useState<string[]>(() => {
    const savedValue = readPostsPreferences().filterTimeSlots
    return Array.isArray(savedValue)
      ? savedValue.filter((slot) => typeof slot === 'string' && parseTimeSlotMinutes(slot) !== null)
      : []
  })
  const [searchQuery, setSearchQuery] = useState(() => {
    const savedValue = readPostsPreferences().searchQuery
    return typeof savedValue === 'string' ? savedValue : ''
  })
  const [zoomImagesOnHover, setZoomImagesOnHover] = useState(() => {
    return readPostsPreferences().zoomImagesOnHover === true
  })
  const [highlightWindowMinutes, setHighlightWindowMinutes] = useState(() => {
    const savedValue = readPostsPreferences().highlightWindowMinutes
    return typeof savedValue === 'number' && Number.isFinite(savedValue)
      ? Math.min(Math.max(savedValue, 0), 240)
      : 30
  })
  const [highlightTargetTimes, setHighlightTargetTimes] = useState<string[]>(() => {
    const preferences = readPostsPreferences()
    if (Array.isArray(preferences.highlightTargetTimes)) {
      return preferences.highlightTargetTimes.filter(
        (slot) => typeof slot === 'string' && parseTimeSlotMinutes(slot) !== null
      )
    }

    return typeof preferences.highlightTargetTime === 'string' &&
      parseTimeSlotMinutes(preferences.highlightTargetTime) !== null
      ? [preferences.highlightTargetTime]
      : []
  })
  const [hoveredImage, setHoveredImage] = useState<{
    url: string
    top: number
    left: number
  } | null>(null)
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null)

  const handleEdit = (post: Post) => {
    setHighlightedPostId(post.id)
    setEditingPost(post)
    setModalOpen(true)
  }

  const handleDelete = (post: Post) => {
    setHighlightedPostId(post.id)
    setPostToDelete(post)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (postToDelete) {
      deletePost(postToDelete.id)
      setDeleteDialogOpen(false)
      setPostToDelete(null)
    }
  }

  const handleAddNew = () => {
    setEditingPost(null)
    setModalOpen(true)
  }

  const getPageById = (pageId: string) => {
    return pages.find((p) => p.id === pageId)
  }

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({
        title: `${label} copied`,
        description: value.length > 72 ? `${value.slice(0, 72)}...` : value,
      })
    } catch {
      toast({
        title: `Failed to copy ${label.toLowerCase()}`,
        description: 'Clipboard access was blocked by the browser.',
        variant: 'destructive',
      })
    }
  }

  const copyImage = async (imageUrl: string) => {
    try {
      if (!window.isSecureContext || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image copy is not supported in this context.')
      }

      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch image.')
      }

      const imageBlob = await response.blob()
      if (!imageBlob.type.startsWith('image/')) {
        throw new Error('Selected file is not an image.')
      }

      const clipboardBlob = await convertImageBlobToClipboardPng(imageBlob)
      const clipboardImageSize = await readBlobImageSize(clipboardBlob)

      if (
        clipboardImageSize.width !== targetImageWidth ||
        clipboardImageSize.height !== targetImageHeight
      ) {
        throw new Error(
          `Prepared image is ${clipboardImageSize.width}x${clipboardImageSize.height}, expected ${targetImageWidth}x${targetImageHeight}.`
        )
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          [copyableImageType]: clipboardBlob,
        }),
      ])

      toast({
        title: 'Image copied',
        description: 'The image was copied to your clipboard.',
      })
    } catch (error) {
      toast({
        title: 'Failed to copy image',
        description:
          error instanceof Error
            ? error.message
            : 'Your browser blocked direct image copy.',
        variant: 'destructive',
      })
    }
  }

  const selectedPageIdSet = useMemo(() => new Set(filterPageIds), [filterPageIds])
  const selectedTimeSlotSet = useMemo(() => new Set(filterTimeSlots), [filterTimeSlots])
  const selectedHighlightTimeSet = useMemo(() => new Set(highlightTargetTimes), [highlightTargetTimes])
  const allPagesSelected = pages.length > 0 && filterPageIds.length === pages.length
  const highlightTimeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          pages
            .filter((page) => filterPageIds.length === 0 || selectedPageIdSet.has(page.id))
            .flatMap((page) => page.timeSlots)
            .filter((slot) => parseTimeSlotMinutes(slot) !== null)
        )
      ).sort((first, second) => (parseTimeSlotMinutes(first) ?? 0) - (parseTimeSlotMinutes(second) ?? 0)),
    [filterPageIds.length, pages, selectedPageIdSet]
  )
  const pageFilterLabel =
    filterPageIds.length === 0 || allPagesSelected
      ? 'All Pages'
      : filterPageIds.length === 1
      ? pages.find((page) => page.id === filterPageIds[0])?.name ?? '1 Page'
      : `${filterPageIds.length} Pages`
  const timeSlotFilterLabel =
    filterTimeSlots.length === 0 || filterTimeSlots.length === highlightTimeOptions.length
      ? 'All Slots'
      : filterTimeSlots.length === 1
      ? filterTimeSlots[0]
      : `${filterTimeSlots.length} Slots`
  const highlightTimeLabel =
    highlightTargetTimes.length === 0
      ? 'No Highlight'
      : highlightTargetTimes.length === 1
      ? highlightTargetTimes[0]
      : `${highlightTargetTimes.length} Highlights`

  const toggleAllPages = () => {
    setFilterPageIds([])
  }

  const togglePageFilter = (pageId: string) => {
    setFilterPageIds((current) => {
      if (current.includes(pageId)) {
        return current.filter((id) => id !== pageId)
      }

      return [...current, pageId]
    })
  }

  const toggleAllTimeSlots = () => {
    setFilterTimeSlots([])
  }

  const toggleTimeSlotFilter = (timeSlot: string) => {
    setFilterTimeSlots((current) => {
      if (current.includes(timeSlot)) {
        return current.filter((slot) => slot !== timeSlot)
      }

      return [...current, timeSlot]
    })
  }

  const clearHighlightTimes = () => {
    setHighlightTargetTimes([])
  }

  const toggleHighlightTime = (timeSlot: string) => {
    setHighlightTargetTimes((current) => {
      if (current.includes(timeSlot)) {
        return current.filter((slot) => slot !== timeSlot)
      }

      return [...current, timeSlot]
    })
  }

  const filteredPosts = useMemo(
    () =>
      posts
        .filter((post) => {
          if (post.postDate !== getDisplayDateForTimeSlot(selectedDate, post.timeSlot)) return false
          if (filterPageIds.length > 0 && !selectedPageIdSet.has(post.pageId)) return false
          if (filterTimeSlots.length > 0 && !selectedTimeSlotSet.has(post.timeSlot)) return false
          if (filterStatus !== 'all' && post.status !== filterStatus) return false
          if (searchQuery) {
            const normalizedSearchQuery = searchQuery.toLowerCase()
            const searchableText = [
              post.caption,
              post.adsLink ?? '',
              post.imageUrl ?? '',
              post.notes,
            ]
              .join(' ')
              .toLowerCase()

            if (!searchableText.includes(normalizedSearchQuery)) return false
          }
          return true
        })
        .sort(comparePostsBySchedule),
    [
      filterPageIds.length,
      filterStatus,
      filterTimeSlots.length,
      posts,
      searchQuery,
      selectedDate,
      selectedPageIdSet,
      selectedTimeSlotSet,
    ]
  )

  const statusOptions: PostStatus[] = ['draft', 'scheduled', 'ready', 'due_now', 'posted', 'late', 'skipped']

  const getTimeHighlightState = (post: Post) => {
    if (highlightWindowMinutes <= 0) {
      return null
    }

    const slotMinutes = parseTimeSlotMinutes(post.timeSlot)
    if (slotMinutes === null || highlightTargetTimes.length === 0) {
      return null
    }

    const matchingDiffs = highlightTargetTimes
      .map((targetTime) => {
        const targetMinutes = parseTimeSlotMinutes(targetTime)
        return targetMinutes === null ? null : slotMinutes - targetMinutes
      })
      .filter((diff): diff is number => diff !== null && Math.abs(diff) <= highlightWindowMinutes)

    if (matchingDiffs.length === 0) {
      return null
    }

    const diffMinutes = matchingDiffs.sort((first, second) => Math.abs(first) - Math.abs(second))[0]
    return diffMinutes >= 0 ? 'upcoming' : 'current'
  }

  useEffect(() => {
    setFilterPageIds((current) => current.filter((id) => pages.some((page) => page.id === id)))
  }, [pages])

  useEffect(() => {
    setFilterTimeSlots((current) => current.filter((slot) => highlightTimeOptions.includes(slot)))
  }, [highlightTimeOptions])

  useEffect(() => {
    setHighlightTargetTimes((current) => current.filter((slot) => highlightTimeOptions.includes(slot)))
  }, [highlightTimeOptions])

  useEffect(() => {
    window.localStorage.setItem(
      postsPreferencesStorageKey,
        JSON.stringify({
          selectedDate,
          filterPage: filterPageIds.length === 1 ? filterPageIds[0] : 'all',
          filterPageIds,
          filterTimeSlots,
          filterStatus,
          searchQuery,
          zoomImagesOnHover,
          highlightTargetTimes,
          highlightWindowMinutes,
        } satisfies PostsPreferences)
      )
  }, [
    filterPageIds,
    filterStatus,
    filterTimeSlots,
    highlightTargetTimes,
    highlightWindowMinutes,
    searchQuery,
    selectedDate,
    zoomImagesOnHover,
  ])

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
          <CardTitle className="text-lg font-semibold">Posts</CardTitle>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-44 justify-between">
                  <span className="truncate">{pageFilterLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto border-border bg-popover">
                <DropdownMenuCheckboxItem
                  checked={filterPageIds.length === 0 || allPagesSelected}
                  onCheckedChange={toggleAllPages}
                >
                  All Pages
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator className="bg-border" />
                {pages.map((page) => (
                  <DropdownMenuCheckboxItem
                    key={page.id}
                    checked={selectedPageIdSet.has(page.id)}
                    onCheckedChange={() => togglePageFilter(page.id)}
                  >
                    {page.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-36 justify-between">
                  <span className="truncate">{timeSlotFilterLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 w-44 overflow-y-auto border-border bg-popover">
                <DropdownMenuCheckboxItem
                  checked={filterTimeSlots.length === 0 || filterTimeSlots.length === highlightTimeOptions.length}
                  onCheckedChange={toggleAllTimeSlots}
                >
                  All Slots
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator className="bg-border" />
                {highlightTimeOptions.map((slot) => (
                  <DropdownMenuCheckboxItem
                    key={slot}
                    checked={selectedTimeSlotSet.has(slot)}
                    onCheckedChange={() => toggleTimeSlotFilter(slot)}
                  >
                    {slot}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="ml-auto flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Label htmlFor="zoom-images" className="text-xs text-muted-foreground">
                Zoom image hover
              </Label>
              <Switch
                id="zoom-images"
                checked={zoomImagesOnHover}
                onCheckedChange={setZoomImagesOnHover}
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Label className="whitespace-nowrap text-xs text-muted-foreground">
                Highlight time
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-7 w-36 justify-between px-2 text-xs">
                    <span className="truncate">{highlightTimeLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 w-44 overflow-y-auto border-border bg-popover">
                  <DropdownMenuCheckboxItem
                    checked={highlightTargetTimes.length === 0}
                    onCheckedChange={clearHighlightTimes}
                  >
                    No Highlight
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator className="bg-border" />
                  {highlightTimeOptions.map((slot) => (
                    <DropdownMenuCheckboxItem
                      key={slot}
                      checked={selectedHighlightTimeSet.has(slot)}
                      onCheckedChange={() => toggleHighlightTime(slot)}
                    >
                      {slot}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Label htmlFor="time-highlight-window" className="whitespace-nowrap text-xs text-muted-foreground">
                Highlight +/- min
              </Label>
              <Input
                id="time-highlight-window"
                type="number"
                min={0}
                max={240}
                value={highlightWindowMinutes}
                onChange={(event) =>
                  setHighlightWindowMinutes(
                    Math.min(Math.max(Number(event.target.value) || 0, 0), 240)
                  )
                }
                className="h-7 w-16 px-2 text-xs"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground w-16">Image</TableHead>
                  <TableHead className="text-muted-foreground">Page</TableHead>
                  <TableHead className="text-muted-foreground">Time</TableHead>
                  <TableHead className="text-muted-foreground">Caption</TableHead>
                  <TableHead className="text-muted-foreground">Ads Link</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No posts found for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPosts.map((post) => {
                    const timeHighlightState = getTimeHighlightState(post)
                    const isTimeHighlighted = timeHighlightState !== null

                    return (
                    <TableRow
                      key={post.id}
                      className={`border-border transition-colors ${
                        highlightedPostId === post.id
                          ? 'bg-primary/8 shadow-[inset_3px_0_0_hsl(var(--primary))] hover:bg-primary/12'
                          : isTimeHighlighted
                          ? 'bg-amber-500/10 shadow-[inset_3px_0_0_rgb(245_158_11)] hover:bg-amber-500/15'
                          : 'hover:bg-accent/20'
                      }`}
                    >
                      <TableCell>
                        {post.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              setHighlightedPostId(post.id)
                              void copyImage(post.imageUrl!)
                            }}
                            className="block overflow-hidden rounded"
                            onMouseEnter={(event) => {
                              if (!zoomImagesOnHover) return
                              const rect = event.currentTarget.getBoundingClientRect()
                              const previewWidth = 340
                              setHoveredImage({
                                url: post.imageUrl!,
                                top: Math.max(16, rect.top - 40),
                                left: Math.min(rect.right + 16, window.innerWidth - previewWidth),
                              })
                            }}
                            onMouseLeave={() => setHoveredImage(null)}
                            title="Click to copy image"
                          >
                            <img
                              src={post.imageUrl}
                              alt=""
                              className="h-10 w-10 rounded object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-secondary">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const page = getPageById(post.pageId)
                          return (
                            <div className="flex items-center gap-2">
                              {page?.logoUrl ? (
                                <img
                                  src={page.logoUrl}
                                  alt=""
                                  className="h-7 w-7 rounded-lg border border-border object-cover"
                                />
                              ) : (
                                <span
                                  className="inline-flex h-3 w-3 rounded-full"
                                  style={{ backgroundColor: page?.brandColor || '#14b8a6' }}
                                />
                              )}
                              <span className="font-medium text-foreground">
                                {page?.name || 'Unknown'}
                              </span>
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isTimeHighlighted
                              ? 'border-amber-400/50 bg-amber-400/15 font-mono text-amber-300 shadow-[inset_0_0_0_1px_rgb(251_191_36_/_0.16)]'
                              : 'border-primary/30 bg-primary/10 font-mono text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]'
                          }
                          title={
                            isTimeHighlighted
                              ? timeHighlightState === 'upcoming'
                                ? 'Upcoming highlighted time slot'
                                : 'Current highlighted time slot'
                              : undefined
                          }
                        >
                          {post.timeSlot}
                          {post.timeSlot === '04:00' && post.postDate === addOneDay(selectedDate)
                            ? ' (+1d)'
                            : ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <button
                          type="button"
                          onClick={() => {
                            setHighlightedPostId(post.id)
                            void copyText(post.caption, 'Caption')
                          }}
                          className="block w-full truncate text-left text-sm text-foreground hover:text-primary"
                          title="Click to copy caption"
                        >
                          {post.caption || (
                            <span className="text-muted-foreground">No caption yet</span>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        {post.adsLink ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setHighlightedPostId(post.id)
                                void copyText(post.adsLink!, 'Ads link')
                              }}
                              className="text-xs text-primary hover:underline"
                              title="Click to copy ads link"
                            >
                              Copy Link
                            </button>
                            <a
                              href={post.adsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary"
                              title="Open ads link"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={post.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {post.status !== 'posted' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              onClick={() => {
                                setHighlightedPostId(post.id)
                                void markAsPosted(post.id)
                              }}
                              title="Mark as Posted"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-border">
                              <DropdownMenuItem onClick={() => handleEdit(post)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setHighlightedPostId(post.id)
                                  void duplicatePost(post.id)
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-border" />
                              <DropdownMenuItem
                                onClick={() => handleDelete(post)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PostModal open={modalOpen} onOpenChange={setModalOpen} post={editingPost} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {zoomImagesOnHover && hoveredImage && (
        <div
          className="pointer-events-none fixed z-50 hidden rounded-xl border border-border bg-card p-2 shadow-2xl lg:block"
          style={{
            top: hoveredImage.top,
            left: hoveredImage.left,
          }}
        >
          <img
            src={hoveredImage.url}
            alt=""
            className="h-auto max-h-[320px] w-[300px] rounded-lg object-contain"
          />
        </div>
      )}
    </>
  )
}

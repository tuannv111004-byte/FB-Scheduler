"use client"

import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { PostModal } from './post-modal'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { Post, PostStatus } from '@/lib/types'

const copyableImageType = 'image/png'
const targetImageWidth = 1080
const targetImageHeight = 1350
const targetImageRatio = targetImageWidth / targetImageHeight
const postsPreferencesStorageKey = 'postops:posts-preferences'

type PostsPreferences = {
  selectedDate?: string
  filterPage?: string
  filterStatus?: string
  searchQuery?: string
  zoomImagesOnHover?: boolean
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

export function PostsList() {
  const {
    posts,
    pages,
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
  const [filterPage, setFilterPage] = useState<string>(() => {
    const savedValue = readPostsPreferences().filterPage
    return typeof savedValue === 'string' && savedValue ? savedValue : 'all'
  })
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    const savedValue = readPostsPreferences().filterStatus
    return typeof savedValue === 'string' && savedValue ? savedValue : 'all'
  })
  const [searchQuery, setSearchQuery] = useState(() => {
    const savedValue = readPostsPreferences().searchQuery
    return typeof savedValue === 'string' ? savedValue : ''
  })
  const [zoomImagesOnHover, setZoomImagesOnHover] = useState(() => {
    return readPostsPreferences().zoomImagesOnHover === true
  })
  const [hoveredImage, setHoveredImage] = useState<{
    url: string
    top: number
    left: number
  } | null>(null)

  const handleEdit = (post: Post) => {
    setEditingPost(post)
    setModalOpen(true)
  }

  const handleDelete = (post: Post) => {
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

  const filteredPosts = posts.filter((post) => {
    if (post.postDate !== selectedDate) return false
    if (filterPage !== 'all' && post.pageId !== filterPage) return false
    if (filterStatus !== 'all' && post.status !== filterStatus) return false
    if (searchQuery && !post.caption.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const statusOptions: PostStatus[] = ['draft', 'scheduled', 'ready', 'due_now', 'posted', 'late', 'skipped']

  useEffect(() => {
    if (filterPage !== 'all' && !pages.some((page) => page.id === filterPage)) {
      setFilterPage('all')
    }
  }, [filterPage, pages])

  useEffect(() => {
    window.localStorage.setItem(
      postsPreferencesStorageKey,
      JSON.stringify({
        selectedDate,
        filterPage,
        filterStatus,
        searchQuery,
        zoomImagesOnHover,
      } satisfies PostsPreferences)
    )
  }, [filterPage, filterStatus, searchQuery, selectedDate, zoomImagesOnHover])

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
            <Select value={filterPage} onValueChange={setFilterPage}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Pages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem>
                {pages.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  filteredPosts.map((post) => (
                    <TableRow key={post.id} className="border-border">
                      <TableCell>
                        {post.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => copyImage(post.imageUrl!)}
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
                      <TableCell className="text-foreground">{post.timeSlot}</TableCell>
                      <TableCell className="max-w-48">
                        <button
                          type="button"
                          onClick={() => copyText(post.caption, 'Caption')}
                          className="block w-full truncate text-left text-sm text-foreground hover:text-primary"
                          title="Click to copy caption"
                        >
                          {post.caption}
                        </button>
                      </TableCell>
                      <TableCell>
                        {post.adsLink ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => copyText(post.adsLink!, 'Ads link')}
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
                              onClick={() => markAsPosted(post.id)}
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
                              <DropdownMenuItem onClick={() => duplicatePost(post.id)}>
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
                  ))
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

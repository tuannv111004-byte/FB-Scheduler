"use client"

import { useRef, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { isSupabaseConfigured, uploadPostImage } from '@/lib/supabase'
import type { Post, PostStatus } from '@/lib/types'

const TARGET_WIDTH = 1080
const TARGET_HEIGHT = 1350
const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT

type ImageFitMode = 'fill' | 'fit'

type SelectedImageMeta = {
  width: number
  height: number
  ratio: number
  needsAttention: boolean
}

type ImageSource = Blob | string
type ImageFocus = {
  x: number
  y: number
}

function clampFocusValue(value: number) {
  return Math.min(1, Math.max(0, value))
}

async function readImageDimensions(source: ImageSource) {
  return new Promise<SelectedImageMeta>((resolve, reject) => {
    const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source)
    const image = new Image()

    image.onload = () => {
      const ratio = image.width / image.height
      const ratioDiff = Math.abs(ratio - TARGET_RATIO)
      if (typeof source !== 'string') {
        URL.revokeObjectURL(objectUrl)
      }
      resolve({
        width: image.width,
        height: image.height,
        ratio,
        needsAttention:
          image.width !== TARGET_WIDTH || image.height !== TARGET_HEIGHT || ratioDiff > 0.02,
      })
    }

    image.onerror = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(objectUrl)
      }
      reject(new Error('Could not read image dimensions.'))
    }

    image.crossOrigin = 'anonymous'
    image.src = objectUrl
    })
}

function extractImageFileFromClipboard(event: ClipboardEvent) {
  for (const item of event.clipboardData?.items ?? []) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }

  return null
}

function getPastedTextFromClipboard(event: ClipboardEvent) {
  return event.clipboardData?.getData('text/plain').trim() ?? ''
}

function parseSingleUrl(value: string) {
  if (!value || /\s/.test(value)) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function isImageUrl(url: URL) {
  return /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(url.href)
}

async function normalizeImageFile(
  source: ImageSource,
  fitMode: ImageFitMode,
  imageFocus: ImageFocus,
  fileName = 'post-image'
) {
  return new Promise<File>((resolve, reject) => {
    const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source)
    const image = new Image()

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = TARGET_WIDTH
        canvas.height = TARGET_HEIGHT

        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Canvas is not available in this browser.')
        }

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT)

        const sourceRatio = image.width / image.height
        let drawWidth = TARGET_WIDTH
        let drawHeight = TARGET_HEIGHT
        let offsetX = 0
        let offsetY = 0

        if (fitMode === 'fill') {
          if (sourceRatio > TARGET_RATIO) {
            drawHeight = TARGET_HEIGHT
            drawWidth = drawHeight * sourceRatio
            offsetX = (TARGET_WIDTH - drawWidth) * imageFocus.x
          } else {
            drawWidth = TARGET_WIDTH
            drawHeight = drawWidth / sourceRatio
            offsetY = (TARGET_HEIGHT - drawHeight) * imageFocus.y
          }
        } else {
          if (sourceRatio > TARGET_RATIO) {
            drawWidth = TARGET_WIDTH
            drawHeight = drawWidth / sourceRatio
            offsetY = (TARGET_HEIGHT - drawHeight) * imageFocus.y
          } else {
            drawHeight = TARGET_HEIGHT
            drawWidth = drawHeight * sourceRatio
            offsetX = (TARGET_WIDTH - drawWidth) * imageFocus.x
          }
        }

        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

        canvas.toBlob(
          (blob) => {
            if (typeof source !== 'string') {
              URL.revokeObjectURL(objectUrl)
            }

            if (!blob) {
              reject(new Error('Failed to export normalized image.'))
              return
            }

            const normalizedFileName = fileName.replace(/\.[^.]+$/, '') || 'post-image'
            const normalizedFile = new File(
              [blob],
              normalizedFileName + '-1080x1350.jpg',
              { type: 'image/jpeg' }
            )

            resolve(normalizedFile)
          },
          'image/jpeg',
          0.92
        )
      } catch (error) {
        if (typeof source !== 'string') {
          URL.revokeObjectURL(objectUrl)
        }
        reject(error instanceof Error ? error : new Error('Image processing failed.'))
      }
    }

    image.onerror = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(objectUrl)
      }
      reject(new Error('Could not load the selected image.'))
    }

    image.crossOrigin = 'anonymous'
    image.src = objectUrl
  })
}

async function fetchImageUrlAsBlob(imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error('Could not download image URL for 1080x1350 processing.')
  }

  const imageBlob = await response.blob()
  if (!imageBlob.type.startsWith('image/')) {
    throw new Error('Image URL did not return an image file.')
  }

  return imageBlob
}

function imageUrlToFileName(imageUrl: string) {
  try {
    const pathname = new URL(imageUrl).pathname
    const fileName = pathname.split('/').filter(Boolean).pop()
    return fileName || 'post-image'
  } catch {
    return 'post-image'
  }
}

interface PostModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post?: Post | null
  defaultPageId?: string
  defaultTimeSlot?: string
  defaultDate?: string
}

const statusOptions: { value: PostStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ready', label: 'Ready' },
  { value: 'due_now', label: 'Due Now' },
  { value: 'posted', label: 'Posted' },
  { value: 'late', label: 'Late' },
  { value: 'skipped', label: 'Skipped' },
]

export function PostModal({
  open,
  onOpenChange,
  post,
  defaultPageId,
  defaultTimeSlot,
  defaultDate,
}: PostModalProps) {
  const { addPost, updatePost, pages, selectedDate } = useAppStore()
  const isEditing = !!post
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')
  const [selectedImageMeta, setSelectedImageMeta] = useState<SelectedImageMeta | null>(null)
  const [imageFitMode, setImageFitMode] = useState<ImageFitMode>('fill')
  const [imageFocus, setImageFocus] = useState<ImageFocus>({ x: 0.5, y: 0.5 })
  const cropDragStartRef = useRef<{
    clientX: number
    clientY: number
    focus: ImageFocus
  } | null>(null)

  const [formData, setFormData] = useState({
    pageId: '',
    postDate: '',
    timeSlot: '',
    imageUrl: '',
    caption: '',
    adsLink: '',
    status: 'draft' as PostStatus,
    notes: '',
  })

  useEffect(() => {
    if (post) {
      setFormData({
        pageId: post.pageId,
        postDate: post.postDate,
        timeSlot: post.timeSlot,
        imageUrl: post.imageUrl || '',
        caption: post.caption,
        adsLink: post.adsLink || '',
        status: post.status,
        notes: post.notes,
      })
    } else {
      setFormData({
        pageId: defaultPageId || '',
        postDate: defaultDate || selectedDate,
        timeSlot: defaultTimeSlot || '',
        imageUrl: '',
        caption: '',
        adsLink: '',
        status: 'scheduled',
        notes: '',
      })
    }
    setIsSaving(false)
    setSelectedFile(null)
    setSelectedImageMeta(null)
    setImageFitMode('fill')
    setImageFocus({ x: 0.5, y: 0.5 })
    setErrorMessage('')
  }, [post, open, defaultPageId, defaultTimeSlot, defaultDate, selectedDate])

  useEffect(() => {
    if (!selectedFile) {
      setSelectedImagePreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setSelectedImagePreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedFile])

  useEffect(() => {
    if (!open) return

    const handlePaste = async (event: ClipboardEvent) => {
      const imageFile = extractImageFileFromClipboard(event)
      if (imageFile) {
        event.preventDefault()
        setErrorMessage('')
        setSelectedFile(imageFile)

        try {
          const meta = await readImageDimensions(imageFile)
          setSelectedImageMeta(meta)
        } catch (error) {
          setSelectedImageMeta(null)
          setErrorMessage(error instanceof Error ? error.message : 'Failed to inspect pasted image.')
        }

        return
      }

      const pastedText = getPastedTextFromClipboard(event)
      if (!pastedText) return

      const pastedUrl = parseSingleUrl(pastedText)
      event.preventDefault()
      setErrorMessage('')

      if (pastedUrl && isImageUrl(pastedUrl)) {
        const imageUrl = pastedUrl.href
        setSelectedFile(null)
        setSelectedImageMeta(null)
        setFormData((prev) => ({ ...prev, imageUrl }))

        try {
          const meta = await readImageDimensions(imageUrl)
          setSelectedImageMeta(meta)
        } catch {
          setSelectedImageMeta(null)
        }
        return
      }

      if (pastedUrl) {
        setFormData((prev) => ({ ...prev, adsLink: pastedUrl.href }))
        return
      }

      setFormData((prev) => ({ ...prev, caption: pastedText }))
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [open])

  const selectedPage = pages.find((p) => p.id === formData.pageId)
  const previewImageUrl = selectedImagePreviewUrl || formData.imageUrl.trim()
  const showImageResizeControls = selectedImageMeta?.needsAttention || Boolean(previewImageUrl)

  const updateImageFocusFromPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropDragStartRef.current) return

    const rect = event.currentTarget.getBoundingClientRect()
    const deltaX = (event.clientX - cropDragStartRef.current.clientX) / rect.width
    const deltaY = (event.clientY - cropDragStartRef.current.clientY) / rect.height
    const dragDirection = imageFitMode === 'fit' ? 1 : -1

    setImageFocus({
      x: clampFocusValue(cropDragStartRef.current.focus.x + deltaX * dragDirection),
      y: clampFocusValue(cropDragStartRef.current.focus.y + deltaY * dragDirection),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)
    setErrorMessage('')

    try {
      let nextImageUrl = formData.imageUrl
      let nextImagePath = post?.imagePath ?? ''

      if (!selectedFile && !nextImageUrl.trim()) {
        nextImagePath = ''
      }

      if (selectedFile) {
        const normalizedFile = await normalizeImageFile(
          selectedFile,
          imageFitMode,
          imageFocus,
          selectedFile.name
        )
        const uploadedImage = await uploadPostImage(normalizedFile)
        nextImagePath = uploadedImage.imagePath
        nextImageUrl = uploadedImage.imageUrl
      } else if (nextImageUrl.trim() && isSupabaseConfigured) {
        const imageBlob = await fetchImageUrlAsBlob(nextImageUrl)
        const imageMeta = await readImageDimensions(imageBlob)

        if (imageMeta.needsAttention) {
          const normalizedFile = await normalizeImageFile(
            imageBlob,
            imageFitMode,
            imageFocus,
            imageUrlToFileName(nextImageUrl)
          )
          const uploadedImage = await uploadPostImage(normalizedFile)
          nextImagePath = uploadedImage.imagePath
          nextImageUrl = uploadedImage.imageUrl
        }
      }

      const payload = {
        ...formData,
        imagePath: nextImagePath || undefined,
        imageUrl: nextImageUrl || undefined,
      }

      if (isEditing && post) {
        await updatePost(post.id, payload)
      } else {
        await addPost(payload)
      }

      onOpenChange(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save post.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Post' : 'Create New Post'}</DialogTitle>
          <DialogDescription>
            Configure the page, schedule, content, links, and optional image for this post.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pageId">Page</Label>
              <Select
                value={formData.pageId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, pageId: value, timeSlot: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a page" />
                </SelectTrigger>
                <SelectContent>
                  {pages.filter((p) => p.isActive).map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      <div className="flex items-center gap-2">
                        {page.logoUrl ? (
                          <img
                            src={page.logoUrl}
                            alt=""
                            className="h-5 w-5 rounded object-cover"
                          />
                        ) : (
                          <span
                            className="inline-flex h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: page.brandColor }}
                          />
                        )}
                        <span>{page.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as PostStatus }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="postDate">Post Date</Label>
              <Input
                id="postDate"
                type="date"
                value={formData.postDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, postDate: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeSlot">Time Slot</Label>
              <Select
                value={formData.timeSlot}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, timeSlot: value }))}
                disabled={!selectedPage}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedPage ? 'Select time slot' : 'Select page first'} />
                </SelectTrigger>
                <SelectContent>
                  {selectedPage?.timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              value={formData.imageUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageFile">
              Upload Image {isSupabaseConfigured ? '(optional)' : '(requires Supabase config)'}
            </Label>
            <Input
              id="imageFile"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0] ?? null
                setSelectedFile(file)
                setSelectedImageMeta(null)

                if (!file) return

                try {
                  const meta = await readImageDimensions(file)
                  setSelectedImageMeta(meta)
                } catch (error) {
                  setErrorMessage(error instanceof Error ? error.message : 'Failed to inspect image.')
                }
              }}
              disabled={!isSupabaseConfigured || isSaving}
            />
            {selectedFile && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
                {selectedImageMeta && (
                  <p className="text-xs text-muted-foreground">
                    Original size: {selectedImageMeta.width}x{selectedImageMeta.height}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              You can also paste an image here with `Ctrl + V`.
            </p>
          </div>

          {showImageResizeControls && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              {selectedImageMeta?.needsAttention && (
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  This image does not match the 1080x1350 (4:5) format.
                </p>
              )}
              <p className="text-xs text-amber-700/80 dark:text-amber-200/90">
                `Fill` will crop the image to fill the frame. `Fit` will keep the full image and add white space if needed.
              </p>
              {previewImageUrl && (
                <div className="mt-3 space-y-2">
                  <Label>Crop preview</Label>
                  <div
                    className="relative mx-auto aspect-[4/5] max-h-72 w-full max-w-56 cursor-grab touch-none overflow-hidden rounded-md border border-border bg-white active:cursor-grabbing"
                    onPointerDown={(event) => {
                      cropDragStartRef.current = {
                        clientX: event.clientX,
                        clientY: event.clientY,
                        focus: imageFocus,
                      }
                      event.currentTarget.setPointerCapture(event.pointerId)
                    }}
                    onPointerMove={(event) => {
                      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                      updateImageFocusFromPointerDrag(event)
                    }}
                    onPointerUp={(event) => {
                      cropDragStartRef.current = null
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId)
                      }
                    }}
                    onPointerCancel={(event) => {
                      cropDragStartRef.current = null
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId)
                      }
                    }}
                  >
                    <img
                      src={previewImageUrl}
                      alt=""
                      draggable={false}
                      className="h-full w-full select-none"
                      style={{
                        objectFit: imageFitMode === 'fill' ? 'cover' : 'contain',
                        objectPosition: `${imageFocus.x * 100}% ${imageFocus.y * 100}%`,
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10" />
                  </div>
                </div>
              )}
              <div className="mt-3 space-y-2">
                <Label htmlFor="imageFitMode">Resize mode</Label>
                <Select
                  value={imageFitMode}
                  onValueChange={(value) => setImageFitMode(value as ImageFitMode)}
                >
                  <SelectTrigger id="imageFitMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fill">Fill 1080x1350 (may crop)</SelectItem>
                    <SelectItem value="fit">Fit 1080x1350 (no crop)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={formData.caption}
              onChange={(e) => setFormData((prev) => ({ ...prev, caption: e.target.value }))}
              placeholder="Write your post caption here..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adsLink">Ads Link (optional)</Label>
            <Input
              id="adsLink"
              value={formData.adsLink}
              onChange={(e) => setFormData((prev) => ({ ...prev, adsLink: e.target.value }))}
              placeholder="https://example.com/product"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Notes for internal use..."
              rows={2}
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          </div>

          <DialogFooter className="mt-4 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Post'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

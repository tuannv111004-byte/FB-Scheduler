"use client"

import { useState, useEffect } from 'react'
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

async function readImageDimensions(file: File) {
  return new Promise<SelectedImageMeta>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      const ratio = image.width / image.height
      const ratioDiff = Math.abs(ratio - TARGET_RATIO)
      URL.revokeObjectURL(objectUrl)
      resolve({
        width: image.width,
        height: image.height,
        ratio,
        needsAttention: ratioDiff > 0.02,
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image dimensions.'))
    }

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

async function normalizeImageFile(file: File, fitMode: ImageFitMode) {
  return new Promise<File>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
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
            offsetX = (TARGET_WIDTH - drawWidth) / 2
          } else {
            drawWidth = TARGET_WIDTH
            drawHeight = drawWidth / sourceRatio
            offsetY = (TARGET_HEIGHT - drawHeight) / 2
          }
        } else {
          if (sourceRatio > TARGET_RATIO) {
            drawWidth = TARGET_WIDTH
            drawHeight = drawWidth / sourceRatio
            offsetY = (TARGET_HEIGHT - drawHeight) / 2
          } else {
            drawHeight = TARGET_HEIGHT
            drawWidth = drawHeight * sourceRatio
            offsetX = (TARGET_WIDTH - drawWidth) / 2
          }
        }

        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl)

            if (!blob) {
              reject(new Error('Failed to export normalized image.'))
              return
            }

            const normalizedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '') + '-1080x1350.jpg',
              { type: 'image/jpeg' }
            )

            resolve(normalizedFile)
          },
          'image/jpeg',
          0.92
        )
      } catch (error) {
        URL.revokeObjectURL(objectUrl)
        reject(error instanceof Error ? error : new Error('Image processing failed.'))
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load the selected image.'))
    }

    image.src = objectUrl
  })
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
  const [selectedImageMeta, setSelectedImageMeta] = useState<SelectedImageMeta | null>(null)
  const [imageFitMode, setImageFitMode] = useState<ImageFitMode>('fill')

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
    setErrorMessage('')
  }, [post, open, defaultPageId, defaultTimeSlot, defaultDate, selectedDate])

  useEffect(() => {
    if (!open) return

    const handlePaste = async (event: ClipboardEvent) => {
      const imageFile = extractImageFileFromClipboard(event)
      if (!imageFile) return

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
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [open])

  const selectedPage = pages.find((p) => p.id === formData.pageId)

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
        const normalizedFile = await normalizeImageFile(selectedFile, imageFitMode)
        const uploadedImage = await uploadPostImage(normalizedFile)
        nextImagePath = uploadedImage.imagePath
        nextImageUrl = uploadedImage.imageUrl
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

          {selectedImageMeta?.needsAttention && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                This image does not match the 1080x1350 (4:5) format.
              </p>
              <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/90">
                `Fill` will crop the image to fill the frame. `Fit` will keep the full image and add white space if needed.
              </p>
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

          {formData.imageUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <img
                src={formData.imageUrl}
                alt=""
                className="h-28 w-full rounded-md border border-border object-cover"
              />
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

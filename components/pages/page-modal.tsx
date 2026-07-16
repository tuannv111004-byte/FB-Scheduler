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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { uploadPageLogoImage } from '@/lib/supabase'
import type { FacebookPage, PageInput } from '@/lib/types'

const defaultBrandColor = '#14b8a6'
const defaultTimeSlots = ['08:00', '15:00', '20:00', '23:00', '02:00']
const nextDaySlotBoundaryMinutes = 6 * 60

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

function compareTimeSlots(first: string, second: string) {
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

function extractImageFileFromClipboard(event: React.ClipboardEvent) {
  for (const item of Array.from(event.clipboardData.items)) {
    if (!item.type.startsWith('image/')) continue

    const file = item.getAsFile()
    if (file) return file
  }

  return null
}

async function detectColorFromImage(imageUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        if (!context) {
          reject(new Error('Canvas is not available in this browser.'))
          return
        }

        const sampleSize = 24
        canvas.width = sampleSize
        canvas.height = sampleSize
        context.drawImage(image, 0, 0, sampleSize, sampleSize)

        const { data } = context.getImageData(0, 0, sampleSize, sampleSize)

        const buckets = new Map<string, { count: number; red: number; green: number; blue: number; score: number }>()

        const getSaturation = (red: number, green: number, blue: number) => {
          const max = Math.max(red, green, blue)
          const min = Math.min(red, green, blue)
          if (max === 0) return 0
          return (max - min) / max
        }

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index]
          const green = data[index + 1]
          const blue = data[index + 2]
          const alpha = data[index + 3]
          if (alpha < 32) continue

          const brightness = (red + green + blue) / 3
          const saturation = getSaturation(red, green, blue)

          if (brightness > 242) continue
          if (brightness < 24) continue
          if (saturation < 0.18) continue

          const bucketRed = Math.round(red / 24) * 24
          const bucketGreen = Math.round(green / 24) * 24
          const bucketBlue = Math.round(blue / 24) * 24
          const key = `${bucketRed}-${bucketGreen}-${bucketBlue}`

          const existing = buckets.get(key)
          const pixelScore = 1 + saturation * 2

          if (existing) {
            existing.count += 1
            existing.red += red
            existing.green += green
            existing.blue += blue
            existing.score += pixelScore
          } else {
            buckets.set(key, {
              count: 1,
              red,
              green,
              blue,
              score: pixelScore,
            })
          }
        }

        const sortedBuckets = [...buckets.values()].sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score
          return right.count - left.count
        })

        const dominantBucket = sortedBuckets[0]

        if (!dominantBucket) {
          reject(new Error('Could not detect a dominant brand color from the logo.'))
          return
        }

        const totalArea = sortedBuckets.reduce((sum, bucket) => sum + bucket.count, 0)
        const dominantShare = dominantBucket.count / totalArea

        // Anchor on the most visible color, then blend in secondary colors by their occupied area.
        let blendedRed = dominantBucket.red / dominantBucket.count
        let blendedGreen = dominantBucket.green / dominantBucket.count
        let blendedBlue = dominantBucket.blue / dominantBucket.count
        let accumulatedWeight = 1

        for (const bucket of sortedBuckets.slice(1)) {
          const areaRatio = bucket.count / totalArea
          const blendWeight = areaRatio * Math.max(0.2, 1 - dominantShare)
          const bucketRed = bucket.red / bucket.count
          const bucketGreen = bucket.green / bucket.count
          const bucketBlue = bucket.blue / bucket.count

          blendedRed += bucketRed * blendWeight
          blendedGreen += bucketGreen * blendWeight
          blendedBlue += bucketBlue * blendWeight
          accumulatedWeight += blendWeight
        }

        const toHex = (value: number) =>
          Math.max(0, Math.min(255, Math.round(value / accumulatedWeight)))
            .toString(16)
            .padStart(2, '0')

        resolve(`#${toHex(blendedRed)}${toHex(blendedGreen)}${toHex(blendedBlue)}`)
      } catch {
        reject(new Error('Logo color detection was blocked by the image source.'))
      }
    }

    image.onerror = () => {
      reject(new Error('Could not load the logo image from this URL.'))
    }

    image.src = imageUrl
  })
}

interface PageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  page?: FacebookPage | null
}

export function PageModal({ open, onOpenChange, page }: PageModalProps) {
  const { addPage, updatePage } = useAppStore()
  const isEditing = !!page
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDetectingColor, setIsDetectingColor] = useState(false)
  const [lastDetectedLogoUrl, setLastDetectedLogoUrl] = useState('')
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('')

  const [formData, setFormData] = useState<PageInput>({
    name: '',
    pageUrl: '',
    logoUrl: '',
    brandColor: defaultBrandColor,
    isActive: true,
    postsPerDay: 5,
    timeSlots: defaultTimeSlots,
    ctaTemplates: [],
    mediaType: 'image',
    notes: '',
  })

  const [newTimeSlot, setNewTimeSlot] = useState('')

  useEffect(() => {
    if (page) {
      setFormData({
        name: page.name,
        pageUrl: page.pageUrl,
        logoUrl: page.logoUrl || '',
        brandColor: page.brandColor,
        isActive: page.isActive,
        postsPerDay: page.postsPerDay,
        timeSlots: [...page.timeSlots],
        ctaTemplates: [...page.ctaTemplates],
        mediaType: page.mediaType === 'video' ? 'video' : 'image',
        notes: page.notes,
      })
    } else {
      setFormData({
        name: '',
        pageUrl: '',
        logoUrl: '',
        brandColor: defaultBrandColor,
        isActive: true,
        postsPerDay: 5,
        timeSlots: defaultTimeSlots,
        ctaTemplates: [],
        mediaType: 'image',
        notes: '',
      })
    }
    setIsSaving(false)
    setErrorMessage('')
    setIsDetectingColor(false)
    setLastDetectedLogoUrl('')
    setSelectedLogoFile(null)
    setLogoPreviewUrl('')
  }, [page, open])

  useEffect(() => {
    if (!selectedLogoFile) {
      setLogoPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(selectedLogoFile)
    setLogoPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedLogoFile])

  useEffect(() => {
    if (!open) return

    const normalizedLogoUrl = (logoPreviewUrl || formData.logoUrl || '').trim()
    if (!normalizedLogoUrl) return
    if (normalizedLogoUrl === lastDetectedLogoUrl) return

    const timeoutId = window.setTimeout(async () => {
      setIsDetectingColor(true)
      try {
        const detectedColor = await detectColorFromImage(normalizedLogoUrl)
        setFormData((prev) => ({ ...prev, brandColor: detectedColor }))
        setLastDetectedLogoUrl(normalizedLogoUrl)
      } catch {
        // Keep manual color selection available if auto-detection fails.
      } finally {
        setIsDetectingColor(false)
      }
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [formData.logoUrl, lastDetectedLogoUrl, logoPreviewUrl, open])

  const handleAddTimeSlot = () => {
    if (newTimeSlot && !formData.timeSlots.includes(newTimeSlot)) {
      setFormData((prev) => ({
        ...prev,
        timeSlots: [...prev.timeSlots, newTimeSlot].sort(compareTimeSlots),
      }))
      setNewTimeSlot('')
    }
  }

  const handleRemoveTimeSlot = (slot: string) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((s) => s !== slot),
    }))
  }

  const handleLogoPaste = (event: React.ClipboardEvent) => {
    const imageFile = extractImageFileFromClipboard(event)
    if (!imageFile) return

    event.preventDefault()
    setLastDetectedLogoUrl('')
    setSelectedLogoFile(imageFile)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)
    setErrorMessage('')

    try {
      let nextFormData = formData
      if (selectedLogoFile) {
        const uploadedLogo = await uploadPageLogoImage(selectedLogoFile)
        nextFormData = {
          ...formData,
          logoUrl: uploadedLogo.imageUrl,
        }
      }

      if (isEditing && page) {
        await updatePage(page.id, nextFormData)
      } else {
        await addPage(nextFormData)
      }
      onOpenChange(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save page.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Page' : 'Add New Page'}</DialogTitle>
          <DialogDescription>
            Configure the page identity, schedule, and whether posts use images or videos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Page Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Tech News Daily"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pageUrl">Facebook Page URL</Label>
            <Input
              id="pageUrl"
              value={formData.pageUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, pageUrl: e.target.value }))}
              placeholder="https://facebook.com/yourpage"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]" onPaste={handleLogoPaste}>
            <div className="space-y-2">
              <Label htmlFor="logoFile">Page Logo Image</Label>
              <Input
                id="logoFile"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setLastDetectedLogoUrl('')
                  setSelectedLogoFile(file)
                }}
              />
              {selectedLogoFile && (
                <p className="text-xs text-muted-foreground">{selectedLogoFile.name}</p>
              )}
              {(formData.logoUrl || selectedLogoFile) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedLogoFile(null)
                    setLastDetectedLogoUrl('')
                    setFormData((prev) => ({ ...prev, logoUrl: '' }))
                  }}
                >
                  Remove Logo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {isDetectingColor
                  ? 'Detecting page color from logo...'
                  : 'Choose an image file or paste an image here. It will upload to storage when saved.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandColor">Page Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="brandColor"
                  type="color"
                  value={formData.brandColor}
                  onChange={(e) => setFormData((prev) => ({ ...prev, brandColor: e.target.value }))}
                  className="h-10 w-14 p-1"
                />
                <Input
                  value={formData.brandColor}
                  onChange={(e) => setFormData((prev) => ({ ...prev, brandColor: e.target.value }))}
                  className="w-28 font-mono uppercase"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div className="flex items-center gap-3">
              {logoPreviewUrl || formData.logoUrl ? (
                <img
                  src={logoPreviewUrl || formData.logoUrl}
                  alt=""
                  className="h-12 w-12 rounded-xl border border-border object-cover"
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: formData.brandColor }}
                >
                  {formData.name.slice(0, 2).toUpperCase() || 'PG'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground">{formData.name || 'Page name'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="inline-flex h-3 w-3 rounded-full"
                    style={{ backgroundColor: formData.brandColor }}
                  />
                  <p className="truncate text-xs text-muted-foreground">
                    {formData.pageUrl || 'https://facebook.com/yourpage'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Active Status</Label>
              <p className="text-xs text-muted-foreground">Enable posting schedule for this page</p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mediaType">Post Media Type</Label>
            <Select
              value={formData.mediaType}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, mediaType: value === 'video' ? 'video' : 'image' }))
              }
            >
              <SelectTrigger id="mediaType">
                <SelectValue placeholder="Select media type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image page</SelectItem>
                <SelectItem value="video">Video page</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Video pages upload post media to Google Drive and keep the caption/schedule in the post.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Time Slots</Label>
            <div className="flex flex-wrap gap-2">
              {formData.timeSlots.map((slot) => (
                <div
                  key={slot}
                  className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-sm"
                >
                  {slot}
                  <button
                    type="button"
                    onClick={() => handleRemoveTimeSlot(slot)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="time"
                value={newTimeSlot}
                onChange={(e) => setNewTimeSlot(e.target.value)}
                className="w-32"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddTimeSlot}>
                <Plus className="h-4 w-4 mr-1" />
                Add Slot
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Internal notes about this page..."
              rows={3}
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Page'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

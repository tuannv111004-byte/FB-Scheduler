"use client"

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { PosterLabFranchise, PosterLabFranchiseInput, PosterLabGenre } from '@/lib/types'

type FranchiseModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  franchise?: PosterLabFranchise | null
  isSaving: boolean
  onSave: (value: PosterLabFranchiseInput) => Promise<void>
}

const defaultFranchiseInput: PosterLabFranchiseInput = {
  franchiseName: '',
  latestOfficialTitle: '',
  genre: 'other',
  notes: '',
}

const genreLabels: Record<PosterLabGenre, string> = {
  action: 'Action',
  horror: 'Horror',
  sci_fi: 'Sci-Fi',
  fantasy: 'Fantasy',
  thriller: 'Thriller',
  drama: 'Drama',
  romance: 'Romance',
  comedy: 'Comedy',
  mystery: 'Mystery',
  crime: 'Crime',
  animation: 'Animation',
  other: 'Other',
}

export function FranchiseModal({
  open,
  onOpenChange,
  franchise,
  isSaving,
  onSave,
}: FranchiseModalProps) {
  const [formData, setFormData] = useState<PosterLabFranchiseInput>(defaultFranchiseInput)

  useEffect(() => {
    if (!open) return

    if (franchise) {
      setFormData({
        franchiseName: franchise.franchiseName,
        latestOfficialTitle: franchise.latestOfficialTitle,
        genre: franchise.genre,
        notes: franchise.notes,
      })
      return
    }

    setFormData(defaultFranchiseInput)
  }, [franchise, open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onSave({
      ...formData,
      franchiseName: formData.franchiseName.trim(),
      latestOfficialTitle: formData.latestOfficialTitle.trim(),
      notes: formData.notes.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{franchise ? 'Edit Franchise' : 'Add Franchise'}</DialogTitle>
          <DialogDescription>
            Save the real latest movie first, then attach fictional next installments under it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="franchise-name">Franchise Name</Label>
              <Input
                id="franchise-name"
                value={formData.franchiseName}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, franchiseName: event.target.value }))
                }
                placeholder="John Wick"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select
                value={formData.genre}
                onValueChange={(value: PosterLabGenre) =>
                  setFormData((current) => ({ ...current, genre: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(genreLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="latest-official-title">Latest Official Movie Title</Label>
            <Input
              id="latest-official-title"
              value={formData.latestOfficialTitle}
              onChange={(event) =>
                setFormData((current) => ({ ...current, latestOfficialTitle: event.target.value }))
              }
              placeholder="John Wick: Chapter 4"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="franchise-notes">Notes</Label>
            <Textarea
              id="franchise-notes"
              value={formData.notes}
              onChange={(event) =>
                setFormData((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Optional context for the fake sequel direction"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSaving ||
                formData.franchiseName.trim().length === 0 ||
                formData.latestOfficialTitle.trim().length === 0
              }
            >
              {isSaving ? 'Saving...' : franchise ? 'Save Franchise' : 'Create Franchise'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

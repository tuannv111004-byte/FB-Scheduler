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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { PosterLabFranchise, PosterLabSequel, PosterLabSequelInput } from '@/lib/types'

type SequelModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sequel?: PosterLabSequel | null
  defaultFranchiseId?: string | null
  franchises: PosterLabFranchise[]
  isSaving: boolean
  onSave: (value: PosterLabSequelInput) => Promise<void>
}

const emptySequelInput: PosterLabSequelInput = {
  franchiseId: '',
  fakeTitle: '',
  releaseYear: new Date().getFullYear() + 1,
  tagline: '',
  synopsis: '',
  visualHook: '',
  prompt: '',
  isUsed: false,
}

export function SequelModal({
  open,
  onOpenChange,
  sequel,
  defaultFranchiseId,
  franchises,
  isSaving,
  onSave,
}: SequelModalProps) {
  const [formData, setFormData] = useState<PosterLabSequelInput>(emptySequelInput)

  useEffect(() => {
    if (!open) return

    if (sequel) {
      setFormData({
        franchiseId: sequel.franchiseId,
        fakeTitle: sequel.fakeTitle,
        releaseYear: sequel.releaseYear,
        tagline: sequel.tagline,
        synopsis: sequel.synopsis,
        visualHook: sequel.visualHook,
        prompt: sequel.prompt,
        isUsed: sequel.isUsed,
      })
      return
    }

    setFormData({
      ...emptySequelInput,
      franchiseId: defaultFranchiseId ?? franchises[0]?.id ?? '',
    })
  }, [defaultFranchiseId, franchises, open, sequel])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onSave({
      ...formData,
      fakeTitle: formData.fakeTitle.trim(),
      tagline: formData.tagline.trim(),
      synopsis: formData.synopsis.trim(),
      visualHook: formData.visualHook.trim(),
      prompt: formData.prompt.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{sequel ? 'Edit Fake Sequel' : 'Add Fake Sequel'}</DialogTitle>
          <DialogDescription>
            Create an invented next movie under a real franchise entry.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="sequel-franchise">Franchise</Label>
            <select
              id="sequel-franchise"
              value={formData.franchiseId}
              onChange={(event) =>
                setFormData((current) => ({ ...current, franchiseId: event.target.value }))
              }
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              required
            >
              <option value="" disabled>
                Select franchise
              </option>
              {franchises.map((franchise) => (
                <option key={franchise.id} value={franchise.id}>
                  {franchise.franchiseName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sequel-title">Fake Next Movie Title</Label>
              <Input
                id="sequel-title"
                value={formData.fakeTitle}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, fakeTitle: event.target.value }))
                }
                placeholder="John Wick: Last Contract"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sequel-year">Release Year</Label>
              <Input
                id="sequel-year"
                type="number"
                value={formData.releaseYear}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    releaseYear: Math.max(1900, Number(event.target.value) || new Date().getFullYear()),
                  }))
                }
                min={1900}
                max={3000}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sequel-tagline">Tagline</Label>
            <Input
              id="sequel-tagline"
              value={formData.tagline}
              onChange={(event) =>
                setFormData((current) => ({ ...current, tagline: event.target.value }))
              }
              placeholder="One more job. No more mercy."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sequel-synopsis">Synopsis</Label>
            <Textarea
              id="sequel-synopsis"
              value={formData.synopsis}
              onChange={(event) =>
                setFormData((current) => ({ ...current, synopsis: event.target.value }))
              }
              placeholder="Short fake sequel setup..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sequel-visual-hook">Visual Hook</Label>
            <Textarea
              id="sequel-visual-hook"
              value={formData.visualHook}
              onChange={(event) =>
                setFormData((current) => ({ ...current, visualHook: event.target.value }))
              }
              placeholder="Poster key visual direction"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sequel-prompt">Prompt</Label>
            <Textarea
              id="sequel-prompt"
              value={formData.prompt}
              onChange={(event) =>
                setFormData((current) => ({ ...current, prompt: event.target.value }))
              }
              placeholder="Optional image prompt"
              rows={5}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="font-medium text-foreground">Used</p>
              <p className="text-sm text-muted-foreground">
                Mark if this fake sequel has already been used for a poster.
              </p>
            </div>
            <Switch
              checked={formData.isUsed}
              onCheckedChange={(checked) =>
                setFormData((current) => ({ ...current, isUsed: checked }))
              }
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
                formData.franchiseId.length === 0 ||
                formData.fakeTitle.trim().length === 0 ||
                formData.tagline.trim().length === 0
              }
            >
              {isSaving ? 'Saving...' : sequel ? 'Save Sequel' : 'Create Sequel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

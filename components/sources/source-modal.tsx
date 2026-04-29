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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { SourceInput, SourceItem, SourceType } from '@/lib/types'

type SourceModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  source?: SourceItem | null
  isSaving: boolean
  onSave: (value: SourceInput) => Promise<void>
}

const defaultSourceInput: SourceInput = {
  name: '',
  url: '',
  type: 'website',
  description: '',
  notes: '',
  isActive: true,
}

const sourceTypeLabels: Record<SourceType, string> = {
  website: 'Website',
  social: 'Social',
  news: 'News',
  community: 'Community',
  tool: 'Tool',
  other: 'Other',
}

export function SourceModal({
  open,
  onOpenChange,
  source,
  isSaving,
  onSave,
}: SourceModalProps) {
  const [formData, setFormData] = useState<SourceInput>(defaultSourceInput)

  useEffect(() => {
    if (!open) return

    if (source) {
      setFormData({
        name: source.name,
        url: source.url,
        type: source.type,
        description: source.description,
        notes: source.notes,
        isActive: source.isActive,
      })
      return
    }

    setFormData(defaultSourceInput)
  }, [open, source])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onSave({
      ...formData,
      name: formData.name.trim(),
      url: formData.url.trim(),
      description: formData.description.trim(),
      notes: formData.notes.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{source ? 'Edit Source' : 'Add Source'}</DialogTitle>
          <DialogDescription>
            Save useful sources for research, discovery, and content planning.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source-name">Source Name</Label>
              <Input
                id="source-name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Facebook search, Reddit, Google Trends..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Source Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: SourceType) =>
                  setFormData((current) => ({ ...current, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sourceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-url">URL</Label>
            <Input
              id="source-url"
              value={formData.url}
              onChange={(event) =>
                setFormData((current) => ({ ...current, url: event.target.value }))
              }
              placeholder="https://..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-description">Description</Label>
            <Textarea
              id="source-description"
              value={formData.description}
              onChange={(event) =>
                setFormData((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="What this source is useful for"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-notes">Notes</Label>
            <Textarea
              id="source-notes"
              value={formData.notes}
              onChange={(event) =>
                setFormData((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Search tips, account notes, workflow reminders..."
              rows={5}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="font-medium text-foreground">Active</p>
              <p className="text-sm text-muted-foreground">
                Inactive sources stay stored but can be visually deprioritized.
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData((current) => ({ ...current, isActive: checked }))
              }
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || formData.name.trim().length === 0 || formData.url.trim().length === 0}
            >
              {isSaving ? 'Saving...' : source ? 'Save Source' : 'Create Source'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

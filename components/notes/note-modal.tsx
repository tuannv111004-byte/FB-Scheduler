"use client"

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { NoteInput, StickyNote } from '@/lib/types'

const noteColors = ['#fef08a', '#bfdbfe', '#fecdd3', '#bbf7d0', '#fde68a', '#ddd6fe']

type NoteModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: StickyNote | null
  isSaving: boolean
  onSave: (value: NoteInput) => Promise<void>
}

export function NoteModal({ open, onOpenChange, note, isSaving, onSave }: NoteModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState(noteColors[0])

  useEffect(() => {
    if (!open) return

    setTitle(note?.title ?? '')
    setContent(note?.content ?? '')
    setColor(note?.color ?? noteColors[0])
  }, [note, open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    await onSave({
      title: title.trim(),
      content: content.trim(),
      color,
      sortOrder: note?.sortOrder ?? 0,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>{note ? 'Edit Note' : 'New Note'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Quick reminder"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-content">Content</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write whatever needs to stay visible..."
              rows={12}
              className="max-h-[45vh] min-h-40 overflow-y-auto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {noteColors.map((noteColor) => (
                <button
                  key={noteColor}
                  type="button"
                  onClick={() => setColor(noteColor)}
                  className="h-9 w-9 rounded-full border-2 transition-transform hover:scale-105"
                  style={{
                    backgroundColor: noteColor,
                    borderColor: color === noteColor ? 'hsl(var(--foreground))' : 'transparent',
                  }}
                  title={noteColor}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || content.trim().length === 0}>
              {isSaving ? 'Saving...' : note ? 'Save Note' : 'Create Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Copy, Plus, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import type { NoteInput, StickyNote as StickyNoteType } from '@/lib/types'
import {
  createNoteRemote,
  deleteNoteRemote,
  fetchNotesRemote,
  isSupabaseConfigured,
  updateNoteRemote,
} from '@/lib/supabase'
import { NoteModal } from './note-modal'

function getNextSortOrder(notes: StickyNoteType[]) {
  return notes.reduce((maxValue, note) => Math.max(maxValue, note.sortOrder), -1) + 1
}

function getCardRotation(index: number) {
  const rotations = ['rotate(-1.2deg)', 'rotate(0.8deg)', 'rotate(-0.4deg)', 'rotate(1.1deg)']
  return rotations[index % rotations.length]
}

function reorderNotes(notes: StickyNoteType[], fromId: string, toId: string) {
  if (fromId === toId) return notes

  const nextNotes = [...notes]
  const fromIndex = nextNotes.findIndex((note) => note.id === fromId)
  const toIndex = nextNotes.findIndex((note) => note.id === toId)

  if (fromIndex === -1 || toIndex === -1) return notes

  const [movedNote] = nextNotes.splice(fromIndex, 1)
  nextNotes.splice(toIndex, 0, movedNote)

  return nextNotes.map((note, index) => ({
    ...note,
    sortOrder: index,
  }))
}

export function NotesBoard() {
  const [notes, setNotes] = useState<StickyNoteType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingNote, setEditingNote] = useState<StickyNoteType | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [notePendingDelete, setNotePendingDelete] = useState<StickyNoteType | null>(null)
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [dragPosition, setDragPosition] = useState<{
    x: number
    y: number
    width: number
    height: number
    pointerOffsetX: number
    pointerOffsetY: number
  } | null>(null)
  const dragPositionRef = useRef<{
    x: number
    y: number
    width: number
    height: number
    pointerOffsetX: number
    pointerOffsetY: number
  } | null>(null)

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
        return right.updatedAt.getTime() - left.updatedAt.getTime()
      }),
    [notes]
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    let isCancelled = false

    const loadNotes = async () => {
      try {
        const remoteNotes = await fetchNotesRemote()
        if (!isCancelled) {
          setNotes(remoteNotes)
        }
      } catch (error) {
        if (!isCancelled) {
          toast({
            title: 'Failed to load notes',
            description: error instanceof Error ? error.message : 'Could not fetch notes from Supabase.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadNotes()

    return () => {
      isCancelled = true
    }
  }, [])

  const handleCreate = () => {
    setEditingNote(null)
    setIsModalOpen(true)
  }

  const handleEdit = (note: StickyNoteType) => {
    setEditingNote(note)
    setIsModalOpen(true)
  }

  const handleSave = async (value: NoteInput) => {
    if (!isSupabaseConfigured) return

    setIsSaving(true)
    try {
      if (editingNote) {
        const updatedNote = await updateNoteRemote(editingNote.id, value)
        setNotes((current) => current.map((note) => (note.id === editingNote.id ? updatedNote : note)))
        toast({ title: 'Note updated' })
      } else {
        const createdNote = await createNoteRemote({
          ...value,
          sortOrder: getNextSortOrder(notes),
        })
        setNotes((current) => [...current, createdNote])
        toast({ title: 'Note created' })
      }

      setIsModalOpen(false)
      setEditingNote(null)
    } catch (error) {
      toast({
        title: 'Failed to save note',
        description: error instanceof Error ? error.message : 'Could not save note to Supabase.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!isSupabaseConfigured) return

    setDeletingNoteId(noteId)
    try {
      await deleteNoteRemote(noteId)
      setNotes((current) => current.filter((note) => note.id !== noteId))
      toast({ title: 'Note deleted' })
    } catch (error) {
      toast({
        title: 'Failed to delete note',
        description: error instanceof Error ? error.message : 'Could not delete note from Supabase.',
        variant: 'destructive',
      })
    } finally {
      setDeletingNoteId(null)
    }
  }

  const handleCopy = async (note: StickyNoteType) => {
    const valueToCopy = note.title.trim()
      ? `${note.title.trim()}\n\n${note.content}`
      : note.content

    try {
      await navigator.clipboard.writeText(valueToCopy)
      toast({
        title: 'Note copied',
        description: valueToCopy.length > 72 ? `${valueToCopy.slice(0, 72)}...` : valueToCopy,
      })
    } catch {
      toast({
        title: 'Failed to copy note',
        description: 'Clipboard access was blocked by the browser.',
        variant: 'destructive',
      })
    }
  }

  const handleDragReorder = (targetNoteId: string) => {
    if (!draggedNoteId || draggedNoteId === targetNoteId) return

    setNotes((current) => reorderNotes(current, draggedNoteId, targetNoteId))
  }

  const handleDrop = async () => {
    if (!draggedNoteId || !isSupabaseConfigured) {
      setDraggedNoteId(null)
      return
    }

    const reorderedNotes = [...notes].sort((left, right) => left.sortOrder - right.sortOrder)
    const notesToPersist = reorderedNotes.map((note, index) => ({ note, nextSortOrder: index }))

    setDraggedNoteId(null)

    setIsReordering(true)
    try {
      const updatedNotes = await Promise.all(
        notesToPersist.map(({ note, nextSortOrder }) =>
          updateNoteRemote(note.id, { sortOrder: nextSortOrder })
        )
      )

      setNotes(updatedNotes)
      toast({ title: 'Notes reordered' })
    } catch (error) {
      toast({
        title: 'Failed to reorder notes',
        description: error instanceof Error ? error.message : 'Could not save note order to Supabase.',
        variant: 'destructive',
      })

      try {
        const remoteNotes = await fetchNotesRemote()
        setNotes(remoteNotes)
      } catch {
        // Keep optimistic order if refresh also fails.
      }
    } finally {
      setIsReordering(false)
    }
  }

  useEffect(() => {
    if (!draggedNoteId || !dragPosition) return

    dragPositionRef.current = dragPosition

    const handlePointerMove = (event: PointerEvent) => {
      const currentPosition = dragPositionRef.current
      if (!currentPosition) return

      const nextPosition = {
        ...currentPosition,
        x: event.clientX - currentPosition.pointerOffsetX,
        y: event.clientY - currentPosition.pointerOffsetY,
      }

      dragPositionRef.current = nextPosition
      setDragPosition(nextPosition)
    }

    const handlePointerUp = () => {
      setDragPosition(null)
      void handleDrop()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragPosition, draggedNoteId, notes])

  if (!isSupabaseConfigured) {
    return (
      <Alert className="border-amber-400/50 bg-amber-500/10">
        <StickyNote className="h-4 w-4" />
        <AlertTitle>Supabase required</AlertTitle>
        <AlertDescription>
          Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then run the updated
          schema so notes can be saved to the database.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Sticky Notes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Short planning notes stored in Supabase and shown as a board.
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Note
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading notes...</div>
          ) : sortedNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
              <StickyNote className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-base font-medium text-foreground">No notes yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the first sticky note to keep quick reminders visible.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {sortedNotes.map((note, index) => (
                <div
                  key={note.id}
                  onPointerEnter={() => {
                    handleDragReorder(note.id)
                  }}
                  className="animate-in fade-in slide-in-from-bottom-2 transition-transform duration-200 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <article
                    onPointerDown={(event) => {
                      const target = event.target as HTMLElement
                      if (target.closest('button, a, textarea, input')) return

                      event.preventDefault()

                      const rect = event.currentTarget.getBoundingClientRect()
                      const nextDragPosition = {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height,
                        pointerOffsetX: event.clientX - rect.left,
                        pointerOffsetY: event.clientY - rect.top,
                      }

                      dragPositionRef.current = nextDragPosition
                      setDraggedNoteId(note.id)
                      setDragPosition(nextDragPosition)
                    }}
                    className="relative flex min-h-64 cursor-grab select-none flex-col rounded-2xl border border-black/10 p-5 shadow-lg transition-[transform,box-shadow,filter,opacity] duration-200 active:cursor-grabbing"
                    aria-busy={isReordering}
                    style={{
                      backgroundColor: note.color,
                      transform:
                        draggedNoteId === note.id && dragPosition
                          ? 'rotate(0deg)'
                          : getCardRotation(index),
                      boxShadow:
                        draggedNoteId === note.id
                          ? '0 24px 60px rgba(15, 23, 42, 0.28)'
                          : undefined,
                      filter: draggedNoteId === note.id ? 'saturate(1.05)' : undefined,
                      opacity: draggedNoteId === note.id && dragPosition ? 0.2 : 1,
                      touchAction: 'none',
                    }}
                  >
                    <div className="absolute right-3 top-3 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-white/50 text-slate-700 hover:bg-white/70"
                        onClick={() => handleCopy(note)}
                        title="Copy note"
                        draggable={false}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-white/50 text-slate-700 hover:bg-white/70"
                        onClick={() => handleEdit(note)}
                        title="Edit note"
                        draggable={false}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-white/50 text-slate-700 hover:bg-white/70"
                        onClick={() => setNotePendingDelete(note)}
                        disabled={deletingNoteId === note.id}
                        title="Delete note"
                        draggable={false}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="pr-20">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {note.title || 'Untitled note'}
                      </h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-700/70">
                        Updated {format(note.updatedAt, 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>

                    <div className="mt-5 max-h-72 overflow-y-auto whitespace-pre-wrap break-words pr-2 text-sm leading-6 text-slate-900/90">
                      {note.content}
                    </div>
                  </article>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {draggedNoteId && dragPosition && (() => {
        const draggedNote = sortedNotes.find((note) => note.id === draggedNoteId)
        if (!draggedNote) return null

        return (
          <article
            className="pointer-events-none fixed z-50 flex min-h-64 cursor-grabbing select-none flex-col rounded-2xl border border-black/10 p-5 shadow-2xl"
            style={{
              top: dragPosition.y,
              left: dragPosition.x,
              width: dragPosition.width,
              minHeight: dragPosition.height,
              backgroundColor: draggedNote.color,
              transform: 'rotate(0deg) scale(1.02)',
            }}
          >
            <div className="absolute right-3 top-3 flex items-center gap-1">
              <div className="h-8 w-8 rounded-md bg-white/55" />
              <div className="h-8 w-8 rounded-md bg-white/55" />
              <div className="h-8 w-8 rounded-md bg-white/55" />
            </div>

            <div className="pr-20">
              <h3 className="text-lg font-semibold text-slate-900">
                {draggedNote.title || 'Untitled note'}
              </h3>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-700/70">
                Updated {format(draggedNote.updatedAt, 'MMM d, yyyy HH:mm')}
              </p>
            </div>

            <div className="mt-5 max-h-72 overflow-hidden whitespace-pre-wrap break-words pr-2 text-sm leading-6 text-slate-900/90">
              {draggedNote.content}
            </div>
          </article>
        )
      })()}

      <NoteModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        note={editingNote}
        isSaving={isSaving}
        onSave={handleSave}
      />

      <AlertDialog
        open={notePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNotePendingDelete(null)
          }
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{notePendingDelete?.title || 'Untitled note'}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (notePendingDelete) {
                  void handleDelete(notePendingDelete.id)
                  setNotePendingDelete(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

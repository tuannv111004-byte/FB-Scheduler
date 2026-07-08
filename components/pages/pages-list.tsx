"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Clock, Plus, MoreHorizontal, Pencil, Trash2, ExternalLink, Power, PowerOff, GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageModal } from './page-modal'
import type { FacebookPage } from '@/lib/types'

const defaultSyncTimeSlots = ['08:00', '15:00', '20:00', '23:00', '02:00']
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

function normalizeTimeSlots(timeSlots: string[]) {
  return [...new Set(timeSlots.filter((slot) => parseTimeSlotMinutes(slot) !== null))].sort(compareTimeSlots)
}

export function PagesList() {
  const { pages, deletePage, togglePageActive, updatePage, initializeApp, isInitialized } = useAppStore()
  const [pageOrderIds, setPageOrderIds] = useState<string[]>([])
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPage, setEditingPage] = useState<FacebookPage | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState<FacebookPage | null>(null)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncTimeSlots, setSyncTimeSlots] = useState<string[]>(defaultSyncTimeSlots)
  const [newSyncTimeSlot, setNewSyncTimeSlot] = useState('')
  const [isSyncingTimeSlots, setIsSyncingTimeSlots] = useState(false)
  const [syncErrorMessage, setSyncErrorMessage] = useState('')

  const handleEdit = (page: FacebookPage) => {
    setEditingPage(page)
    setModalOpen(true)
  }

  const handleDelete = (page: FacebookPage) => {
    setPageToDelete(page)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (pageToDelete) {
      deletePage(pageToDelete.id)
      setDeleteDialogOpen(false)
      setPageToDelete(null)
    }
  }

  const handleAddNew = () => {
    setEditingPage(null)
    setModalOpen(true)
  }

  const handleOpenSyncDialog = () => {
    setSyncTimeSlots(normalizeTimeSlots(pages[0]?.timeSlots.length ? pages[0].timeSlots : defaultSyncTimeSlots))
    setNewSyncTimeSlot('')
    setSyncErrorMessage('')
    setSyncDialogOpen(true)
  }

  const handleAddSyncTimeSlot = () => {
    if (!newSyncTimeSlot) return

    setSyncTimeSlots((current) => normalizeTimeSlots([...current, newSyncTimeSlot]))
    setNewSyncTimeSlot('')
  }

  const handleRemoveSyncTimeSlot = (slot: string) => {
    setSyncTimeSlots((current) => current.filter((item) => item !== slot))
  }

  const handleSyncTimeSlots = async () => {
    const normalizedSlots = normalizeTimeSlots(syncTimeSlots)
    if (normalizedSlots.length === 0) {
      setSyncErrorMessage('Add at least one time slot.')
      return
    }

    setIsSyncingTimeSlots(true)
    setSyncErrorMessage('')

    try {
      for (const page of pages) {
        await updatePage(page.id, { timeSlots: normalizedSlots, postsPerDay: normalizedSlots.length })
      }

      setSyncDialogOpen(false)
    } catch (error) {
      setSyncErrorMessage(error instanceof Error ? error.message : 'Failed to sync time slots.')
    } finally {
      setIsSyncingTimeSlots(false)
    }
  }

  const orderedPages = useMemo(() => {
    const pageById = new Map(pages.map((page) => [page.id, page]))
    const orderedItems = pageOrderIds
      .map((id) => pageById.get(id))
      .filter((page): page is FacebookPage => Boolean(page))
    const unorderedItems = pages.filter((page) => !pageOrderIds.includes(page.id))

    return [...orderedItems, ...unorderedItems]
  }, [pages, pageOrderIds])

  const movePage = (fromPageId: string, toPageId: string) => {
    if (fromPageId === toPageId) return

    setPageOrderIds((current) => {
      const pageIds = orderedPages.map((page) => page.id)
      const nextOrder = pageIds.filter((id) => current.includes(id) || id === fromPageId)
      const fromIndex = nextOrder.indexOf(fromPageId)
      const toIndex = nextOrder.indexOf(toPageId)

      if (fromIndex === -1 || toIndex === -1) return current

      const [movedPageId] = nextOrder.splice(fromIndex, 1)
      nextOrder.splice(toIndex, 0, movedPageId)

      return nextOrder
    })
  }

  const handlePageDragOver = (event: React.DragEvent<HTMLTableRowElement>, targetPageId: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (draggedPageId && draggedPageId !== targetPageId) {
      movePage(draggedPageId, targetPageId)
    }
  }

  useEffect(() => {
    if (!isInitialized) {
      void initializeApp()
    }
  }, [initializeApp, isInitialized])

  useEffect(() => {
    setPageOrderIds((current) => {
      const pageIds = pages.map((page) => page.id)
      const keptPageIds = current.filter((id) => pageIds.includes(id))
      const newPageIds = pageIds.filter((id) => !keptPageIds.includes(id))

      return [...keptPageIds, ...newPageIds]
    })
  }, [pages])

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg font-semibold">Facebook Pages</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleOpenSyncDialog} disabled={pages.length === 0}>
              <Clock className="h-4 w-4 mr-2" />
              Sync Time Slots
            </Button>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Page
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Page Name</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Posts/Day</TableHead>
                <TableHead className="text-muted-foreground">Time Slots</TableHead>
                <TableHead className="text-muted-foreground">Notes</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedPages.map((page) => (
                <TableRow
                  key={page.id}
                  onDragOver={(event) => handlePageDragOver(event, page.id)}
                  onDragEnter={(event) => handlePageDragOver(event, page.id)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDraggedPageId(null)
                  }}
                  className={cn(
                    'border-border transition-[background-color,box-shadow,transform] duration-300 ease-out',
                    draggedPageId === page.id && 'relative z-10 -translate-y-0.5 scale-[1.01] bg-accent/30 shadow-lg ring-1 ring-primary/30'
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          setDraggedPageId(page.id)
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', page.id)
                          const dragImage = document.createElement('canvas')
                          dragImage.width = 1
                          dragImage.height = 1
                          event.dataTransfer.setDragImage(dragImage, 0, 0)
                        }}
                        onDragEnd={() => setDraggedPageId(null)}
                        className="cursor-grab rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
                        title="Drag to reorder pages"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      {page.logoUrl ? (
                        <img
                          src={page.logoUrl}
                          alt=""
                          className="h-10 w-10 rounded-xl border border-border object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-semibold text-white"
                          style={{ backgroundColor: page.brandColor }}
                        >
                          {page.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full',
                          page.isActive ? 'bg-green-400' : 'bg-gray-400'
                        )}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{page.name}</p>
                          <span
                            className="inline-flex h-3 w-3 rounded-full border border-white/30"
                            style={{ backgroundColor: page.brandColor }}
                          />
                        </div>
                        <a
                          href={page.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Page
                        </a>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        page.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      )}
                    >
                      {page.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-foreground">{page.postsPerDay}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {page.timeSlots.slice(0, 3).map((slot) => (
                        <span
                          key={slot}
                          className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {slot}
                        </span>
                      ))}
                      {page.timeSlots.length > 3 && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                          +{page.timeSlots.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-32 truncate text-sm text-muted-foreground">
                    {page.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem onClick={() => handleEdit(page)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePageActive(page.id)}>
                          {page.isActive ? (
                            <>
                              <PowerOff className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          onClick={() => handleDelete(page)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PageModal open={modalOpen} onOpenChange={setModalOpen} page={editingPage} />

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Sync Time Slots</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {syncTimeSlots.map((slot) => (
                <div
                  key={slot}
                  className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-sm"
                >
                  {slot}
                  {isNextDaySlot(slot) ? ' (+1d)' : ''}
                  <button
                    type="button"
                    onClick={() => handleRemoveSyncTimeSlot(slot)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    title={`Remove ${slot}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="time"
                value={newSyncTimeSlot}
                onChange={(event) => setNewSyncTimeSlot(event.target.value)}
                className="w-32"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddSyncTimeSlot}>
                <Plus className="h-4 w-4 mr-1" />
                Add Slot
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {pages.length} pages will use {syncTimeSlots.length} slots per day.
            </p>
            {syncErrorMessage && (
              <p className="text-sm text-destructive">{syncErrorMessage}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSyncDialogOpen(false)}
              disabled={isSyncingTimeSlots}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleSyncTimeSlots()
              }}
              disabled={isSyncingTimeSlots || syncTimeSlots.length === 0}
            >
              {isSyncingTimeSlots ? 'Syncing...' : 'Sync All Pages'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{pageToDelete?.name}&quot;? This will also delete all
              posts associated with this page. This action cannot be undone.
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
    </>
  )
}

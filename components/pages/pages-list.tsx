"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Plus, MoreHorizontal, Pencil, Trash2, ExternalLink, Power, PowerOff, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageModal } from './page-modal'
import type { FacebookPage } from '@/lib/types'

export function PagesList() {
  const { pages, deletePage, togglePageActive, initializeApp, isInitialized } = useAppStore()
  const [pageOrderIds, setPageOrderIds] = useState<string[]>([])
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPage, setEditingPage] = useState<FacebookPage | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState<FacebookPage | null>(null)

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
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Page
          </Button>
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

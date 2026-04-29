"use client"

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Globe, MoreHorizontal, Plus, SearchCheck, Trash2 } from 'lucide-react'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createSourceRemote,
  deleteSourceRemote,
  fetchSourcesRemote,
  isSupabaseConfigured,
  updateSourceRemote,
} from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import type { SourceInput, SourceItem, SourceType } from '@/lib/types'
import { SourceModal } from './source-modal'

const sourceTypeLabels: Record<SourceType, string> = {
  website: 'Website',
  social: 'Social',
  news: 'News',
  community: 'Community',
  tool: 'Tool',
  other: 'Other',
}

export function SourcesManager() {
  const [sources, setSources] = useState<SourceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null)
  const [sourcePendingDelete, setSourcePendingDelete] = useState<SourceItem | null>(null)

  const sourceSummary = useMemo(
    () => ({
      total: sources.length,
      active: sources.filter((item) => item.isActive).length,
    }),
    [sources]
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadSources = async () => {
      try {
        const remoteSources = await fetchSourcesRemote()
        if (!cancelled) {
          setSources(remoteSources)
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Failed to load sources',
            description: error instanceof Error ? error.message : 'Could not load source records.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSources()

    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = () => {
    setEditingSource(null)
    setModalOpen(true)
  }

  const handleEdit = (source: SourceItem) => {
    setEditingSource(source)
    setModalOpen(true)
  }

  const handleSave = async (value: SourceInput) => {
    if (!isSupabaseConfigured) return

    setIsSaving(true)
    try {
      if (editingSource) {
        const updatedSource = await updateSourceRemote(editingSource.id, value)
        setSources((current) =>
          current.map((source) => (source.id === editingSource.id ? updatedSource : source))
        )
        toast({ title: 'Source updated' })
      } else {
        const createdSource = await createSourceRemote(value)
        setSources((current) => [createdSource, ...current])
        toast({ title: 'Source created' })
      }

      setModalOpen(false)
      setEditingSource(null)
    } catch (error) {
      toast({
        title: 'Failed to save source',
        description: error instanceof Error ? error.message : 'Could not save source.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!sourcePendingDelete || !isSupabaseConfigured) return

    try {
      await deleteSourceRemote(sourcePendingDelete.id)
      setSources((current) => current.filter((source) => source.id !== sourcePendingDelete.id))
      toast({ title: 'Source deleted' })
      setSourcePendingDelete(null)
    } catch (error) {
      toast({
        title: 'Failed to delete source',
        description: error instanceof Error ? error.message : 'Could not delete source.',
        variant: 'destructive',
      })
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <Alert className="border-amber-400/50 bg-amber-500/10">
        <SearchCheck className="h-4 w-4" />
        <AlertTitle>Supabase required</AlertTitle>
        <AlertDescription>
          Configure Supabase and run the new schema to store source records.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Sources</CardTitle>
            <p className="text-sm text-muted-foreground">
              Keep a structured list of sources you use to find information and ideas.
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{sourceSummary.total} total</Badge>
            <Badge variant="outline">{sourceSummary.active} active</Badge>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading sources...</div>
          ) : sources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
              <Globe className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-base font-medium text-foreground">No sources yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the first source to start tracking where you research information.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id} className="border-border">
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{source.name}</p>
                          {source.notes ? (
                            <p className="truncate text-xs text-muted-foreground">{source.notes}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sourceTypeLabels[source.type]}</Badge>
                      </TableCell>
                      <TableCell>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="max-w-72 truncate text-sm text-foreground">
                        {source.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.isActive ? 'default' : 'secondary'}>
                          {source.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-border bg-popover">
                            <DropdownMenuItem onClick={() => handleEdit(source)}>
                              Edit Source
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => setSourcePendingDelete(source)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SourceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        source={editingSource}
        isSaving={isSaving}
        onSave={handleSave}
      />

      <AlertDialog open={sourcePendingDelete !== null} onOpenChange={(open) => !open && setSourcePendingDelete(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Source</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{sourcePendingDelete?.name || 'Unknown'}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
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

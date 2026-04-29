"use client"

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Facebook, Mail, MoreHorizontal, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react'
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
import { useAppStore } from '@/lib/store'
import {
  createViaRemote,
  deleteViaRemote,
  fetchViasRemote,
  isSupabaseConfigured,
  updateViaRemote,
} from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import type { ViaAccount, ViaInput } from '@/lib/types'
import { ViaModal } from './via-modal'

function getStatusVariant(status: ViaAccount['status']) {
  switch (status) {
    case 'active':
      return 'default'
    case 'inactive':
      return 'secondary'
    case 'checkpoint':
      return 'destructive'
  }
}

function getStatusLabel(status: ViaAccount['status']) {
  switch (status) {
    case 'active':
      return 'Active'
    case 'inactive':
      return 'Inactive'
    case 'checkpoint':
      return 'Checkpoint'
  }
}

function getLocationLabel(location: ViaAccount['location']) {
  switch (location) {
    case 'personal_laptop':
      return 'Laptop'
    case 'company_computer':
      return 'Company Computer'
  }
}

function maskValue(value: string) {
  if (!value) return '-'
  if (value.length <= 4) return '****'
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`
}

export function ViaManager() {
  const pages = useAppStore((state) => state.pages)
  const [vias, setVias] = useState<ViaAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVia, setEditingVia] = useState<ViaAccount | null>(null)
  const [viaPendingDelete, setViaPendingDelete] = useState<ViaAccount | null>(null)

  const pageNameMap = useMemo(
    () => new Map(pages.map((page) => [page.id, page.name])),
    [pages]
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadVias = async () => {
      try {
        const remoteVias = await fetchViasRemote()
        if (!cancelled) {
          setVias(remoteVias)
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Failed to load vias',
            description: error instanceof Error ? error.message : 'Could not load via accounts.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadVias()

    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = () => {
    setEditingVia(null)
    setModalOpen(true)
  }

  const handleEdit = (via: ViaAccount) => {
    setEditingVia(via)
    setModalOpen(true)
  }

  const handleSave = async (value: ViaInput) => {
    if (!isSupabaseConfigured) return

    setIsSaving(true)
    try {
      if (editingVia) {
        const updatedVia = await updateViaRemote(editingVia.id, value)
        setVias((current) => current.map((via) => (via.id === editingVia.id ? updatedVia : via)))
        toast({ title: 'Via updated' })
      } else {
        const createdVia = await createViaRemote(value)
        setVias((current) => [createdVia, ...current])
        toast({ title: 'Via created' })
      }

      setModalOpen(false)
      setEditingVia(null)
    } catch (error) {
      toast({
        title: 'Failed to save via',
        description: error instanceof Error ? error.message : 'Could not save via account.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!viaPendingDelete || !isSupabaseConfigured) return

    try {
      await deleteViaRemote(viaPendingDelete.id)
      setVias((current) => current.filter((via) => via.id !== viaPendingDelete.id))
      toast({ title: 'Via deleted' })
      setViaPendingDelete(null)
    } catch (error) {
      toast({
        title: 'Failed to delete via',
        description: error instanceof Error ? error.message : 'Could not delete via account.',
        variant: 'destructive',
      })
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <Alert className="border-amber-400/50 bg-amber-500/10">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Supabase required</AlertTitle>
        <AlertDescription>
          Configure Supabase and run the new schema to store Via records and page links.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Via Management</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage via accounts, credentials, and many-to-many page relationships.
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Via
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading vias...</div>
          ) : vias.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
              <UserRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-base font-medium text-foreground">No vias yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the first via to start tracking credentials and page links.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Via</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Outlook</TableHead>
                    <TableHead>Mail Via</TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vias.map((via) => (
                    <TableRow key={via.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {via.avatarUrl ? (
                            <img
                              src={via.avatarUrl}
                              alt=""
                              className="h-10 w-10 rounded-xl border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-xs font-semibold text-foreground">
                              {via.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{via.accountName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              Pass: {maskValue(via.accountPassword)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {via.accountLink ? (
                          <a
                            href={via.accountLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            Open Link
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{via.displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            2FA: {maskValue(via.twoFactorCode)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{via.outlookEmail || '-'}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {via.outlookPassword ? `Pass: ${maskValue(via.outlookPassword)}` : 'No pass'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{via.viaEmail || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {via.pageIds.length === 0 ? (
                            <span className="text-sm text-muted-foreground">No page</span>
                          ) : (
                            via.pageIds.slice(0, 2).map((pageId) => (
                              <Badge key={pageId} variant="outline">
                                <Facebook className="h-3 w-3" />
                                {pageNameMap.get(pageId) ?? 'Unknown'}
                              </Badge>
                            ))
                          )}
                          {via.pageIds.length > 2 && (
                            <Badge variant="secondary">+{via.pageIds.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(via.status)}>{getStatusLabel(via.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{getLocationLabel(via.location)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-border bg-popover">
                            <DropdownMenuItem onClick={() => handleEdit(via)}>
                              <Mail className="mr-2 h-4 w-4" />
                              Edit Via
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => setViaPendingDelete(via)}
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

      <ViaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        via={editingVia}
        pages={pages}
        isSaving={isSaving}
        onSave={handleSave}
      />

      <AlertDialog open={viaPendingDelete !== null} onOpenChange={(open) => !open && setViaPendingDelete(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Via</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{viaPendingDelete?.accountName || 'Unknown'}&quot;? Its `page_vias` links will also be removed.
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

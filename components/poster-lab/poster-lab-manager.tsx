"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  Copy,
  Dices,
  Download,
  Film,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createGenreMap, posterLabSortOptions } from '@/lib/poster-lab'
import {
  createPosterLabFranchiseRemote,
  createPosterLabFranchisesBulkRemote,
  createPosterLabSequelRemote,
  deletePosterLabFranchiseRemote,
  deletePosterLabSequelRemote,
  fetchPosterLabFranchisesRemote,
  fetchPosterLabSequelsRemote,
  isSupabaseConfigured,
  updatePosterLabFranchiseRemote,
  updatePosterLabSequelRemote,
} from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import type {
  PosterLabFranchise,
  PosterLabFranchiseInput,
  PosterLabImportSort,
  PosterLabGenre,
  PosterLabSequel,
  PosterLabSequelInput,
  PosterLabTmdbCandidate,
  PosterLabTmdbGenre,
} from '@/lib/types'
import { FranchiseModal } from './franchise-modal'
import { SequelModal } from './sequel-modal'

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

type TmdbDiscoverForm = {
  genreId: string
  pageCount: string
  maxResults: string
  minVoteCount: string
  sortBy: PosterLabImportSort
}

const defaultDiscoverForm: TmdbDiscoverForm = {
  genreId: 'all',
  pageCount: '3',
  maxResults: '60',
  minVoteCount: '200',
  sortBy: 'popularity.desc',
}

type TmdbDiscoverResponse = {
  candidates?: PosterLabTmdbCandidate[]
  meta?: {
    categoryLabel?: string
  }
  message?: string
}

type TmdbGenresResponse = {
  genres?: PosterLabTmdbGenre[]
  message?: string
}

export function PosterLabManager() {
  const [franchises, setFranchises] = useState<PosterLabFranchise[]>([])
  const [sequels, setSequels] = useState<PosterLabSequel[]>([])
  const [tmdbGenres, setTmdbGenres] = useState<PosterLabTmdbGenre[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingFranchise, setIsSavingFranchise] = useState(false)
  const [isSavingSequel, setIsSavingSequel] = useState(false)
  const [isScanningTmdb, setIsScanningTmdb] = useState(false)
  const [isImportingTmdb, setIsImportingTmdb] = useState(false)
  const [franchiseModalOpen, setFranchiseModalOpen] = useState(false)
  const [sequelModalOpen, setSequelModalOpen] = useState(false)
  const [editingFranchise, setEditingFranchise] = useState<PosterLabFranchise | null>(null)
  const [editingSequel, setEditingSequel] = useState<PosterLabSequel | null>(null)
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string | null>(null)
  const [randomSequelId, setRandomSequelId] = useState<string | null>(null)
  const [franchisePendingDelete, setFranchisePendingDelete] = useState<PosterLabFranchise | null>(null)
  const [sequelPendingDelete, setSequelPendingDelete] = useState<PosterLabSequel | null>(null)
  const [discoverForm, setDiscoverForm] = useState<TmdbDiscoverForm>(defaultDiscoverForm)
  const [discoveredCandidates, setDiscoveredCandidates] = useState<PosterLabTmdbCandidate[]>([])
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([])
  const [scanCategoryLabel, setScanCategoryLabel] = useState('Mixed')
  const [tmdbError, setTmdbError] = useState<string | null>(null)

  const tmdbGenreMap = useMemo(() => createGenreMap(tmdbGenres), [tmdbGenres])

  const importedTmdbMovieIds = useMemo(
    () =>
      new Set(
        franchises
          .map((franchise) => franchise.tmdbMovieId)
          .filter((value): value is number => typeof value === 'number')
      ),
    [franchises]
  )

  const selectedFranchise =
    franchises.find((franchise) => franchise.id === selectedFranchiseId) ?? null

  const selectedFranchiseSequels = useMemo(
    () => sequels.filter((sequel) => sequel.franchiseId === selectedFranchiseId),
    [selectedFranchiseId, sequels]
  )

  const randomSequel = sequels.find((sequel) => sequel.id === randomSequelId) ?? null
  const randomSequelFranchise = franchises.find((franchise) => franchise.id === randomSequel?.franchiseId) ?? null

  const importableCandidates = useMemo(
    () => discoveredCandidates.filter((candidate) => !importedTmdbMovieIds.has(candidate.tmdbMovieId)),
    [discoveredCandidates, importedTmdbMovieIds]
  )

  const selectedImportableCount = useMemo(
    () => selectedCandidateIds.filter((id) => importableCandidates.some((candidate) => candidate.tmdbMovieId === id)).length,
    [importableCandidates, selectedCandidateIds]
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadData = async () => {
      try {
        const [remoteFranchises, remoteSequels, tmdbGenresResponse] = await Promise.all([
          fetchPosterLabFranchisesRemote(),
          fetchPosterLabSequelsRemote(),
          fetch('/api/poster-lab/tmdb/genres', { cache: 'no-store' }),
        ])

        let genres: PosterLabTmdbGenre[] = []
        if (tmdbGenresResponse.ok) {
          const data = (await tmdbGenresResponse.json()) as TmdbGenresResponse
          genres = data.genres ?? []
        } else {
          const data = (await tmdbGenresResponse.json().catch(() => ({ message: 'Failed to load TMDb genres.' }))) as TmdbGenresResponse
          if (!cancelled) {
            setTmdbError(data.message ?? 'Failed to load TMDb genres.')
          }
        }

        if (!cancelled) {
          setFranchises(remoteFranchises)
          setSequels(remoteSequels)
          setTmdbGenres(genres)
          setSelectedFranchiseId(remoteFranchises[0]?.id ?? null)
          setRandomSequelId(remoteSequels[0]?.id ?? null)
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Failed to load Poster Lab',
            description: error instanceof Error ? error.message : 'Could not load poster lab data.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [])

  const handleRandomSequel = () => {
    const pool = sequels.filter((sequel) => !sequel.isUsed)
    const source = pool.length > 0 ? pool : sequels
    if (source.length === 0) return

    const next = source[Math.floor(Math.random() * source.length)]
    setRandomSequelId(next.id)
    setSelectedFranchiseId(next.franchiseId)
  }

  const handleCopyIdea = async (sequel: PosterLabSequel) => {
    const franchise = franchises.find((item) => item.id === sequel.franchiseId)
    const value = [
      franchise?.franchiseName ? `Franchise: ${franchise.franchiseName}` : '',
      franchise?.latestOfficialTitle ? `Latest official movie: ${franchise.latestOfficialTitle}` : '',
      franchise?.sourceCategory ? `Category: ${franchise.sourceCategory}` : '',
      `Fake next movie: ${sequel.fakeTitle}`,
      `Tagline: ${sequel.tagline}`,
      `Synopsis: ${sequel.synopsis}`,
      `Visual hook: ${sequel.visualHook}`,
      sequel.prompt ? `Prompt: ${sequel.prompt}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    try {
      await navigator.clipboard.writeText(value)
      toast({ title: 'Poster idea copied' })
    } catch {
      toast({
        title: 'Failed to copy idea',
        description: 'Clipboard access was blocked by the browser.',
        variant: 'destructive',
      })
    }
  }

  const handleSaveFranchise = async (value: PosterLabFranchiseInput) => {
    setIsSavingFranchise(true)
    try {
      if (editingFranchise) {
        const updated = await updatePosterLabFranchiseRemote(editingFranchise.id, value)
        setFranchises((current) =>
          current.map((item) => (item.id === editingFranchise.id ? updated : item))
        )
      } else {
        const created = await createPosterLabFranchiseRemote(value)
        setFranchises((current) => [created, ...current])
        setSelectedFranchiseId(created.id)
      }

      setFranchiseModalOpen(false)
      setEditingFranchise(null)
    } catch (error) {
      toast({
        title: 'Failed to save franchise',
        description: error instanceof Error ? error.message : 'Could not save franchise.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingFranchise(false)
    }
  }

  const handleSaveSequel = async (value: PosterLabSequelInput) => {
    setIsSavingSequel(true)
    try {
      if (editingSequel) {
        const updated = await updatePosterLabSequelRemote(editingSequel.id, value)
        setSequels((current) => current.map((item) => (item.id === editingSequel.id ? updated : item)))
        setRandomSequelId(updated.id)
      } else {
        const created = await createPosterLabSequelRemote(value)
        setSequels((current) => [created, ...current])
        setRandomSequelId(created.id)
        setSelectedFranchiseId(created.franchiseId)
      }

      setSequelModalOpen(false)
      setEditingSequel(null)
    } catch (error) {
      toast({
        title: 'Failed to save fake sequel',
        description: error instanceof Error ? error.message : 'Could not save sequel.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingSequel(false)
    }
  }

  const handleDeleteFranchise = async () => {
    if (!franchisePendingDelete) return
    try {
      await deletePosterLabFranchiseRemote(franchisePendingDelete.id)
      setFranchises((current) => current.filter((item) => item.id !== franchisePendingDelete.id))
      setSequels((current) => current.filter((item) => item.franchiseId !== franchisePendingDelete.id))
      if (selectedFranchiseId === franchisePendingDelete.id) {
        const next = franchises.find((item) => item.id !== franchisePendingDelete.id)
        setSelectedFranchiseId(next?.id ?? null)
      }
      setFranchisePendingDelete(null)
    } catch (error) {
      toast({
        title: 'Failed to delete franchise',
        description: error instanceof Error ? error.message : 'Could not delete franchise.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteSequel = async () => {
    if (!sequelPendingDelete) return
    try {
      await deletePosterLabSequelRemote(sequelPendingDelete.id)
      setSequels((current) => current.filter((item) => item.id !== sequelPendingDelete.id))
      if (randomSequelId === sequelPendingDelete.id) {
        const next = sequels.find((item) => item.id !== sequelPendingDelete.id)
        setRandomSequelId(next?.id ?? null)
      }
      setSequelPendingDelete(null)
    } catch (error) {
      toast({
        title: 'Failed to delete sequel',
        description: error instanceof Error ? error.message : 'Could not delete sequel.',
        variant: 'destructive',
      })
    }
  }

  const toggleUsed = async (sequel: PosterLabSequel) => {
    try {
      const updated = await updatePosterLabSequelRemote(sequel.id, { isUsed: !sequel.isUsed })
      setSequels((current) => current.map((item) => (item.id === sequel.id ? updated : item)))
    } catch (error) {
      toast({
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'Could not update sequel status.',
        variant: 'destructive',
      })
    }
  }

  const handleScanTmdb = async () => {
    setIsScanningTmdb(true)
    setTmdbError(null)

    const genreId = discoverForm.genreId === 'all' ? undefined : Number(discoverForm.genreId)
    const genreName = genreId ? tmdbGenreMap.get(genreId) : 'Mixed'

    try {
      const response = await fetch('/api/poster-lab/tmdb/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          genreId,
          genreName,
          pageCount: Number(discoverForm.pageCount),
          maxResults: Number(discoverForm.maxResults),
          minVoteCount: Number(discoverForm.minVoteCount),
          sortBy: discoverForm.sortBy,
        }),
      })

      const data = (await response.json()) as TmdbDiscoverResponse
      if (!response.ok) {
        throw new Error(data.message ?? 'Failed to crawl TMDb movies.')
      }

      const candidates = data.candidates ?? []
      setDiscoveredCandidates(candidates)
      setScanCategoryLabel(data.meta?.categoryLabel ?? genreName ?? 'Mixed')
      setSelectedCandidateIds(
        candidates
          .filter((candidate) => !importedTmdbMovieIds.has(candidate.tmdbMovieId))
          .map((candidate) => candidate.tmdbMovieId)
      )
    } catch (error) {
      setTmdbError(error instanceof Error ? error.message : 'Failed to crawl TMDb movies.')
      toast({
        title: 'TMDb crawl failed',
        description: error instanceof Error ? error.message : 'Could not crawl TMDb movies.',
        variant: 'destructive',
      })
    } finally {
      setIsScanningTmdb(false)
    }
  }

  const handleImportTmdbSelection = async () => {
    const selectedCandidates = importableCandidates.filter((candidate) =>
      selectedCandidateIds.includes(candidate.tmdbMovieId)
    )

    if (selectedCandidates.length === 0) {
      toast({
        title: 'Nothing selected',
        description: 'Pick at least one crawled movie to import.',
        variant: 'destructive',
      })
      return
    }

    setIsImportingTmdb(true)
    try {
      const created = await createPosterLabFranchisesBulkRemote(selectedCandidates)
      setFranchises((current) => [...created, ...current])
      if (!selectedFranchiseId && created[0]) {
        setSelectedFranchiseId(created[0].id)
      }

      const createdIds = new Set(created.map((item) => item.tmdbMovieId).filter((value): value is number => typeof value === 'number'))
      setSelectedCandidateIds((current) => current.filter((id) => !createdIds.has(id)))

      toast({
        title: 'TMDb import complete',
        description: `Imported ${created.length} movie${created.length === 1 ? '' : 's'} into Poster Lab.`,
      })
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Could not import TMDb movies.',
        variant: 'destructive',
      })
    } finally {
      setIsImportingTmdb(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <Alert className="border-amber-400/50 bg-amber-500/10">
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Supabase required</AlertTitle>
        <AlertDescription>
          Configure Supabase and run the Poster Lab schema blocks to save franchises and fake sequels.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">TMDb Crawl Import</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pull a large batch of real movie titles by category, then use them as the latest official movie in Poster Lab.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSelectedCandidateIds(importableCandidates.map((candidate) => candidate.tmdbMovieId))} disabled={importableCandidates.length === 0}>
              Select All New
            </Button>
            <Button
              onClick={() => void handleImportTmdbSelection()}
              disabled={isImportingTmdb || selectedImportableCount === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              {isImportingTmdb ? 'Importing...' : `Import Selected (${selectedImportableCount})`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label>Category / Genre</Label>
              <Select
                value={discoverForm.genreId}
                onValueChange={(value) => setDiscoverForm((current) => ({ ...current, genreId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {tmdbGenres.map((genre) => (
                    <SelectItem key={genre.id} value={String(genre.id)}>
                      {genre.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poster-lab-pages">TMDb Pages</Label>
              <Input
                id="poster-lab-pages"
                type="number"
                min={1}
                max={10}
                value={discoverForm.pageCount}
                onChange={(event) =>
                  setDiscoverForm((current) => ({ ...current, pageCount: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poster-lab-max-results">Max Results</Label>
              <Input
                id="poster-lab-max-results"
                type="number"
                min={1}
                max={200}
                value={discoverForm.maxResults}
                onChange={(event) =>
                  setDiscoverForm((current) => ({ ...current, maxResults: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poster-lab-min-votes">Min Votes</Label>
              <Input
                id="poster-lab-min-votes"
                type="number"
                min={0}
                value={discoverForm.minVoteCount}
                onChange={(event) =>
                  setDiscoverForm((current) => ({ ...current, minVoteCount: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select
                value={discoverForm.sortBy}
                onValueChange={(value: PosterLabImportSort) =>
                  setDiscoverForm((current) => ({ ...current, sortBy: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {posterLabSortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void handleScanTmdb()} disabled={isScanningTmdb}>
              <Search className="mr-2 h-4 w-4" />
              {isScanningTmdb ? 'Crawling TMDb...' : 'Crawl TMDb'}
            </Button>
            {discoveredCandidates.length > 0 ? (
              <>
                <Badge variant="outline">{scanCategoryLabel}</Badge>
                <Badge variant="secondary">{discoveredCandidates.length} crawled</Badge>
                <Badge variant="secondary">{importableCandidates.length} new</Badge>
              </>
            ) : null}
          </div>

          {tmdbError ? (
            <Alert className="border-destructive/40 bg-destructive/5">
              <AlertTitle>TMDb import unavailable</AlertTitle>
              <AlertDescription>{tmdbError}</AlertDescription>
            </Alert>
          ) : null}

          {discoveredCandidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-12 text-center">
              <p className="text-base font-medium text-foreground">No TMDb results yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a category and crawl TMDb to preview movies before importing.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12">
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead>Movie</TableHead>
                    <TableHead>Release</TableHead>
                    <TableHead>Genres</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discoveredCandidates.map((candidate) => {
                    const isImported = importedTmdbMovieIds.has(candidate.tmdbMovieId)
                    const isSelected = selectedCandidateIds.includes(candidate.tmdbMovieId)

                    return (
                      <TableRow key={candidate.tmdbMovieId} className="border-border">
                        <TableCell>
                          <Checkbox
                            checked={isImported ? true : isSelected}
                            disabled={isImported}
                            onCheckedChange={(checked) => {
                              setSelectedCandidateIds((current) => {
                                if (!checked) {
                                  return current.filter((id) => id !== candidate.tmdbMovieId)
                                }
                                if (current.includes(candidate.tmdbMovieId)) {
                                  return current
                                }
                                return [...current, candidate.tmdbMovieId]
                              })
                            }}
                          />
                        </TableCell>
                        <TableCell className="min-w-0">
                          <div className="space-y-1">
                            <p className="truncate font-medium text-foreground">{candidate.latestOfficialTitle}</p>
                            {candidate.overview ? (
                              <p className="line-clamp-2 max-w-3xl text-sm text-muted-foreground">
                                {candidate.overview}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">
                          {candidate.releaseDate ? candidate.releaseDate : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-72 flex-wrap gap-1">
                            {(candidate.tmdbGenreNames ?? []).slice(0, 3).map((genreName) => (
                              <Badge key={genreName} variant="outline">
                                {genreName}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">
                          {candidate.sourceCategory || 'Mixed'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isImported ? 'secondary' : 'default'}>
                            {isImported ? 'Imported' : 'Ready'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1.5fr]">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Random Fake Sequel</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pull a random fake next movie from the full sequel library.
              </p>
            </div>
            <Button variant="outline" onClick={handleRandomSequel} disabled={sequels.length === 0}>
              <Dices className="mr-2 h-4 w-4" />
              Random All
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading poster lab...</div>
            ) : randomSequel && randomSequelFranchise ? (
              <div className="rounded-3xl border border-border bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_45%),linear-gradient(135deg,rgba(220,38,38,0.18),rgba(17,24,39,0.3))] p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{genreLabels[randomSequelFranchise.genre]}</Badge>
                  <Badge variant="outline">{randomSequel.releaseYear}</Badge>
                  <Badge variant="outline">
                    {randomSequelFranchise.sourceCategory || 'Manual'}
                  </Badge>
                  <Badge variant={randomSequel.isUsed ? 'secondary' : 'default'}>
                    {randomSequel.isUsed ? 'Used' : 'Fresh'}
                  </Badge>
                </div>

                <p className="mt-5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Based on {randomSequelFranchise.latestOfficialTitle}
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-foreground">{randomSequel.fakeTitle}</h2>
                <p className="mt-4 text-lg italic text-foreground/90">&quot;{randomSequel.tagline}&quot;</p>

                <div className="mt-6 space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Synopsis</p>
                    <p className="mt-2 text-sm leading-6 text-foreground/90">{randomSequel.synopsis}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Visual Hook</p>
                    <p className="mt-2 text-sm leading-6 text-foreground/90">{randomSequel.visualHook}</p>
                  </div>
                  {randomSequel.prompt ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Prompt</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                        {randomSequel.prompt}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => void handleCopyIdea(randomSequel)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Idea
                  </Button>
                  <Button variant="outline" onClick={() => void toggleUsed(randomSequel)}>
                    {randomSequel.isUsed ? 'Mark Unused' : 'Mark Used'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
                <Film className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-base font-medium text-foreground">No fake sequels yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add at least one franchise and one fake sequel to start randomizing.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Franchises</CardTitle>
              <p className="text-sm text-muted-foreground">
                Store the latest real movie title, then attach invented continuations below.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingFranchise(null)
                setFranchiseModalOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Franchise
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading franchises...</div>
            ) : franchises.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
                <p className="text-base font-medium text-foreground">No franchises yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {franchises.map((franchise) => (
                  <button
                    key={franchise.id}
                    type="button"
                    onClick={() => setSelectedFranchiseId(franchise.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      selectedFranchiseId === franchise.id
                        ? 'border-primary bg-primary/8'
                        : 'border-border bg-background hover:bg-accent/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{franchise.franchiseName}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          Latest official: {franchise.latestOfficialTitle}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">{genreLabels[franchise.genre]}</Badge>
                          {franchise.releaseDate ? (
                            <Badge variant="outline">{franchise.releaseDate.slice(0, 4)}</Badge>
                          ) : null}
                          {franchise.sourceCategory ? (
                            <Badge variant="secondary">{franchise.sourceCategory}</Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-border bg-popover">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingFranchise(franchise)
                                setFranchiseModalOpen(true)
                              }}
                            >
                              Edit Franchise
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => setFranchisePendingDelete(franchise)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-border bg-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Fake Sequels</CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedFranchise
                ? `Invented next movies under ${selectedFranchise.franchiseName}.`
                : 'Select a franchise first to manage its fake next movies.'}
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingSequel(null)
              setSequelModalOpen(true)
            }}
            disabled={!selectedFranchise}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Fake Sequel
          </Button>
        </CardHeader>
        <CardContent>
          {!selectedFranchise ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Select a franchise to see and manage its fake next entries.
            </div>
          ) : selectedFranchiseSequels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
              <p className="text-base font-medium text-foreground">No fake sequels yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the first fictional continuation for this franchise.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Fake Title</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Tagline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedFranchiseSequels.map((sequel) => (
                    <TableRow key={sequel.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{sequel.fakeTitle}</TableCell>
                      <TableCell className="text-foreground">{sequel.releaseYear}</TableCell>
                      <TableCell className="max-w-96 truncate text-sm text-foreground">{sequel.tagline}</TableCell>
                      <TableCell>
                        <Badge variant={sequel.isUsed ? 'secondary' : 'default'}>
                          {sequel.isUsed ? 'Used' : 'Fresh'}
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
                            <DropdownMenuItem onClick={() => setRandomSequelId(sequel.id)}>
                              Show In Random Panel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleCopyIdea(sequel)}>
                              Copy Idea
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingSequel(sequel)
                                setSequelModalOpen(true)
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void toggleUsed(sequel)}>
                              {sequel.isUsed ? 'Mark Unused' : 'Mark Used'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => setSequelPendingDelete(sequel)}
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

      <FranchiseModal
        open={franchiseModalOpen}
        onOpenChange={setFranchiseModalOpen}
        franchise={editingFranchise}
        isSaving={isSavingFranchise}
        onSave={handleSaveFranchise}
      />

      <SequelModal
        open={sequelModalOpen}
        onOpenChange={setSequelModalOpen}
        sequel={editingSequel}
        defaultFranchiseId={selectedFranchiseId}
        franchises={franchises}
        isSaving={isSavingSequel}
        onSave={handleSaveSequel}
      />

      <AlertDialog open={franchisePendingDelete !== null} onOpenChange={(open) => !open && setFranchisePendingDelete(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Franchise</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{franchisePendingDelete?.franchiseName || 'Unknown'}&quot;? Its fake sequel records will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteFranchise()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sequelPendingDelete !== null} onOpenChange={(open) => !open && setSequelPendingDelete(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fake Sequel</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{sequelPendingDelete?.fakeTitle || 'Unknown'}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteSequel()
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

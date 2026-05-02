"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  Copy,
  Dices,
  Download,
  ExternalLink,
  Film,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Rows3,
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { createGenreMap, posterLabSortOptions } from '@/lib/poster-lab'
import {
  createPosterLabFranchiseRemote,
  createPosterLabFranchisesBulkRemote,
  createPosterLabSequelRemote,
  createPosterLabSequelsBulkRemote,
  deletePosterLabFranchiseRemote,
  deletePosterLabFranchisesRemote,
  deletePosterLabSequelRemote,
  deletePosterLabSequelsRemote,
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

const defaultChatGptMovieCount = 100
const defaultChatGptSequelsPerMovie = 10

type FranchiseListLayout = 'list' | 'grid' | 'compact'
type SequelBulkDeleteScope = 'selected' | 'all'

type TmdbDiscoverResponse = {
  candidates?: PosterLabTmdbCandidate[]
  meta?: {
    categoryLabel?: string
    scannedPages?: number
    skippedExisting?: number
    skippedSingles?: number
  }
  message?: string
}

type TmdbGenresResponse = {
  genres?: PosterLabTmdbGenre[]
  message?: string
}

type ChatGptSequelPayload = Partial<PosterLabSequelInput>
type PosterLabTab = 'manage' | 'generate' | 'random'
type PosterLabDataCache = {
  franchises: PosterLabFranchise[]
  sequels: PosterLabSequel[]
  tmdbGenres: PosterLabTmdbGenre[]
  cachedAt: string
}
type TmdbCrawlState = {
  isScanning: boolean
  candidates: PosterLabTmdbCandidate[]
  selectedCandidateIds: number[]
  categoryLabel: string
  scannedPages: number
  skippedExisting: number
  skippedSingles: number
  error: string | null
}

const tmdbCrawlStorageKey = 'poster-lab-tmdb-crawl-state'
const randomSequelStorageKey = 'poster-lab-random-sequel-id'
const activeTabStorageKey = 'poster-lab-active-tab'
const posterLabDataCacheKey = 'poster-lab-data-cache'
const defaultTmdbCrawlState: TmdbCrawlState = {
  isScanning: false,
  candidates: [],
  selectedCandidateIds: [],
  categoryLabel: 'Mixed',
  scannedPages: 0,
  skippedExisting: 0,
  skippedSingles: 0,
  error: null,
}
let tmdbCrawlState = defaultTmdbCrawlState
let tmdbCrawlStateHydrated = false
const tmdbCrawlListeners = new Set<(state: TmdbCrawlState) => void>()

function readStoredTmdbCrawlState() {
  if (typeof window === 'undefined') {
    return defaultTmdbCrawlState
  }

  try {
    const stored = window.localStorage.getItem(tmdbCrawlStorageKey)
    if (!stored) {
      return defaultTmdbCrawlState
    }

    const parsed = JSON.parse(stored) as Partial<TmdbCrawlState>
    return {
      ...defaultTmdbCrawlState,
      ...parsed,
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      selectedCandidateIds: Array.isArray(parsed.selectedCandidateIds) ? parsed.selectedCandidateIds : [],
      isScanning: parsed.isScanning === true,
      error: typeof parsed.error === 'string' ? parsed.error : null,
    }
  } catch {
    return defaultTmdbCrawlState
  }
}

function getTmdbCrawlState() {
  if (!tmdbCrawlStateHydrated) {
    tmdbCrawlState = readStoredTmdbCrawlState()
    tmdbCrawlStateHydrated = true
  }

  return tmdbCrawlState
}

function setTmdbCrawlState(patch: Partial<TmdbCrawlState>) {
  tmdbCrawlState = { ...getTmdbCrawlState(), ...patch }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(tmdbCrawlStorageKey, JSON.stringify(tmdbCrawlState))
  }

  tmdbCrawlListeners.forEach((listener) => listener(tmdbCrawlState))
}

function subscribeTmdbCrawlState(listener: (state: TmdbCrawlState) => void) {
  tmdbCrawlListeners.add(listener)
  listener(getTmdbCrawlState())

  return () => {
    tmdbCrawlListeners.delete(listener)
  }
}

function readStoredRandomSequelId() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(randomSequelStorageKey)
}

function readStoredActiveTab(): PosterLabTab {
  if (typeof window === 'undefined') {
    return 'manage'
  }

  const value = window.localStorage.getItem(activeTabStorageKey)
  return value === 'manage' || value === 'generate' || value === 'random' ? value : 'manage'
}

function reviveDate(value: unknown) {
  return typeof value === 'string' || value instanceof Date ? new Date(value) : new Date()
}

function revivePosterLabFranchise(value: PosterLabFranchise): PosterLabFranchise {
  return {
    ...value,
    createdAt: reviveDate(value.createdAt),
    updatedAt: reviveDate(value.updatedAt),
  }
}

function revivePosterLabSequel(value: PosterLabSequel): PosterLabSequel {
  return {
    ...value,
    createdAt: reviveDate(value.createdAt),
    updatedAt: reviveDate(value.updatedAt),
  }
}

function readStoredPosterLabDataCache() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = window.localStorage.getItem(posterLabDataCacheKey)
    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored) as Partial<PosterLabDataCache>
    return {
      franchises: Array.isArray(parsed.franchises)
        ? parsed.franchises.map((item) => revivePosterLabFranchise(item))
        : [],
      sequels: Array.isArray(parsed.sequels)
        ? parsed.sequels.map((item) => revivePosterLabSequel(item))
        : [],
      tmdbGenres: Array.isArray(parsed.tmdbGenres) ? parsed.tmdbGenres : [],
      cachedAt: typeof parsed.cachedAt === 'string' ? parsed.cachedAt : new Date().toISOString(),
    } satisfies PosterLabDataCache
  } catch {
    return null
  }
}

function writePosterLabDataCache(input: Omit<PosterLabDataCache, 'cachedAt'>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      posterLabDataCacheKey,
      JSON.stringify({
        ...input,
        cachedAt: new Date().toISOString(),
      } satisfies PosterLabDataCache)
    )
  } catch {
    // Local cache is best-effort; Supabase remains the source of truth.
  }
}

function shuffleItems<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function extractJsonObject(value: string) {
  const trimmed = value.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not find a JSON object in the pasted result.')
  }

  return withoutFence.slice(start, end + 1)
}

function buildChatGptPrompt(franchises: PosterLabFranchise[], sequelsPerMovie: number) {
  return [
    'You create fictional next-movie sequel titles.',
    'Return valid JSON only. No markdown, no commentary.',
    'Use movie titles as JSON keys and sequel titles as values.',
    sequelsPerMovie === 1
      ? 'Schema: {"Movie Title":"Sequel Title"}'
      : 'Schema: {"Movie Title":["Sequel Title 1","Sequel Title 2"]}',
    '',
    'Rules:',
    '- Use only the provided movie title as the input.',
    `- Create exactly ${sequelsPerMovie} fictional next sequel title${sequelsPerMovie === 1 ? '' : 's'} for each movie.`,
    '- The sequel must be a direct next installment, not a remake, reboot, spin-off, prequel, or unrelated title.',
    '- Keep continuity with the original cinematic universe.',
    '- Do not use real official sequel titles.',
    '- Make the title sound like a real Hollywood sequel.',
    '- Use Roman numerals or subtitles only when they fit the franchise style.',
    '',
    'Movies:',
    JSON.stringify(
      franchises.map((franchise) => franchise.franchiseName),
      null,
      2
    ),
  ].join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeMovieKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function createTitleOnlySequelInput(franchise: PosterLabFranchise, fakeTitle: string): PosterLabSequelInput {
  return {
    franchiseId: franchise.id,
    fakeTitle: fakeTitle.trim(),
    releaseYear: 2026,
    tagline: 'A new chapter begins.',
    synopsis: `A fictional next installment for ${franchise.franchiseName}.`,
    visualHook: `A cinematic poster concept for ${fakeTitle.trim()}.`,
    prompt: '',
    caption: '',
    isUsed: false,
  }
}

function titleValueToList(value: unknown) {
  if (typeof value === 'string') {
    return [value.trim()].filter(Boolean)
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  }

  return []
}

function parseTitleOnlySequelInputs(parsed: unknown, franchises: PosterLabFranchise[]) {
  if (!isRecord(parsed)) {
    return [] as PosterLabSequelInput[]
  }

  const franchiseMap = new Map<string, PosterLabFranchise>()
  franchises.forEach((franchise) => {
    franchiseMap.set(normalizeMovieKey(franchise.franchiseName), franchise)
    franchiseMap.set(normalizeMovieKey(franchise.latestOfficialTitle), franchise)
  })

  const inputs: PosterLabSequelInput[] = []
  Object.entries(parsed).forEach(([movieTitle, sequelValue]) => {
    if (movieTitle === 'sequels' || movieTitle === 'movies') {
      return
    }

    const franchise = franchiseMap.get(normalizeMovieKey(movieTitle))
    if (!franchise) {
      return
    }

    titleValueToList(sequelValue).forEach((fakeTitle) => {
      inputs.push(createTitleOnlySequelInput(franchise, fakeTitle))
    })
  })

  return inputs
}

function normalizeImportedSequel(input: ChatGptSequelPayload): PosterLabSequelInput | null {
  if (!input.franchiseId || !input.fakeTitle) {
    return null
  }

  return {
    franchiseId: input.franchiseId,
    fakeTitle: input.fakeTitle.trim(),
    releaseYear: Math.min(Math.max(Number(input.releaseYear) || new Date().getFullYear() + 1, 1900), 3000),
    tagline: input.tagline?.trim() || 'A new chapter begins.',
    synopsis: input.synopsis?.trim() || 'A fictional continuation built for poster ideation.',
    visualHook: input.visualHook?.trim() || 'A cinematic poster composition centered on the returning franchise identity.',
    prompt: input.prompt?.trim() || '',
    caption: input.caption?.trim() || '',
    isUsed: false,
  }
}

export function PosterLabManager() {
  const initialTmdbCrawlState = getTmdbCrawlState()
  const initialDataCache = readStoredPosterLabDataCache()
  const initialStoredRandomSequelId = readStoredRandomSequelId()
  const initialRandomSequel =
    initialDataCache?.sequels.find((sequel) => sequel.id === initialStoredRandomSequelId) ??
    initialDataCache?.sequels[0] ??
    null
  const [activeTab, setActiveTab] = useState<PosterLabTab>(() => readStoredActiveTab())
  const [franchises, setFranchises] = useState<PosterLabFranchise[]>(initialDataCache?.franchises ?? [])
  const [sequels, setSequels] = useState<PosterLabSequel[]>(initialDataCache?.sequels ?? [])
  const [tmdbGenres, setTmdbGenres] = useState<PosterLabTmdbGenre[]>(initialDataCache?.tmdbGenres ?? [])
  const [isLoading, setIsLoading] = useState(!initialDataCache)
  const [isSavingFranchise, setIsSavingFranchise] = useState(false)
  const [isSavingSequel, setIsSavingSequel] = useState(false)
  const [isScanningTmdb, setIsScanningTmdb] = useState(initialTmdbCrawlState.isScanning)
  const [isImportingTmdb, setIsImportingTmdb] = useState(false)
  const [franchiseModalOpen, setFranchiseModalOpen] = useState(false)
  const [sequelModalOpen, setSequelModalOpen] = useState(false)
  const [editingFranchise, setEditingFranchise] = useState<PosterLabFranchise | null>(null)
  const [editingSequel, setEditingSequel] = useState<PosterLabSequel | null>(null)
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string | null>(
    initialRandomSequel?.franchiseId ?? initialDataCache?.franchises[0]?.id ?? null
  )
  const [randomSequelId, setRandomSequelId] = useState<string | null>(initialRandomSequel?.id ?? null)
  const [franchisePendingDelete, setFranchisePendingDelete] = useState<PosterLabFranchise | null>(null)
  const [franchisesResetPending, setFranchisesResetPending] = useState(false)
  const [sequelPendingDelete, setSequelPendingDelete] = useState<PosterLabSequel | null>(null)
  const [sequelBulkDeleteScope, setSequelBulkDeleteScope] = useState<SequelBulkDeleteScope | null>(null)
  const [discoverForm, setDiscoverForm] = useState<TmdbDiscoverForm>(defaultDiscoverForm)
  const [discoveredCandidates, setDiscoveredCandidates] = useState<PosterLabTmdbCandidate[]>(
    initialTmdbCrawlState.candidates
  )
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>(
    initialTmdbCrawlState.selectedCandidateIds
  )
  const [scanCategoryLabel, setScanCategoryLabel] = useState(initialTmdbCrawlState.categoryLabel)
  const [scannedPageCount, setScannedPageCount] = useState(initialTmdbCrawlState.scannedPages)
  const [skippedExistingCount, setSkippedExistingCount] = useState(initialTmdbCrawlState.skippedExisting)
  const [skippedSingleCount, setSkippedSingleCount] = useState(initialTmdbCrawlState.skippedSingles)
  const [showImportedCandidates, setShowImportedCandidates] = useState(false)
  const [includeStandaloneMovies, setIncludeStandaloneMovies] = useState(true)
  const [franchiseSearchQuery, setFranchiseSearchQuery] = useState('')
  const [franchiseGenreFilter, setFranchiseGenreFilter] = useState<'all' | PosterLabGenre>('all')
  const [franchiseSourceFilter, setFranchiseSourceFilter] = useState('all')
  const [franchisePage, setFranchisePage] = useState(1)
  const [franchiseListLayout, setFranchiseListLayout] = useState<FranchiseListLayout>('list')
  const [chatGptMovieCount, setChatGptMovieCount] = useState(String(defaultChatGptMovieCount))
  const [chatGptSequelsPerMovie, setChatGptSequelsPerMovie] = useState(String(defaultChatGptSequelsPerMovie))
  const [chatGptSelectedFranchises, setChatGptSelectedFranchises] = useState<PosterLabFranchise[]>([])
  const [chatGptPrompt, setChatGptPrompt] = useState('')
  const [chatGptResultJson, setChatGptResultJson] = useState('')
  const [isImportingChatGptResult, setIsImportingChatGptResult] = useState(false)
  const [tmdbError, setTmdbError] = useState<string | null>(initialTmdbCrawlState.error)

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
  const randomFranchiseSequels = useMemo(
    () => sequels.filter((sequel) => sequel.franchiseId === randomSequelFranchise?.id),
    [randomSequelFranchise?.id, sequels]
  )

  const importableCandidates = useMemo(
    () => discoveredCandidates.filter((candidate) => !importedTmdbMovieIds.has(candidate.tmdbMovieId)),
    [discoveredCandidates, importedTmdbMovieIds]
  )

  const selectedImportableCount = useMemo(
    () => selectedCandidateIds.filter((id) => importableCandidates.some((candidate) => candidate.tmdbMovieId === id)).length,
    [importableCandidates, selectedCandidateIds]
  )

  const visibleCandidates = useMemo(
    () => (showImportedCandidates ? discoveredCandidates : importableCandidates),
    [discoveredCandidates, importableCandidates, showImportedCandidates]
  )
  const hasTmdbCrawlResults =
    discoveredCandidates.length > 0 ||
    selectedCandidateIds.length > 0 ||
    scannedPageCount > 0 ||
    skippedExistingCount > 0 ||
    skippedSingleCount > 0 ||
    tmdbError !== null

  const updateSelectedCandidateIds = (value: number[] | ((current: number[]) => number[])) => {
    const current = getTmdbCrawlState().selectedCandidateIds
    const next = typeof value === 'function' ? value(current) : value
    setTmdbCrawlState({ selectedCandidateIds: next })
  }

  const handleResetTmdbCrawl = () => {
    setTmdbCrawlState(defaultTmdbCrawlState)
    toast({
      title: 'TMDb crawl reset',
      description: 'Cleared the current crawl preview and selection.',
    })
  }

  useEffect(() => {
    return subscribeTmdbCrawlState((state) => {
      setIsScanningTmdb(state.isScanning)
      setDiscoveredCandidates(state.candidates)
      setSelectedCandidateIds(state.selectedCandidateIds)
      setScanCategoryLabel(state.categoryLabel)
      setScannedPageCount(state.scannedPages)
      setSkippedExistingCount(state.skippedExisting)
      setSkippedSingleCount(state.skippedSingles)
      setTmdbError(state.error)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(activeTabStorageKey, activeTab)
  }, [activeTab])

  const franchiseSequelCounts = useMemo(() => {
    const counts = new Map<string, number>()
    sequels.forEach((sequel) => {
      counts.set(sequel.franchiseId, (counts.get(sequel.franchiseId) ?? 0) + 1)
    })
    return counts
  }, [sequels])

  const franchiseSourceOptions = useMemo(() => {
    const sources = new Set<string>()
    franchises.forEach((franchise) => {
      if (franchise.sourceCategory) {
        sources.add(franchise.sourceCategory)
      }
    })
    return Array.from(sources).sort((a, b) => a.localeCompare(b))
  }, [franchises])

  const filteredFranchises = useMemo(() => {
    const query = franchiseSearchQuery.trim().toLowerCase()

    return franchises.filter((franchise) => {
      const matchesQuery =
        query.length === 0 ||
        franchise.franchiseName.toLowerCase().includes(query) ||
        franchise.latestOfficialTitle.toLowerCase().includes(query) ||
        franchise.notes.toLowerCase().includes(query) ||
        franchise.overview?.toLowerCase().includes(query)

      const matchesGenre =
        franchiseGenreFilter === 'all' || franchise.genre === franchiseGenreFilter

      const sourceValue = franchise.sourceCategory || 'Manual'
      const matchesSource =
        franchiseSourceFilter === 'all' || sourceValue === franchiseSourceFilter

      return matchesQuery && matchesGenre && matchesSource
    })
  }, [franchiseGenreFilter, franchiseSearchQuery, franchiseSourceFilter, franchises])

  const tmdbFranchiseCount = useMemo(
    () => franchises.filter((franchise) => typeof franchise.tmdbMovieId === 'number').length,
    [franchises]
  )
  const manualFranchiseCount = franchises.length - tmdbFranchiseCount
  const usedSequelCount = useMemo(
    () => sequels.filter((sequel) => sequel.isUsed).length,
    [sequels]
  )
  const unusedSequelCount = sequels.length - usedSequelCount
  const franchisesWithSequelsCount = useMemo(
    () => franchises.filter((franchise) => (franchiseSequelCounts.get(franchise.id) ?? 0) > 0).length,
    [franchiseSequelCounts, franchises]
  )

  const franchisePageSize =
    franchiseListLayout === 'grid' ? 12 : franchiseListLayout === 'compact' ? 16 : 8
  const franchisePageCount = Math.max(1, Math.ceil(filteredFranchises.length / franchisePageSize))
  const visibleFranchises = useMemo(() => {
    const start = (franchisePage - 1) * franchisePageSize
    return filteredFranchises.slice(start, start + franchisePageSize)
  }, [filteredFranchises, franchisePage, franchisePageSize])

  useEffect(() => {
    setFranchisePage(1)
  }, [franchiseGenreFilter, franchiseSearchQuery, franchiseSourceFilter])

  useEffect(() => {
    setFranchisePage((current) => Math.min(current, franchisePageCount))
  }, [franchisePageCount])

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

        let genres: PosterLabTmdbGenre[] = initialDataCache?.tmdbGenres ?? []
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
          const storedRandomSequelId = readStoredRandomSequelId()
          const restoredRandomSequel =
            remoteSequels.find((sequel) => sequel.id === storedRandomSequelId) ?? remoteSequels[0] ?? null

          setFranchises(remoteFranchises)
          setSequels(remoteSequels)
          setTmdbGenres(genres)
          setSelectedFranchiseId(restoredRandomSequel?.franchiseId ?? remoteFranchises[0]?.id ?? null)
          setRandomSequelId(restoredRandomSequel?.id ?? null)
          writePosterLabDataCache({
            franchises: remoteFranchises,
            sequels: remoteSequels,
            tmdbGenres: genres,
          })
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

  useEffect(() => {
    if (!isSupabaseConfigured || isLoading) {
      return
    }

    writePosterLabDataCache({
      franchises,
      sequels,
      tmdbGenres,
    })
  }, [franchises, isLoading, sequels, tmdbGenres])

  useEffect(() => {
    if (isLoading || typeof window === 'undefined') {
      return
    }

    if (randomSequelId) {
      window.localStorage.setItem(randomSequelStorageKey, randomSequelId)
      return
    }

    window.localStorage.removeItem(randomSequelStorageKey)
  }, [isLoading, randomSequelId])

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
      sequel.caption ? `Caption: ${sequel.caption}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    try {
      await navigator.clipboard.writeText(value)
      if (!sequel.isUsed) {
        const updated = await updatePosterLabSequelRemote(sequel.id, { isUsed: true })
        setSequels((current) => current.map((item) => (item.id === sequel.id ? updated : item)))
      }
      toast({ title: 'Poster idea copied', description: 'Marked as used.' })
    } catch {
      toast({
        title: 'Failed to copy idea',
        description: 'Clipboard access was blocked by the browser, or the used status could not be updated.',
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

  const handleResetFranchises = async () => {
    try {
      await deletePosterLabFranchisesRemote()
      setFranchises([])
      setSequels([])
      setSelectedFranchiseId(null)
      setRandomSequelId(null)
      updateSelectedCandidateIds([])
      setFranchisesResetPending(false)
      toast({
        title: 'Movies reset',
        description: 'All Poster Lab movies and attached fake sequels were deleted.',
      })
    } catch (error) {
      toast({
        title: 'Failed to reset movies',
        description: error instanceof Error ? error.message : 'Could not reset Poster Lab movies.',
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

  const handleDeleteSequelsBulk = async () => {
    if (!sequelBulkDeleteScope) return

    const deleteSelectedOnly = sequelBulkDeleteScope === 'selected'
    if (deleteSelectedOnly && !selectedFranchiseId) return

    try {
      const deletedIds = new Set(
        sequels
          .filter((sequel) => !deleteSelectedOnly || sequel.franchiseId === selectedFranchiseId)
          .map((sequel) => sequel.id)
      )

      await deletePosterLabSequelsRemote(deleteSelectedOnly ? selectedFranchiseId ?? undefined : undefined)

      setSequels((current) =>
        deleteSelectedOnly ? current.filter((item) => item.franchiseId !== selectedFranchiseId) : []
      )
      if (randomSequelId && deletedIds.has(randomSequelId)) {
        const next = sequels.find((item) => !deletedIds.has(item.id))
        setRandomSequelId(next?.id ?? null)
      }
      setSequelBulkDeleteScope(null)
      toast({
        title: deleteSelectedOnly ? 'Movie sequels deleted' : 'All sequels deleted',
        description: deleteSelectedOnly
          ? 'You can now generate fresh sequels for the selected movie.'
          : 'Poster Lab is ready for a fresh sequel import.',
      })
    } catch (error) {
      toast({
        title: 'Failed to delete sequels',
        description: error instanceof Error ? error.message : 'Could not delete sequels.',
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
    if (getTmdbCrawlState().isScanning) {
      return
    }

    setTmdbCrawlState({
      isScanning: true,
      error: null,
    })

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
          existingTmdbMovieIds: Array.from(importedTmdbMovieIds),
          includeExisting: showImportedCandidates,
          includeStandalone: includeStandaloneMovies,
        }),
      })

      const data = (await response.json()) as TmdbDiscoverResponse
      if (!response.ok) {
        throw new Error(data.message ?? 'Failed to crawl TMDb movies.')
      }

      const candidates = data.candidates ?? []
      const nextSelectedCandidateIds = candidates
          .filter((candidate) => !importedTmdbMovieIds.has(candidate.tmdbMovieId))
          .map((candidate) => candidate.tmdbMovieId)

      setTmdbCrawlState({
        isScanning: false,
        candidates,
        categoryLabel: data.meta?.categoryLabel ?? genreName ?? 'Mixed',
        scannedPages: data.meta?.scannedPages ?? 0,
        skippedExisting: data.meta?.skippedExisting ?? 0,
        skippedSingles: data.meta?.skippedSingles ?? 0,
        selectedCandidateIds: nextSelectedCandidateIds,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to crawl TMDb movies.'
      setTmdbCrawlState({
        isScanning: false,
        error: message,
      })
      toast({
        title: 'TMDb crawl failed',
        description: error instanceof Error ? error.message : 'Could not crawl TMDb movies.',
        variant: 'destructive',
      })
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
      updateSelectedCandidateIds((current) => current.filter((id) => !createdIds.has(id)))

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

  const handleGenerateChatGptPrompt = async (openChatGpt = false) => {
    const movieCount = Math.min(Math.max(Number(chatGptMovieCount) || defaultChatGptMovieCount, 1), 100)
    const sequelCount = Math.min(Math.max(Number(chatGptSequelsPerMovie) || defaultChatGptSequelsPerMovie, 1), 10)
    const selected = shuffleItems(franchises).slice(0, movieCount)

    if (selected.length === 0) {
      toast({
        title: 'No franchises available',
        description: 'Import or add movies before generating a ChatGPT prompt.',
        variant: 'destructive',
      })
      return
    }

    const prompt = buildChatGptPrompt(selected, sequelCount)
    setChatGptSelectedFranchises(selected)
    setChatGptPrompt(prompt)
    setChatGptMovieCount(String(movieCount))
    setChatGptSequelsPerMovie(String(sequelCount))

    try {
      await navigator.clipboard.writeText(prompt)
      toast({
        title: 'ChatGPT prompt copied',
        description: `${selected.length} movies x ${sequelCount} sequels are ready to paste.`,
      })
    } catch {
      toast({
        title: 'Prompt generated',
        description: 'Clipboard access was blocked, but the prompt is visible below.',
      })
    }

    if (openChatGpt) {
      window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')
    }
  }

  const handleCopyChatGptPrompt = async () => {
    if (!chatGptPrompt) {
      await handleGenerateChatGptPrompt(false)
      return
    }

    try {
      await navigator.clipboard.writeText(chatGptPrompt)
      toast({ title: 'ChatGPT prompt copied' })
    } catch {
      toast({
        title: 'Failed to copy prompt',
        description: 'Clipboard access was blocked by the browser.',
        variant: 'destructive',
      })
    }
  }

  const handleImportChatGptResult = async () => {
    if (!chatGptResultJson.trim()) {
      toast({
        title: 'No JSON pasted',
        description: 'Paste the JSON response from ChatGPT first.',
        variant: 'destructive',
      })
      return
    }

    setIsImportingChatGptResult(true)
    try {
      const parsed = JSON.parse(extractJsonObject(chatGptResultJson)) as { sequels?: ChatGptSequelPayload[] }
      const validFranchiseIds = new Set(franchises.map((franchise) => franchise.id))
      const sequelPayloads = Array.isArray(parsed.sequels) ? parsed.sequels : []
      const fullInputs = sequelPayloads
        .map(normalizeImportedSequel)
        .filter((item): item is PosterLabSequelInput => item !== null && validFranchiseIds.has(item.franchiseId))
      const titleOnlyInputs = parseTitleOnlySequelInputs(parsed, franchises)
      const inputs = fullInputs.length > 0 ? fullInputs : titleOnlyInputs

      if (inputs.length === 0) {
        throw new Error('No valid sequel records were found in the pasted JSON.')
      }

      const created = await createPosterLabSequelsBulkRemote(inputs)
      setSequels((current) => [...created, ...current])
      setRandomSequelId(created[0]?.id ?? randomSequelId)
      setSelectedFranchiseId(created[0]?.franchiseId ?? selectedFranchiseId)
      setChatGptResultJson('')

      toast({
        title: 'ChatGPT sequels imported',
        description: `Imported ${created.length} fake sequel${created.length === 1 ? '' : 's'}.`,
      })
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Could not import the pasted JSON.',
        variant: 'destructive',
      })
    } finally {
      setIsImportingChatGptResult(false)
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
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PosterLabTab)}
        className="space-y-6"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="random">Random</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">TMDb Movie Import</CardTitle>
            <p className="text-sm text-muted-foreground">
              Crawl real TMDb movies by category. Franchise entries use the latest released part; standalone movies can become sequel seeds too.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => updateSelectedCandidateIds(importableCandidates.map((candidate) => candidate.tmdbMovieId))} disabled={importableCandidates.length === 0}>
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
                max={500}
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
                max={10000}
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
            {hasTmdbCrawlResults ? (
              <Button
                variant="outline"
                onClick={handleResetTmdbCrawl}
                disabled={isScanningTmdb || isImportingTmdb}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Crawl
              </Button>
            ) : null}
            {discoveredCandidates.length > 0 ? (
              <>
                <Badge variant="outline">{scanCategoryLabel}</Badge>
                <Badge variant="secondary">{discoveredCandidates.length} crawled</Badge>
                <Badge variant="secondary">{importableCandidates.length} new</Badge>
                {scannedPageCount > 0 ? (
                  <Badge variant="outline">{scannedPageCount} pages scanned</Badge>
                ) : null}
                {skippedExistingCount > 0 && !showImportedCandidates ? (
                  <Badge variant="outline">{skippedExistingCount} imported skipped</Badge>
                ) : null}
                {skippedSingleCount > 0 ? (
                  <Badge variant="outline">{skippedSingleCount} standalone skipped</Badge>
                ) : null}
              </>
            ) : null}
            <div className="ml-auto flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Switch
                id="poster-lab-include-standalone"
                checked={includeStandaloneMovies}
                onCheckedChange={setIncludeStandaloneMovies}
              />
              <Label htmlFor="poster-lab-include-standalone" className="text-sm">
                Include Standalone
              </Label>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Switch
                id="poster-lab-show-imported"
                checked={showImportedCandidates}
                onCheckedChange={setShowImportedCandidates}
              />
              <Label htmlFor="poster-lab-show-imported" className="text-sm">
                Show Imported
              </Label>
            </div>
          </div>

          {tmdbError ? (
            <Alert className="border-destructive/40 bg-destructive/5">
              <AlertTitle>TMDb import unavailable</AlertTitle>
              <AlertDescription>{tmdbError}</AlertDescription>
            </Alert>
          ) : null}

          {visibleCandidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-12 text-center">
              <p className="text-base font-medium text-foreground">
                {discoveredCandidates.length === 0 ? 'No TMDb movies yet' : 'No new movies in this crawl'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {discoveredCandidates.length === 0
                  ? 'Choose a category and crawl TMDb to preview movie seeds before importing.'
                  : 'Imported movies are hidden. Turn on Show Imported to review them.'}
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
                  {visibleCandidates.map((candidate) => {
                    const isImported = importedTmdbMovieIds.has(candidate.tmdbMovieId)
                    const isSelected = selectedCandidateIds.includes(candidate.tmdbMovieId)

                    return (
                      <TableRow key={candidate.tmdbMovieId} className="border-border">
                        <TableCell>
                          <Checkbox
                            checked={isImported ? true : isSelected}
                            disabled={isImported}
                            onCheckedChange={(checked) => {
                              updateSelectedCandidateIds((current) => {
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

      <Card className="mt-6 border-border bg-card">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">ChatGPT Web Batch</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pick random movies, copy a structured prompt to ChatGPT, then paste the JSON result back here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void handleCopyChatGptPrompt()} disabled={franchises.length === 0}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Prompt
            </Button>
            <Button onClick={() => void handleGenerateChatGptPrompt(true)} disabled={franchises.length === 0}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Generate & Open ChatGPT
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[180px_180px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="chatgpt-movie-count">Random Movies</Label>
              <Input
                id="chatgpt-movie-count"
                type="number"
                min={1}
                max={100}
                value={chatGptMovieCount}
                onChange={(event) => setChatGptMovieCount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatgpt-sequels-count">Sequels / Movie</Label>
              <Input
                id="chatgpt-sequels-count"
                type="number"
                min={1}
                max={10}
                value={chatGptSequelsPerMovie}
                onChange={(event) => setChatGptSequelsPerMovie(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleGenerateChatGptPrompt(false)}
                disabled={franchises.length === 0}
              >
                Generate Random Prompt
              </Button>
            </div>
          </div>

          {chatGptSelectedFranchises.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{chatGptSelectedFranchises.length} movies selected</Badge>
              <Badge variant="secondary">
                {Number(chatGptSequelsPerMovie) || defaultChatGptSequelsPerMovie} sequels each
              </Badge>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chatgpt-prompt">Prompt for ChatGPT</Label>
              <Textarea
                id="chatgpt-prompt"
                value={chatGptPrompt}
                onChange={(event) => setChatGptPrompt(event.target.value)}
                placeholder="Generate a random prompt first, then paste it into ChatGPT web."
                className="h-72 max-h-72 min-h-72 resize-none overflow-y-auto font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatgpt-result">Paste JSON Result</Label>
              <Textarea
                id="chatgpt-result"
                value={chatGptResultJson}
                onChange={(event) => setChatGptResultJson(event.target.value)}
                placeholder='Paste ChatGPT JSON here, for example: {"sequels":[{"franchiseId":"...","fakeTitle":"...","caption":"..."}]}'
                className="h-72 max-h-72 min-h-72 resize-none overflow-y-auto font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open ChatGPT
            </Button>
            <Button
              type="button"
              onClick={() => void handleImportChatGptResult()}
              disabled={isImportingChatGptResult || chatGptResultJson.trim().length === 0}
            >
              {isImportingChatGptResult ? 'Importing...' : 'Import JSON Sequels'}
            </Button>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="random" className="space-y-6">
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
              <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.1fr)]">
                <div className="h-full rounded-2xl border border-border bg-secondary/20 p-4">
                  <div className="grid gap-4 sm:grid-cols-[112px_1fr] xl:grid-cols-1 2xl:grid-cols-[112px_1fr]">
                    <div className="overflow-hidden rounded-lg border border-border bg-secondary/40">
                      {randomSequelFranchise.posterPath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w342${randomSequelFranchise.posterPath}`}
                          alt=""
                          className="aspect-[2/3] w-full object-cover xl:max-w-36 2xl:max-w-none"
                        />
                      ) : (
                        <div className="flex aspect-[2/3] w-full items-center justify-center xl:max-w-36 2xl:max-w-none">
                          <Film className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Original Movie
                          </p>
                          <h3 className="mt-1 text-xl font-semibold text-foreground">
                            {randomSequelFranchise.franchiseName}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Latest official: {randomSequelFranchise.latestOfficialTitle}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{genreLabels[randomSequelFranchise.genre]}</Badge>
                          {randomSequelFranchise.releaseDate ? (
                            <Badge variant="outline">{randomSequelFranchise.releaseDate}</Badge>
                          ) : null}
                          <Badge variant={randomSequelFranchise.tmdbMovieId ? 'secondary' : 'outline'}>
                            {randomSequelFranchise.sourceCategory || 'Manual'}
                          </Badge>
                        </div>
                      </div>

                      {randomSequelFranchise.overview ? (
                        <p className="text-sm leading-6 text-foreground/90">
                          {randomSequelFranchise.overview}
                        </p>
                      ) : null}

                      {randomSequelFranchise.tmdbGenreNames?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {randomSequelFranchise.tmdbGenreNames.map((genreName) => (
                            <Badge key={genreName} variant="outline">
                              {genreName}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {randomFranchiseSequels.length > 1 ? (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Other sequels
                      </p>
                      <div className="mt-3 grid gap-2">
                        {randomFranchiseSequels
                          .filter((sequel) => sequel.id !== randomSequel.id)
                          .map((sequel) => (
                            <div key={sequel.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{sequel.fakeTitle}</p>
                                <p className="text-xs text-muted-foreground">{sequel.releaseYear}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={sequel.isUsed ? 'secondary' : 'default'}>
                                  {sequel.isUsed ? 'Used' : 'Fresh'}
                                </Badge>
                                <Button size="sm" variant="outline" onClick={() => void handleCopyIdea(sequel)}>
                                  Copy
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="h-full">
                  <div className="flex h-full flex-col rounded-3xl border border-border bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_45%),linear-gradient(135deg,rgba(220,38,38,0.18),rgba(17,24,39,0.3))] p-6">
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
                      {randomSequel.caption ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Caption</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                            {randomSequel.caption}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 pt-6">
                      <Button onClick={() => void handleCopyIdea(randomSequel)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Idea
                      </Button>
                      <Button variant="outline" onClick={() => void toggleUsed(randomSequel)}>
                        {randomSequel.isUsed ? 'Mark Unused' : 'Mark Used'}
                      </Button>
                    </div>
                  </div>
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

        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Franchises</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage imported and manual real movie entries before attaching fake continuations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSequelBulkDeleteScope('all')}
                disabled={sequels.length === 0}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Sequels
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFranchisesResetPending(true)}
                disabled={franchises.length === 0}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Reset Movies
              </Button>
              <Button
                onClick={() => {
                  setEditingFranchise(null)
                  setFranchiseModalOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Franchise
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading franchises...</div>
            ) : franchises.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
                <p className="text-base font-medium text-foreground">No franchises yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Total Movies</p>
                    <p className="text-lg font-semibold text-foreground">{franchises.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">TMDb Imported</p>
                    <p className="text-lg font-semibold text-foreground">{tmdbFranchiseCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Manual Movies</p>
                    <p className="text-lg font-semibold text-foreground">{manualFranchiseCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Total Sequels</p>
                    <p className="text-lg font-semibold text-foreground">{sequels.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Unused Sequels</p>
                    <p className="text-lg font-semibold text-foreground">{unusedSequelCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Movies With Sequels</p>
                    <p className="text-lg font-semibold text-foreground">{franchisesWithSequelsCount}</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(460px,1.1fr)]">
                  <div className="flex min-h-[720px] min-w-0 flex-col rounded-xl border border-border bg-background">
                    <div className="border-b border-border p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">Movies</p>
                          <p className="text-sm text-muted-foreground">
                            Select a movie to manage its fake sequels.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{filteredFranchises.length} results</Badge>
                          <ToggleGroup
                            type="single"
                            value={franchiseListLayout}
                            onValueChange={(value) => {
                              if (value) {
                                setFranchiseListLayout(value as FranchiseListLayout)
                                setFranchisePage(1)
                              }
                            }}
                            variant="outline"
                            size="sm"
                            aria-label="Movie list layout"
                          >
                            <ToggleGroupItem value="list" aria-label="List layout" className="w-9 px-0">
                              <List className="h-4 w-4" />
                            </ToggleGroupItem>
                            <ToggleGroupItem value="grid" aria-label="Grid layout" className="w-9 px-0">
                              <LayoutGrid className="h-4 w-4" />
                            </ToggleGroupItem>
                            <ToggleGroupItem value="compact" aria-label="Compact layout" className="w-9 px-0">
                              <Rows3 className="h-4 w-4" />
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_160px_180px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={franchiseSearchQuery}
                      onChange={(event) => setFranchiseSearchQuery(event.target.value)}
                      placeholder="Search title, latest movie, notes..."
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={franchiseGenreFilter}
                    onValueChange={(value: 'all' | PosterLabGenre) => setFranchiseGenreFilter(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {Object.entries(genreLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={franchiseSourceFilter} onValueChange={setFranchiseSourceFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="Manual">Manual</SelectItem>
                      {franchiseSourceOptions.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                      {filteredFranchises.length === 0 ? (
                        <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 px-4 text-center text-sm text-muted-foreground">
                          No franchises match the current filters.
                        </div>
                      ) : (
                        <div
                          className={
                            franchiseListLayout === 'grid'
                              ? 'grid gap-2 sm:grid-cols-2'
                              : 'space-y-2'
                          }
                        >
                          {visibleFranchises.map((franchise) => {
                          const sequelCount = franchiseSequelCounts.get(franchise.id) ?? 0
                          const isSelected = selectedFranchiseId === franchise.id
                          const isGridLayout = franchiseListLayout === 'grid'
                          const isCompactLayout = franchiseListLayout === 'compact'
                          const thumbnailSize = isCompactLayout
                            ? 'h-14 w-11'
                            : isGridLayout
                              ? 'h-24 w-16'
                              : 'h-20 w-16'

                          return (
                            <button
                              key={franchise.id}
                              type="button"
                              className={`w-full rounded-lg border text-left transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/8'
                                  : 'border-border bg-card hover:bg-accent/20'
                              } ${isCompactLayout ? 'p-2' : 'p-3'} ${isGridLayout ? 'h-full min-h-40' : ''}`}
                              onClick={() => setSelectedFranchiseId(franchise.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className={`shrink-0 overflow-hidden rounded-md border border-border bg-secondary/40 ${thumbnailSize}`}>
                                  {franchise.posterPath ? (
                                    <img
                                      src={`https://image.tmdb.org/t/p/w185${franchise.posterPath}`}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Film className={isCompactLayout ? 'h-4 w-4 text-muted-foreground' : 'h-5 w-5 text-muted-foreground'} />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <p className="truncate font-medium text-foreground">{franchise.franchiseName}</p>
                                    {isSelected ? <Badge>Selected</Badge> : null}
                                  </div>
                                  <p className={isGridLayout ? 'line-clamp-2 text-sm text-muted-foreground' : 'truncate text-sm text-muted-foreground'}>
                                    Latest: {franchise.latestOfficialTitle}
                                  </p>
                                  {!isCompactLayout && franchise.overview ? (
                                    <p className="line-clamp-2 text-xs text-muted-foreground">
                                      {franchise.overview}
                                    </p>
                                  ) : null}
                                  <div className={isCompactLayout ? 'flex flex-wrap gap-1' : 'flex flex-wrap gap-1 pt-1'}>
                                    <Badge variant="outline">{genreLabels[franchise.genre]}</Badge>
                                    {franchise.releaseDate ? (
                                      <Badge variant="outline">{franchise.releaseDate.slice(0, 4)}</Badge>
                                    ) : null}
                                    {!isCompactLayout ? (
                                      <Badge variant={franchise.tmdbMovieId ? 'secondary' : 'outline'}>
                                      {franchise.sourceCategory || 'Manual'}
                                      </Badge>
                                    ) : null}
                                    <Badge variant="outline">
                                      {sequelCount} sequel{sequelCount === 1 ? '' : 's'}
                                    </Badge>
                                  </div>
                                </div>
                                <div onClick={(event) => event.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="border-border bg-popover">
                                    <DropdownMenuItem onClick={() => setSelectedFranchiseId(franchise.id)}>
                                      Select
                                    </DropdownMenuItem>
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
                          )
                          })}
                        </div>
                      )}
                    </div>

                <div className="border-t border-border p-3 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Showing {visibleFranchises.length} of {filteredFranchises.length} franchises
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFranchisePage((current) => Math.max(1, current - 1))}
                      disabled={franchisePage <= 1}
                    >
                      Previous
                    </Button>
                    <span className="min-w-20 text-center">
                      {franchisePage} / {franchisePageCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFranchisePage((current) => Math.min(franchisePageCount, current + 1))}
                      disabled={franchisePage >= franchisePageCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                  </div>

                {selectedFranchise ? (
                  <div className="max-h-[720px] overflow-y-auto rounded-xl border border-border bg-background xl:sticky xl:top-4 xl:self-start">
                    <div className="border-b border-border p-4">
                      <p className="font-semibold text-foreground">Selected Movie</p>
                      <p className="text-sm text-muted-foreground">
                        Full movie metadata and all attached fake sequels.
                      </p>
                    </div>
                    <div className="grid gap-5 p-4 lg:grid-cols-[160px_1fr]">
                      <div className="overflow-hidden rounded-lg border border-border bg-secondary/30">
                        {selectedFranchise.posterPath ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w342${selectedFranchise.posterPath}`}
                            alt=""
                            className="aspect-[2/3] w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-[2/3] w-full items-center justify-center">
                            <Film className="h-9 w-9 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              Movie Detail
                            </p>
                            <h3 className="mt-1 text-xl font-semibold text-foreground">
                              {selectedFranchise.franchiseName}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Latest official: {selectedFranchise.latestOfficialTitle}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{genreLabels[selectedFranchise.genre]}</Badge>
                            {selectedFranchise.releaseDate ? (
                              <Badge variant="outline">{selectedFranchise.releaseDate}</Badge>
                            ) : null}
                            <Badge variant={selectedFranchise.tmdbMovieId ? 'secondary' : 'outline'}>
                              {selectedFranchise.sourceCategory || 'Manual'}
                            </Badge>
                          </div>
                        </div>

                        {selectedFranchise.overview ? (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              Overview
                            </p>
                            <p className="mt-2 text-sm leading-6 text-foreground/90">
                              {selectedFranchise.overview}
                            </p>
                          </div>
                        ) : null}

                        {selectedFranchise.notes ? (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              Notes
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                              {selectedFranchise.notes}
                            </p>
                          </div>
                        ) : null}

                        {selectedFranchise.tmdbGenreNames?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {selectedFranchise.tmdbGenreNames.map((genreName) => (
                              <Badge key={genreName} variant="outline">
                                {genreName}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingFranchise(selectedFranchise)
                              setFranchiseModalOpen(true)
                            }}
                          >
                            Edit Movie
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setFranchisePendingDelete(selectedFranchise)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Movie
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setEditingSequel(null)
                              setSequelModalOpen(true)
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Fake Sequel
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">Sequels for this movie</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedFranchiseSequels.length} fake sequel{selectedFranchiseSequels.length === 1 ? '' : 's'} attached.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSequelBulkDeleteScope('selected')}
                          disabled={selectedFranchiseSequels.length === 0}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Clear Movie Sequels
                        </Button>
                      </div>

                      {selectedFranchiseSequels.length === 0 ? (
                        <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
                          No fake sequels yet for this movie.
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          {selectedFranchiseSequels.map((sequel) => (
                            <div key={sequel.id} className="rounded-lg border border-border bg-card p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-foreground">{sequel.fakeTitle}</p>
                                    <Badge variant="outline">{sequel.releaseYear}</Badge>
                                    <Badge variant={sequel.isUsed ? 'secondary' : 'default'}>
                                      {sequel.isUsed ? 'Used' : 'Fresh'}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-sm italic text-foreground/90">
                                    &quot;{sequel.tagline}&quot;
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" variant="outline" onClick={() => void handleCopyIdea(sequel)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingSequel(sequel)
                                      setSequelModalOpen(true)
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => void toggleUsed(sequel)}>
                                    {sequel.isUsed ? 'Mark Unused' : 'Mark Used'}
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                    Synopsis
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-foreground/90">{sequel.synopsis}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                    Visual Hook
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-foreground/90">{sequel.visualHook}</p>
                                </div>
                              </div>

                              {sequel.prompt ? (
                                <div className="mt-4">
                                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                    Prompt
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                                    {sequel.prompt}
                                  </p>
                                </div>
                              ) : null}

                              {sequel.caption ? (
                                <div className="mt-4">
                                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                    Caption
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                                    {sequel.caption}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>

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

      <AlertDialog open={franchisesResetPending} onOpenChange={setFranchisesResetPending}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Movies</AlertDialogTitle>
            <AlertDialogDescription>
              Delete all {franchises.length} movies and all {sequels.length} attached fake sequels from Poster Lab? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleResetFranchises()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset Movies
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

      <AlertDialog
        open={sequelBulkDeleteScope !== null}
        onOpenChange={(open) => !open && setSequelBulkDeleteScope(null)}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sequelBulkDeleteScope === 'selected' ? 'Clear Movie Sequels' : 'Clear All Sequels'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sequelBulkDeleteScope === 'selected'
                ? `Delete all ${selectedFranchiseSequels.length} fake sequels attached to "${selectedFranchise?.franchiseName || 'this movie'}"? This action cannot be undone.`
                : `Delete all ${sequels.length} fake sequels in Poster Lab? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteSequelsBulk()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Sequels
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

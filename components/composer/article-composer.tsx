"use client"

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToastAction } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import type { Post, PostStatus } from '@/lib/types'
import {
  AlertTriangle,
  Bold,
  Clipboard,
  Eye,
  Heading2,
  Image as ImageIcon,
  List,
  Pilcrow,
  Plug,
  Plus,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-react'

const TinyMceHtmlEditor = dynamic(
  () => import('@/components/composer/tinymce-html-editor').then((mod) => mod.TinyMceHtmlEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-md border border-border bg-secondary text-sm text-muted-foreground">
        Loading editor...
      </div>
    ),
  }
)

type ArticleDraft = {
  title: string
  description: string
  image: string
  descriptionImage: string
  sourcePostId: string
  postCaption: string
}

const emptyDraft: ArticleDraft = {
  title: '',
  description: '',
  image: '',
  descriptionImage: '',
  sourcePostId: '',
  postCaption: '',
}

function createDraft(overrides: Partial<ArticleDraft> = {}): ArticleDraft {
  return { ...emptyDraft, ...overrides }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function isLikelyHeading(block: string, index: number) {
  if (index === 0) return false
  if (block.length > 90) return false
  if (/[.!?…:]$/.test(block)) return false
  if (block.includes('\n')) return false
  if (/^["'“‘]/.test(block)) return false
  if (/^\d+[\.)]\s/.test(block)) return false
  if (block.split(/\s+/).length > 10) return false

  const words = block.split(/\s+/).filter(Boolean)
  if (words.length < 2) return false

  const capitalizedWords = words.filter((word) => /^[A-Z0-9]/.test(word))
  return capitalizedWords.length / words.length >= 0.55
}

function getWordCount(description: string) {
  const text = description.replace(/<[^>]*>/g, ' ').trim()
  return text ? text.split(/\s+/).length : 0
}

function parseTimeSlotMinutes(timeSlot: string) {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

function comparePostsBySchedule(first: Post, second: Post) {
  if (first.postDate !== second.postDate) {
    return first.postDate.localeCompare(second.postDate)
  }

  const firstMinutes = parseTimeSlotMinutes(first.timeSlot)
  const secondMinutes = parseTimeSlotMinutes(second.timeSlot)
  if (firstMinutes !== null && secondMinutes !== null && firstMinutes !== secondMinutes) {
    return firstMinutes - secondMinutes
  }

  return first.timeSlot.localeCompare(second.timeSlot)
}

function isBlankDraft(draft: ArticleDraft) {
  return !draft.title && !draft.description && !draft.image && !draft.descriptionImage
}

function getDraftWarnings(draft: ArticleDraft) {
  const warnings: string[] = []

  if (!draft.title.trim()) {
    warnings.push('Missing article title')
  }

  if (!draft.description.trim()) {
    warnings.push('Missing article description')
  }

  if (!draft.image.trim()) {
    warnings.push('Missing thumbnail image URL')
  }

  if (!draft.sourcePostId.trim()) {
    warnings.push('Missing Scheduler target post')
  }

  if (draft.sourcePostId.trim() && !draft.postCaption.trim()) {
    warnings.push('Missing Facebook post caption')
  }

  return warnings
}

const titlePrefixPreferencesStorageKey = 'postops:composer-title-prefix'
const extensionSchedulerConfigStorageKey = 'postops:composer-extension-scheduler-config'
const extensionPayloadStorageKey = 'postops:daily-feji-extension-payload'
const composerStateStorageKey = 'postops:composer-state'
const composerStateDbName = 'postops-composer'
const composerStateStoreName = 'state'
const extensionStartMessageType = 'POSTOPS_START_DAILY_FEJI'
const extensionAckMessageType = 'POSTOPS_DAILY_FEJI_ACK'
const extensionPingMessageType = 'POSTOPS_DAILY_FEJI_PING'
const extensionPongMessageType = 'POSTOPS_DAILY_FEJI_PONG'
const postStatusOptions: Array<PostStatus | 'all'> = [
  'all',
  'draft',
  'scheduled',
  'ready',
  'due_now',
  'posted',
  'late',
  'skipped',
]
const allowedExtensionStatuses: PostStatus[] = ['draft', 'scheduled', 'ready']

type TitlePrefixPreferences = {
  enabled?: boolean
  prefix?: string
}

type ExtensionSchedulerConfig = {
  token?: string
  status?: PostStatus
}

type SavedComposerState = {
  drafts?: ArticleDraft[]
  activeIndex?: number
  jsonInput?: string
  sourcePageId?: string
  sourceStatus?: PostStatus | 'all'
  sourceShowAll?: boolean
  sourceDate?: string
  sourceStartTime?: string
  selectedPostIds?: string[]
}

type ComposerUndoSnapshot = {
  drafts: ArticleDraft[]
  activeIndex: number
  dismissedPostIds: string[]
}

function readTitlePrefixPreferences(): Required<TitlePrefixPreferences> {
  if (typeof window === 'undefined') {
    return { enabled: true, prefix: 'VT' }
  }

  try {
    const rawValue = window.localStorage.getItem(titlePrefixPreferencesStorageKey)
    if (!rawValue) return { enabled: true, prefix: 'VT' }

    const parsedValue = JSON.parse(rawValue) as TitlePrefixPreferences
    return {
      enabled: parsedValue.enabled !== false,
      prefix: typeof parsedValue.prefix === 'string' && parsedValue.prefix.trim()
        ? parsedValue.prefix.trim()
        : 'VT',
    }
  } catch {
    return { enabled: true, prefix: 'VT' }
  }
}

function readExtensionSchedulerConfig(): Required<ExtensionSchedulerConfig> {
  if (typeof window === 'undefined') {
    return { token: '', status: 'draft' }
  }

  try {
    const rawValue = window.localStorage.getItem(extensionSchedulerConfigStorageKey)
    const parsedValue = rawValue ? (JSON.parse(rawValue) as ExtensionSchedulerConfig) : {}

    return {
      token: parsedValue.token?.trim() || '',
      status: parsedValue.status || 'draft',
    }
  } catch {
    return { token: '', status: 'draft' }
  }
}

function openComposerStateDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(composerStateDbName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(composerStateStoreName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readSavedComposerStateFromDb() {
  const db = await openComposerStateDb()
  return new Promise<SavedComposerState>((resolve, reject) => {
    const request = db
      .transaction(composerStateStoreName, 'readonly')
      .objectStore(composerStateStoreName)
      .get(composerStateStorageKey)

    request.onsuccess = () => resolve((request.result as SavedComposerState | undefined) ?? {})
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

async function writeSavedComposerStateToDb(state: SavedComposerState) {
  const db = await openComposerStateDb()
  return new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(composerStateStoreName, 'readwrite')
      .objectStore(composerStateStoreName)
      .put(state, composerStateStorageKey)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

async function deleteSavedComposerStateFromDb() {
  const db = await openComposerStateDb()
  return new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(composerStateStoreName, 'readwrite')
      .objectStore(composerStateStoreName)
      .delete(composerStateStorageKey)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

function ensureTitlePrefix(title: string, prefix: string, enabled: boolean) {
  const trimmedTitle = title.trim()
  const trimmedPrefix = prefix.trim()

  if (!enabled || !trimmedPrefix) return trimmedTitle
  if (!trimmedTitle) return trimmedPrefix
  if (trimmedTitle.toLowerCase() === trimmedPrefix.toLowerCase()) return trimmedTitle
  if (trimmedTitle.toLowerCase().startsWith(`${trimmedPrefix.toLowerCase()} `)) {
    return trimmedTitle
  }

  return `${trimmedPrefix} ${trimmedTitle}`
}

function buildJson(drafts: ArticleDraft[], titlePrefix: string, titlePrefixEnabled: boolean) {
  return JSON.stringify(
    drafts.map((draft) => ({
      title: ensureTitlePrefix(draft.title, titlePrefix, titlePrefixEnabled),
      description: draft.description.trim(),
      image: draft.image.trim(),
      ...(draft.sourcePostId.trim()
        ? { schedulerPostId: draft.sourcePostId.trim() }
        : {}),
      ...(draft.postCaption.trim()
        ? { caption: draft.postCaption.trim() }
        : {}),
      ...(draft.descriptionImage.trim()
        ? { descriptionImage: draft.descriptionImage.trim() }
        : {}),
    })),
    null,
    2
  )
}

function buildExtensionItems(drafts: ArticleDraft[], titlePrefix: string, titlePrefixEnabled: boolean) {
  return drafts
    .filter((draft) => getDraftWarnings(draft).length === 0)
    .map((draft) => ({
      title: ensureTitlePrefix(draft.title, titlePrefix, titlePrefixEnabled),
      description: draft.description.trim(),
      image: draft.image.trim(),
      schedulerPostId: draft.sourcePostId.trim(),
      caption: draft.postCaption.trim(),
      ...(draft.descriptionImage.trim()
        ? { descriptionImage: draft.descriptionImage.trim() }
        : {}),
    }))
}

function normalizeImportedDraft(item: unknown): ArticleDraft {
  if (!item || typeof item !== 'object') {
    return createDraft()
  }

  const record = item as Record<string, unknown>
  return createDraft({
    title: typeof record.title === 'string' ? record.title : '',
    description: typeof record.description === 'string' ? record.description : '',
    image: typeof record.image === 'string' ? record.image : '',
    descriptionImage: typeof record.descriptionImage === 'string' ? record.descriptionImage : '',
    sourcePostId: typeof record.sourcePostId === 'string' ? record.sourcePostId : '',
    postCaption: typeof record.postCaption === 'string' ? record.postCaption : '',
  })
}

function createDraftFromPost(post: Post) {
  return createDraft({
    image: post.imageUrl ?? post.imagePath ?? '',
    sourcePostId: post.id,
    postCaption: post.caption,
  })
}

function hydrateDraftFromPost(draft: ArticleDraft, post: Post) {
  return {
    ...draft,
    image: draft.image || post.imageUrl || post.imagePath || '',
    postCaption: draft.postCaption || post.caption,
  }
}

export function ArticleComposer() {
  const posts = useAppStore((state) => state.posts)
  const pages = useAppStore((state) => state.pages)
  const storeSelectedDate = useAppStore((state) => state.selectedDate)
  const [drafts, setDrafts] = useState<ArticleDraft[]>(() => [])
  const [activeIndex, setActiveIndex] = useState(0)
  const [jsonInput, setJsonInput] = useState('')
  const [sourcePageId, setSourcePageId] = useState('all')
  const [sourceStatus, setSourceStatus] = useState<PostStatus | 'all'>(
    'draft'
  )
  const [sourceShowAll, setSourceShowAll] = useState(false)
  const [sourceDate, setSourceDate] = useState(storeSelectedDate)
  const [sourceStartTime, setSourceStartTime] = useState('00:00')
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([])
  const [titlePrefixEnabled, setTitlePrefixEnabled] = useState(
    () => readTitlePrefixPreferences().enabled
  )
  const [titlePrefix, setTitlePrefix] = useState(() => readTitlePrefixPreferences().prefix)
  const [extensionSchedulerToken, setExtensionSchedulerToken] = useState(
    () => readExtensionSchedulerConfig().token
  )
  const [extensionSchedulerStatus, setExtensionSchedulerStatus] = useState<PostStatus>(
    () => readExtensionSchedulerConfig().status
  )
  const [validationPulse, setValidationPulse] = useState(0)
  const [hasLoadedSavedComposerState, setHasLoadedSavedComposerState] = useState(false)
  const [dismissedPostIds, setDismissedPostIds] = useState<string[]>([])
  const [undoSnapshot, setUndoSnapshot] = useState<ComposerUndoSnapshot | null>(null)

  const activeDraft = drafts[activeIndex] ?? drafts[0] ?? createDraft()
  const activeDraftWarnings = useMemo(() => getDraftWarnings(activeDraft), [activeDraft])
  const draftWarningCounts = useMemo(
    () => drafts.map((draft) => getDraftWarnings(draft).length),
    [drafts]
  )
  const showActiveValidation = validationPulse > 0 && activeDraftWarnings.length > 0
  const isMissingTitle = showActiveValidation && !activeDraft.title.trim()
  const isMissingDescription = showActiveValidation && !activeDraft.description.trim()
  const isMissingThumbnail = showActiveValidation && !activeDraft.image.trim()
  const isMissingTargetPost = showActiveValidation && !activeDraft.sourcePostId.trim()
  const isMissingPostCaption =
    showActiveValidation && Boolean(activeDraft.sourcePostId.trim()) && !activeDraft.postCaption.trim()
  const generatedJson = useMemo(
    () => buildJson(drafts, titlePrefix, titlePrefixEnabled),
    [drafts, titlePrefix, titlePrefixEnabled]
  )
  const wordCount = useMemo(() => getWordCount(activeDraft.description), [activeDraft.description])
  const sourceCandidates = useMemo(() => {
    const startMinutes = parseTimeSlotMinutes(sourceStartTime) ?? 0

    return posts
      .filter((post) => {
        if (!sourceShowAll && post.postDate !== sourceDate) return false
        if (sourcePageId !== 'all' && post.pageId !== sourcePageId) return false
        if (sourceStatus !== 'all' && post.status !== sourceStatus) return false
        if (!post.imageUrl && !post.imagePath) return false

        if (sourceShowAll) return true

        const postMinutes = parseTimeSlotMinutes(post.timeSlot)
        return postMinutes === null || postMinutes >= startMinutes
      })
      .sort(comparePostsBySchedule)
  }, [posts, sourceDate, sourcePageId, sourceShowAll, sourceStartTime, sourceStatus])
  const draftPostCandidates = useMemo(() => {
    const startMinutes = parseTimeSlotMinutes(sourceStartTime) ?? 0
    if (sourceStatus !== 'all' && sourceStatus !== 'draft') return [] as Post[]

    return posts
      .filter((post) => {
        if (post.status !== 'draft') return false
        if (dismissedPostIds.includes(post.id)) return false
        if (!post.imageUrl && !post.imagePath) return false
        if (!sourceShowAll && post.postDate !== sourceDate) return false
        if (sourcePageId !== 'all' && post.pageId !== sourcePageId) return false

        if (sourceShowAll) return true

        const postMinutes = parseTimeSlotMinutes(post.timeSlot)
        return postMinutes === null || postMinutes >= startMinutes
      })
      .sort(comparePostsBySchedule)
  }, [dismissedPostIds, posts, sourceDate, sourcePageId, sourceShowAll, sourceStartTime, sourceStatus])
  const selectedSourcePosts = useMemo(
    () => sourceCandidates.filter((post) => selectedPostIds.includes(post.id)),
    [sourceCandidates, selectedPostIds]
  )
  const activeSourcePost = useMemo(
    () => posts.find((post) => post.id === activeDraft.sourcePostId),
    [activeDraft.sourcePostId, posts]
  )
  const captionTargetPosts = useMemo(() => {
    if (!activeSourcePost || sourceCandidates.some((post) => post.id === activeSourcePost.id)) {
      return sourceCandidates
    }

    return [activeSourcePost, ...sourceCandidates].sort(comparePostsBySchedule)
  }, [activeSourcePost, sourceCandidates])
  const filteredDraftEntries = useMemo(() => {
    const startMinutes = parseTimeSlotMinutes(sourceStartTime) ?? 0

    return drafts
      .map((draft, index) => ({
        draft,
        index,
        sourcePost: posts.find((post) => post.id === draft.sourcePostId),
      }))
      .filter(({ draft, sourcePost }) => {
        if (!sourcePost) return true

        if (!sourceShowAll && sourcePost.postDate !== sourceDate) return false
        if (sourcePageId !== 'all' && sourcePost.pageId !== sourcePageId) return false
        if (sourceStatus !== 'all' && sourcePost.status !== sourceStatus) return false

        if (sourceShowAll) return true

        const postMinutes = parseTimeSlotMinutes(sourcePost.timeSlot)
        return postMinutes === null || postMinutes >= startMinutes
      })
  }, [drafts, posts, sourceDate, sourcePageId, sourceShowAll, sourceStartTime, sourceStatus])

  const getPageName = (pageId: string) => {
    return pages.find((page) => page.id === pageId)?.name ?? 'Unknown page'
  }

  const updateActiveDraft = (updates: Partial<ArticleDraft>) => {
    setDrafts((current) =>
      current.map((draft, index) => (index === activeIndex ? { ...draft, ...updates } : draft))
    )
  }

  const selectElement = (index: number) => {
    const draft = drafts[index]
    const sourcePost = draft?.sourcePostId
      ? posts.find((post) => post.id === draft.sourcePostId)
      : undefined

    setActiveIndex(index)

    if (!draft || !sourcePost) return

    setDrafts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? hydrateDraftFromPost(item, sourcePost) : item
      )
    )
  }

  const normalizeActiveTitle = () => {
    updateActiveDraft({
      title: ensureTitlePrefix(activeDraft.title, titlePrefix, titlePrefixEnabled),
    })
  }

  const addElement = () => {
    setDrafts((current) => {
      const next = [...current, createDraft()]
      setActiveIndex(next.length - 1)
      return next
    })
  }

  const toggleSourcePost = (postId: string) => {
    setSelectedPostIds((current) =>
      current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId]
    )
  }

  const toggleAllSourcePosts = () => {
    if (selectedSourcePosts.length === sourceCandidates.length) {
      setSelectedPostIds([])
      return
    }

    setSelectedPostIds(sourceCandidates.map((post) => post.id))
  }

  const createElementsFromPosts = () => {
    if (selectedSourcePosts.length === 0) {
      toast({
        title: 'No posts selected',
        description: 'Select at least one scheduled post with an image.',
        variant: 'destructive',
      })
      return
    }

    const newDrafts = selectedSourcePosts.map(createDraftFromPost)

    setDrafts((current) => {
      const shouldReplaceBlank = current.length === 1 && isBlankDraft(current[0])
      const next = shouldReplaceBlank ? newDrafts : [...current, ...newDrafts]
      setActiveIndex(shouldReplaceBlank ? 0 : current.length)
      return next
    })
    toast({ title: `${newDrafts.length} element${newDrafts.length > 1 ? 's' : ''} created` })
  }

  const removeActiveElement = () => {
    if (drafts.length === 1) {
      setDrafts([])
      setActiveIndex(0)
      return
    }

    setDrafts((current) => current.filter((_, index) => index !== activeIndex))
    setActiveIndex((current) => Math.max(0, current - 1))
  }

  const resetComposer = () => {
    window.localStorage.removeItem(composerStateStorageKey)
    void deleteSavedComposerStateFromDb()
    setDrafts([])
    setActiveIndex(0)
    setJsonInput('')
    setSourcePageId('all')
    setSourceStatus('draft')
    setSourceShowAll(false)
    setSourceDate(storeSelectedDate)
    setSourceStartTime('00:00')
    setSelectedPostIds([])
    setDismissedPostIds([])
    setUndoSnapshot(null)
    toast({ title: 'Composer reset' })
  }

  const undoLastComposerReset = (snapshot: ComposerUndoSnapshot) => {
    setDrafts(snapshot.drafts.map((draft) => createDraft(draft)))
    setActiveIndex(Math.min(snapshot.activeIndex, Math.max(0, snapshot.drafts.length - 1)))
    setDismissedPostIds(snapshot.dismissedPostIds)
    setUndoSnapshot(null)
    toast({ title: 'Composer restored' })
  }

  const insertHtml = (snippet: string) => {
    updateActiveDraft({
      description: `${activeDraft.description}${activeDraft.description ? '\n' : ''}${snippet}`,
    })
  }

  const copyJson = async () => {
    await navigator.clipboard.writeText(generatedJson)
    toast({ title: 'JSON copied' })
  }

  const prepareExtensionPayload = async () => {
    const readyItems = buildExtensionItems(drafts, titlePrefix, titlePrefixEnabled)
    const skippedCount = drafts.length - readyItems.length

    if (readyItems.length === 0) {
      const firstInvalidIndex = drafts.findIndex((draft) => getDraftWarnings(draft).length > 0)
      setValidationPulse(Date.now())
      setActiveIndex(firstInvalidIndex >= 0 ? firstInvalidIndex : 0)
      toast({
        title: 'No ready elements',
        description: 'Finish at least one element before sending to the extension.',
        variant: 'destructive',
      })
      return
    }

    const schedulerToken = extensionSchedulerToken.trim()
    if (!schedulerToken) {
      const shouldContinue = window.confirm(
        'Import token is empty. The extension can still create Daily/Feji posts, but results will not sync back to Scheduler. Continue without sync?'
      )

      if (!shouldContinue) {
        toast({
          title: 'Extension cancelled',
          description: 'Add an import token if you want results to sync back to Scheduler.',
        })
        return
      }
    }

    window.localStorage.setItem(
      extensionPayloadStorageKey,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        items: readyItems,
      })
    )

    const bridgeDetected = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', handlePong)
        resolve(false)
      }, 800)

      function handlePong(event: MessageEvent) {
        if (event.source !== window || event.data?.type !== extensionPongMessageType) return
        window.clearTimeout(timeout)
        window.removeEventListener('message', handlePong)
        resolve(true)
      }

      window.addEventListener('message', handlePong)
      window.postMessage({ type: extensionPingMessageType }, window.location.origin)
    })

    if (!bridgeDetected) {
      await navigator.clipboard.writeText(JSON.stringify(readyItems, null, 2))
      toast({
        title: 'Extension bridge not injected',
        description:
          `Ready JSON copied instead. ${skippedCount > 0 ? `${skippedCount} unfinished element${skippedCount > 1 ? 's' : ''} skipped. ` : ''}Reload Daily Feji extension in chrome://extensions, then reload this Composer tab.`,
        variant: 'destructive',
      })
      return
    }

    const extensionAck = await new Promise<{ ok: boolean; error: string }>((resolve) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', handleAck)
        resolve({ ok: false, error: '' })
      }, 3000)

      function handleAck(event: MessageEvent) {
        if (event.source !== window || event.data?.type !== extensionAckMessageType) return
        window.clearTimeout(timeout)
        window.removeEventListener('message', handleAck)
        resolve({
          ok: event.data.ok === true,
          error: String(event.data.error || ''),
        })
      }

      window.addEventListener('message', handleAck)
      window.postMessage(
        {
          type: extensionStartMessageType,
          payload: {
            items: readyItems,
            options: {
              imagePlacement: 'none',
            },
            scheduler: {
              enabled: Boolean(schedulerToken),
              schedulerUrl: window.location.origin,
              token: schedulerToken,
              status: extensionSchedulerStatus,
            },
          },
        },
        window.location.origin
      )
    })

    if (extensionAck.ok) {
      const sentPostIds = new Set(readyItems.map((item) => item.schedulerPostId))
      const snapshot: ComposerUndoSnapshot = {
        drafts,
        activeIndex,
        dismissedPostIds,
      }
      setUndoSnapshot(snapshot)
      setDismissedPostIds((current) => Array.from(new Set([...current, ...sentPostIds])))
      setDrafts((current) => {
        const next = current.filter((draft) => !sentPostIds.has(draft.sourcePostId))
        return next
      })
      setActiveIndex(0)
      setSelectedPostIds([])

      toast({
        title: 'Extension started',
        description: `${readyItems.length} ready item${readyItems.length > 1 ? 's' : ''} sent and cleared.${skippedCount > 0 ? ` ${skippedCount} unfinished kept.` : ''}`,
        action: (
          <ToastAction altText="Undo composer clear" onClick={() => undoLastComposerReset(snapshot)}>
            Undo
          </ToastAction>
        ),
      })
      return
    }

    await navigator.clipboard.writeText(JSON.stringify(readyItems, null, 2))
    toast({
      title: extensionAck.error ? 'Extension error' : 'Extension not detected',
      description: extensionAck.error
        ? `${extensionAck.error}. Ready JSON copied instead.`
        : 'Ready JSON copied instead. Bridge is injected, but extension background did not acknowledge the batch.',
      variant: 'destructive',
    })
  }

  const copyDescription = async () => {
    await navigator.clipboard.writeText(activeDraft.description)
    toast({ title: 'HTML copied' })
  }

  const importJson = () => {
    const parsed = JSON.parse(jsonInput)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    const importedDrafts = items.map(normalizeImportedDraft)

    if (importedDrafts.length === 0) {
      throw new Error('JSON must contain at least one item.')
    }

    setDrafts(importedDrafts)
    setActiveIndex(0)
  }

  const handleImportJson = () => {
    try {
      importJson()
      toast({ title: 'JSON imported' })
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Invalid JSON.',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    window.localStorage.setItem(
      titlePrefixPreferencesStorageKey,
      JSON.stringify({
        enabled: titlePrefixEnabled,
        prefix: titlePrefix,
      } satisfies TitlePrefixPreferences)
    )
  }, [titlePrefix, titlePrefixEnabled])

  useEffect(() => {
    let isCancelled = false
    readSavedComposerStateFromDb()
      .then((savedState) => {
        if (isCancelled) return

        if (!savedState.drafts?.length) {
          setHasLoadedSavedComposerState(true)
          return
        }

        setDrafts(savedState.drafts.map((draft) => createDraft(draft)))
        setActiveIndex(savedState.activeIndex ?? 0)
        setJsonInput(savedState.jsonInput ?? '')
        setSourcePageId(savedState.sourcePageId ?? 'all')
        setSourceStatus(savedState.sourceStatus ?? 'draft')
        setSourceShowAll(savedState.sourceShowAll ?? false)
        setSourceDate(savedState.sourceDate ?? storeSelectedDate)
        setSourceStartTime(savedState.sourceStartTime ?? '00:00')
        setSelectedPostIds(savedState.selectedPostIds ?? [])
        window.localStorage.removeItem(composerStateStorageKey)
        setHasLoadedSavedComposerState(true)
      })
      .catch(() => {
        // Autosave restore is best-effort.
        if (!isCancelled) {
          setHasLoadedSavedComposerState(true)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [storeSelectedDate])

  useEffect(() => {
    if (!hasLoadedSavedComposerState || draftPostCandidates.length === 0) return

    setDrafts((current) => {
      const currentPostIds = new Set(current.map((draft) => draft.sourcePostId).filter(Boolean))
      const missingDrafts = draftPostCandidates
        .filter((post) => !currentPostIds.has(post.id))
        .map(createDraftFromPost)

      if (missingDrafts.length === 0) return current

      if (current.length === 1 && isBlankDraft(current[0])) {
        return missingDrafts
      }

      return [...current, ...missingDrafts]
    })
  }, [draftPostCandidates, hasLoadedSavedComposerState])

  useEffect(() => {
    if (activeIndex > drafts.length - 1) {
      setActiveIndex(Math.max(0, drafts.length - 1))
    }
  }, [activeIndex, drafts.length])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void writeSavedComposerStateToDb({
        drafts,
        activeIndex,
        jsonInput,
        sourcePageId,
        sourceStatus,
        sourceShowAll,
        sourceDate,
        sourceStartTime,
        selectedPostIds,
      }).catch(() => {
        // Autosave is best-effort; avoid breaking editing when browser storage is full.
      })
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [
    activeIndex,
    drafts,
    jsonInput,
    selectedPostIds,
    sourceDate,
    sourcePageId,
    sourceShowAll,
    sourceStartTime,
    sourceStatus,
  ])

  useEffect(() => {
    window.localStorage.setItem(
      extensionSchedulerConfigStorageKey,
      JSON.stringify({
        token: extensionSchedulerToken.trim(),
        status: extensionSchedulerStatus,
      } satisfies ExtensionSchedulerConfig)
    )
  }, [extensionSchedulerStatus, extensionSchedulerToken])

  return (
    <div className="space-y-6">
      <style>
        {`
          @keyframes composer-shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-5px); }
            40% { transform: translateX(5px); }
            60% { transform: translateX(-3px); }
            80% { transform: translateX(3px); }
          }
        `}
      </style>
      <Tabs defaultValue="compose" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-56 space-y-1">
              <Label htmlFor="composer-extension-token" className="text-xs text-muted-foreground">
                Import token
              </Label>
              <Input
                id="composer-extension-token"
                type="password"
                value={extensionSchedulerToken}
                onChange={(event) => setExtensionSchedulerToken(event.target.value)}
                placeholder="EXTENSION_IMPORT_TOKEN"
                className="h-9"
              />
            </div>
            <div className="w-36 space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={extensionSchedulerStatus}
                onValueChange={(value) => setExtensionSchedulerStatus(value as PostStatus)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {allowedExtensionStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={prepareExtensionPayload}>
              <Plug className="mr-2 h-4 w-4" />
              Extension
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">Advanced</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Advanced</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                      <CardTitle className="text-base">JSON</CardTitle>
                      <Button type="button" variant="outline" size="sm" onClick={copyJson}>
                        <Clipboard className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <Textarea value={generatedJson} readOnly className="h-[360px] resize-none overflow-y-auto font-mono text-xs" />
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Import</CardTitle>
                      <Button type="button" variant="outline" size="sm" onClick={handleImportJson}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Load
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={jsonInput}
                        onChange={(event) => setJsonInput(event.target.value)}
                        className="h-[478px] resize-none overflow-y-auto font-mono text-xs"
                        placeholder='[{"title":"","description":"","image":""}]'
                      />
                    </CardContent>
                  </Card>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="compose">
          <Card className="hidden">
            <CardHeader className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="text-base">Add from Scheduled Posts</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedSourcePosts.length} selected · {sourceCandidates.length} available
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={toggleAllSourcePosts}
                  disabled={sourceCandidates.length === 0}
                >
                  {selectedSourcePosts.length === sourceCandidates.length && sourceCandidates.length > 0
                    ? 'Clear'
                    : 'Select All'}
                </Button>
                <Button
                  type="button"
                  onClick={createElementsFromPosts}
                  disabled={selectedSourcePosts.length === 0}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Create Elements
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div className="space-y-2">
                  <Label>Page</Label>
                  <Select
                    value={sourcePageId}
                    onValueChange={(value) => {
                      setSourcePageId(value)
                      setSelectedPostIds([])
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All pages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pages</SelectItem>
                      {pages.map((page) => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!sourceShowAll && (
                  <div className="space-y-2">
                    <Label htmlFor="compose-source-date">Date</Label>
                    <Input
                      id="compose-source-date"
                      type="date"
                      value={sourceDate}
                      onChange={(event) => {
                        setSourceDate(event.target.value)
                        setSelectedPostIds([])
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={sourceStatus}
                    onValueChange={(value) => {
                      setSourceStatus(value as PostStatus | 'all')
                      setSelectedPostIds([])
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Post status" />
                    </SelectTrigger>
                    <SelectContent>
                      {postStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status === 'all'
                            ? 'All statuses'
                            : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!sourceShowAll && (
                  <div className="space-y-2">
                    <Label htmlFor="compose-source-start-time">Start time</Label>
                    <Input
                      id="compose-source-start-time"
                      type="time"
                      value={sourceStartTime}
                      onChange={(event) => {
                        setSourceStartTime(event.target.value)
                        setSelectedPostIds([])
                      }}
                    />
                  </div>
                )}

                <div className="flex items-end">
                  <label className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-border px-3">
                    <span className="text-sm font-medium">Show all</span>
                    <Switch
                      checked={sourceShowAll}
                      onCheckedChange={(checked) => {
                        setSourceShowAll(checked)
                        setSelectedPostIds([])
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="grid max-h-[240px] gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {sourceCandidates.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No posts with images found for this date and time.
                  </div>
                ) : (
                  sourceCandidates.map((post) => (
                    <label
                      key={post.id}
                      className="group flex cursor-pointer gap-2 rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent/40"
                    >
                      {(post.imageUrl || post.imagePath) && (
                        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-secondary">
                          <img
                            src={post.imageUrl ?? post.imagePath}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute left-1 top-1">
                            <Checkbox
                              checked={selectedPostIds.includes(post.id)}
                              onCheckedChange={() => toggleSourcePost(post.id)}
                              className="border-background bg-background/90 shadow"
                            />
                          </div>
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex min-w-0 items-center gap-1.5 text-xs">
                          <span className="truncate font-medium text-foreground">{getPageName(post.pageId)}</span>
                          <span className="shrink-0 font-mono text-primary">{post.timeSlot}</span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {post.caption || 'No caption yet'}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="border-border bg-card">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Elements</CardTitle>
                  <Button type="button" size="sm" onClick={addElement}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Page</Label>
                      <Select
                        value={sourcePageId}
                        onValueChange={(value) => {
                          setSourcePageId(value)
                          setSelectedPostIds([])
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All pages" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All pages</SelectItem>
                          {pages.map((page) => (
                            <SelectItem key={page.id} value={page.id}>
                              {page.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={sourceStatus}
                        onValueChange={(value) => {
                          setSourceStatus(value as PostStatus | 'all')
                          setSelectedPostIds([])
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Post status" />
                        </SelectTrigger>
                        <SelectContent>
                          {postStatusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status === 'all'
                                ? 'All statuses'
                                : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {!sourceShowAll && (
                      <div className="space-y-2">
                        <Label htmlFor="elements-source-date">Date</Label>
                        <Input
                          id="elements-source-date"
                          type="date"
                          value={sourceDate}
                          onChange={(event) => {
                            setSourceDate(event.target.value)
                            setSelectedPostIds([])
                          }}
                        />
                      </div>
                    )}

                    {!sourceShowAll && (
                      <div className="space-y-2">
                        <Label htmlFor="elements-source-start-time">Start time</Label>
                        <Input
                          id="elements-source-start-time"
                          type="time"
                          value={sourceStartTime}
                          onChange={(event) => {
                            setSourceStartTime(event.target.value)
                            setSelectedPostIds([])
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <label className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-border px-3">
                    <span className="text-sm font-medium">Show all</span>
                    <Switch
                      checked={sourceShowAll}
                      onCheckedChange={(checked) => {
                        setSourceShowAll(checked)
                        setSelectedPostIds([])
                      }}
                    />
                  </label>

                </div>

                <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {filteredDraftEntries.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No elements match this filter.
                    </div>
                  ) : filteredDraftEntries.map(({ draft, index, sourcePost }) => {
                    const warningCount = draftWarningCounts[index] ?? 0
                    const shouldShake = validationPulse > 0 && warningCount > 0
                    const imageUrl = draft.image || sourcePost?.imageUrl || sourcePost?.imagePath || ''
                    const pageName = sourcePost ? getPageName(sourcePost.pageId) : 'No target post'
                    const dateLabel = sourcePost?.postDate ?? ''
                    const timeLabel = sourcePost?.timeSlot ?? `Element ${index + 1}`
                    const previewText = draft.postCaption || draft.title || 'No caption yet'

                    return (
                      <button
                        key={`${index}-${shouldShake ? validationPulse : 'idle'}`}
                        type="button"
                        onClick={() => selectElement(index)}
                        className={`group flex w-full min-w-0 gap-2 rounded-md border bg-background p-2 text-left transition-colors ${
                          shouldShake
                            ? 'border-red-500 bg-red-500/10 text-red-700 shadow-sm shadow-red-500/20 dark:text-red-300'
                            : index === activeIndex
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                        style={shouldShake ? { animation: 'composer-shake 260ms ease-in-out' } : undefined}
                      >
                        {imageUrl ? (
                          <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded bg-secondary">
                            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded bg-secondary">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="flex min-w-0 items-center justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-foreground">{pageName}</span>
                            <span className="shrink-0 font-mono text-primary">{timeLabel}</span>
                          </span>
                          {dateLabel ? (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {dateLabel}
                            </span>
                          ) : null}
                          <span className="block truncate text-xs text-muted-foreground">
                            {previewText}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            {sourcePost ? <StatusBadge status={sourcePost.status} size="sm" /> : null}
                            {warningCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                {warningCount}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={removeActiveElement}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-lg">Editor</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Element {activeIndex + 1} of {drafts.length} · {wordCount} words
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => insertHtml('<h2>Heading</h2>')}>
                      <Heading2 className="mr-2 h-4 w-4" />
                      H2
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertHtml('<p>Paragraph...</p>')}>
                      <Pilcrow className="mr-2 h-4 w-4" />
                      P
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertHtml('<p><strong>Bold text</strong></p>')}>
                      <Bold className="mr-2 h-4 w-4" />
                      Bold
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertHtml('<ul><li>Item</li></ul>')}>
                      <List className="mr-2 h-4 w-4" />
                      List
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={resetComposer}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    {activeDraftWarnings.length > 0 ? (
                      <div
                        key={validationPulse > 0 ? validationPulse : 'warning-panel'}
                        className={`rounded-md border p-3 text-sm ${
                          validationPulse > 0
                            ? 'border-red-500 bg-red-500/10 shadow-sm shadow-red-500/20'
                            : 'border-amber-500/30 bg-amber-500/10'
                        }`}
                        style={validationPulse > 0 ? { animation: 'composer-shake 260ms ease-in-out' } : undefined}
                      >
                        <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                          <AlertTriangle className="h-4 w-4" />
                          Important fields are missing
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {activeDraftWarnings.map((warning) => (
                            <span
                              key={warning}
                              className="rounded-full border border-amber-500/30 bg-background/70 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-200"
                            >
                              {warning}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="composer-title">Title</Label>
                      <Input
                        id="composer-title"
                        value={activeDraft.title}
                        onChange={(event) => updateActiveDraft({ title: event.target.value })}
                        onBlur={normalizeActiveTitle}
                        placeholder="Article title"
                        className={isMissingTitle ? 'border-red-500 ring-1 ring-red-500' : undefined}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Description editor</Label>
                        <span className="text-xs text-muted-foreground">{wordCount} words</span>
                      </div>
                      <div
                        className={
                          isMissingDescription
                            ? 'rounded-md border border-red-500 ring-1 ring-red-500'
                            : undefined
                        }
                      >
                        <TinyMceHtmlEditor
                          value={activeDraft.description}
                          onChange={(description) => updateActiveDraft({ description })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-md border border-border bg-background">
                      {activeDraft.image ? (
                        <img
                          src={activeDraft.image}
                          alt=""
                          className="aspect-[4/5] w-full bg-secondary object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/5] w-full items-center justify-center bg-secondary">
                          <ImageIcon className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                      <div className="space-y-3 border-t border-border p-3">
                        <div className="space-y-2">
                          <Label htmlFor="composer-image">Thumbnail image URL</Label>
                          <Input
                            id="composer-image"
                            value={activeDraft.image}
                            onChange={(event) => updateActiveDraft({ image: event.target.value })}
                            placeholder="https://..."
                            className={isMissingThumbnail ? 'border-red-500 ring-1 ring-red-500' : undefined}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="composer-description-image">Article image URL</Label>
                          <Input
                            id="composer-description-image"
                            value={activeDraft.descriptionImage}
                            onChange={(event) => updateActiveDraft({ descriptionImage: event.target.value })}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-border p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <Label htmlFor="composer-title-prefix-enabled" className="text-sm">
                          Title prefix
                        </Label>
                        <Switch
                          id="composer-title-prefix-enabled"
                          checked={titlePrefixEnabled}
                          onCheckedChange={setTitlePrefixEnabled}
                        />
                      </div>
                      <Input
                        id="composer-title-prefix"
                        value={titlePrefix}
                        onChange={(event) => setTitlePrefix(event.target.value)}
                        onBlur={(event) => setTitlePrefix(event.target.value.trim() || 'VT')}
                        disabled={!titlePrefixEnabled}
                        className="h-8"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Caption target post</Label>
                      <Select
                        value={activeDraft.sourcePostId || 'none'}
                        onValueChange={(value) => {
                          const post = posts.find((item) => item.id === value)
                          updateActiveDraft({
                            sourcePostId: value === 'none' ? '' : value,
                            postCaption: value === 'none' ? '' : post?.caption ?? '',
                          })
                        }}
                      >
                        <SelectTrigger className={`w-full ${isMissingTargetPost ? 'border-red-500 ring-1 ring-red-500' : ''}`}>
                          <SelectValue placeholder="Select post" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No post</SelectItem>
                          {captionTargetPosts.map((post) => (
                            <SelectItem key={post.id} value={post.id}>
                              {post.postDate} {post.timeSlot} - {getPageName(post.pageId)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {activeSourcePost ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge status={activeSourcePost.status} size="sm" />
                          <span>{activeSourcePost.adsLink ? 'Has ads link' : 'No ads link'}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="composer-post-caption">Post caption</Label>
                        <span className="text-xs text-muted-foreground">
                          {activeDraft.postCaption.trim().length} chars
                        </span>
                      </div>
                      <Textarea
                        id="composer-post-caption"
                        value={activeDraft.postCaption}
                        onChange={(event) => updateActiveDraft({ postCaption: event.target.value })}
                        className={`h-44 resize-none overflow-y-auto ${
                          isMissingPostCaption ? 'border-red-500 ring-1 ring-red-500' : ''
                        }`}
                        placeholder="Caption to save into the selected Scheduler post..."
                        disabled={!activeDraft.sourcePostId}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sources">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">From Scheduled Posts</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedSourcePosts.length} selected · {sourceCandidates.length} available
                </p>
              </div>
              <Button
                type="button"
                onClick={createElementsFromPosts}
                disabled={selectedSourcePosts.length === 0}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Create Elements
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div className="space-y-2">
                  <Label>Page</Label>
                  <Select
                    value={sourcePageId}
                    onValueChange={(value) => {
                      setSourcePageId(value)
                      setSelectedPostIds([])
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All pages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pages</SelectItem>
                      {pages.map((page) => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!sourceShowAll && (
                  <div className="space-y-2">
                    <Label htmlFor="source-date">Date</Label>
                    <Input
                      id="source-date"
                      type="date"
                      value={sourceDate}
                      onChange={(event) => {
                        setSourceDate(event.target.value)
                        setSelectedPostIds([])
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={sourceStatus}
                    onValueChange={(value) => {
                      setSourceStatus(value as PostStatus | 'all')
                      setSelectedPostIds([])
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Post status" />
                    </SelectTrigger>
                    <SelectContent>
                      {postStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status === 'all'
                            ? 'All statuses'
                            : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!sourceShowAll && (
                  <div className="space-y-2">
                    <Label htmlFor="source-start-time">Start time</Label>
                    <Input
                      id="source-start-time"
                      type="time"
                      value={sourceStartTime}
                      onChange={(event) => {
                        setSourceStartTime(event.target.value)
                        setSelectedPostIds([])
                      }}
                    />
                  </div>
                )}

                <div className="flex items-end">
                  <label className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <span className="text-sm font-medium">Show all</span>
                    <Switch
                      checked={sourceShowAll}
                      onCheckedChange={(checked) => {
                        setSourceShowAll(checked)
                        setSelectedPostIds([])
                      }}
                    />
                  </label>
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={toggleAllSourcePosts}
                    disabled={sourceCandidates.length === 0}
                  >
                    {selectedSourcePosts.length === sourceCandidates.length && sourceCandidates.length > 0
                      ? 'Clear'
                      : 'Select All'}
                  </Button>
                </div>
              </div>

              <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {sourceCandidates.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No posts with images found for this date and time.
                  </div>
                ) : (
                  sourceCandidates.map((post) => (
                    <label
                      key={post.id}
                      className="flex cursor-pointer gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={selectedPostIds.includes(post.id)}
                        onCheckedChange={() => toggleSourcePost(post.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-mono text-primary">{post.timeSlot}</span>
                          <span className="text-muted-foreground">{getPageName(post.pageId)}</span>
                          <StatusBadge status={post.status} size="sm" />
                        </div>
                        <p className="truncate text-sm text-foreground">
                          {post.caption || 'No caption yet'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {post.imageUrl ?? post.imagePath}
                        </p>
                      </div>
                      {(post.imageUrl || post.imagePath) && (
                        <img
                          src={post.imageUrl ?? post.imagePath}
                          alt=""
                          className="h-12 w-12 rounded object-cover"
                        />
                      )}
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={copyDescription}>
                <Clipboard className="mr-2 h-4 w-4" />
                Copy Active HTML
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[760px] space-y-6 overflow-y-auto pr-2">
                {drafts.map((draft, index) => (
                  <div key={index} className="grid gap-6 border-b border-border pb-6 last:border-0 last:pb-0 lg:grid-cols-[220px_1fr]">
                    <div className="overflow-hidden rounded-lg border border-border bg-secondary">
                      {draft.image ? (
                        <img src={draft.image} alt="" className="aspect-[4/5] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[4/5] items-center justify-center">
                          <ImageIcon className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <article className="min-w-0 space-y-4">
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Element {index + 1}</p>
                        <h2 className="text-2xl font-semibold leading-tight text-foreground">
                          {draft.title
                            ? ensureTitlePrefix(draft.title, titlePrefix, titlePrefixEnabled)
                            : 'Untitled article'}
                        </h2>
                      </div>
                      <div
                        className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground"
                        dangerouslySetInnerHTML={{ __html: draft.description || '<p>No content yet.</p>' }}
                      />
                    </article>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import type { Post } from '@/lib/types'
import {
  Bold,
  Clipboard,
  Code2,
  Eye,
  Heading2,
  Image as ImageIcon,
  List,
  Pilcrow,
  Plus,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-react'

type ArticleDraft = {
  title: string
  description: string
  image: string
  descriptionImage: string
}

const emptyDraft: ArticleDraft = {
  title: '',
  description: '',
  image: '',
  descriptionImage: '',
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

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const escapedBlock = escapeHtml(block).replaceAll('\n', '<br>')
      return isLikelyHeading(block, index) ? `<h2>${escapedBlock}</h2>` : `<p>${escapedBlock}</p>`
    })
    .join('')
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

function buildJson(drafts: ArticleDraft[]) {
  return JSON.stringify(
    drafts.map((draft) => ({
      title: draft.title.trim(),
      description: draft.description.trim(),
      image: draft.image.trim(),
      ...(draft.descriptionImage.trim()
        ? { descriptionImage: draft.descriptionImage.trim() }
        : {}),
    })),
    null,
    2
  )
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
  })
}

export function ArticleComposer() {
  const posts = useAppStore((state) => state.posts)
  const pages = useAppStore((state) => state.pages)
  const storeSelectedDate = useAppStore((state) => state.selectedDate)
  const [drafts, setDrafts] = useState<ArticleDraft[]>([createDraft()])
  const [activeIndex, setActiveIndex] = useState(0)
  const [plainText, setPlainText] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [sourcePageId, setSourcePageId] = useState('all')
  const [sourceDate, setSourceDate] = useState(storeSelectedDate)
  const [sourceStartTime, setSourceStartTime] = useState('00:00')
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([])

  const activeDraft = drafts[activeIndex] ?? drafts[0] ?? createDraft()
  const generatedJson = useMemo(() => buildJson(drafts), [drafts])
  const wordCount = useMemo(() => getWordCount(activeDraft.description), [activeDraft.description])
  const sourceCandidates = useMemo(() => {
    const startMinutes = parseTimeSlotMinutes(sourceStartTime) ?? 0

    return posts
      .filter((post) => {
        if (post.postDate !== sourceDate) return false
        if (sourcePageId !== 'all' && post.pageId !== sourcePageId) return false
        if (!post.imageUrl && !post.imagePath) return false

        const postMinutes = parseTimeSlotMinutes(post.timeSlot)
        return postMinutes === null || postMinutes >= startMinutes
      })
      .sort(comparePostsBySchedule)
  }, [posts, sourceDate, sourcePageId, sourceStartTime])

  const selectedSourcePosts = useMemo(
    () => sourceCandidates.filter((post) => selectedPostIds.includes(post.id)),
    [sourceCandidates, selectedPostIds]
  )

  const getPageName = (pageId: string) => {
    return pages.find((page) => page.id === pageId)?.name ?? 'Unknown page'
  }

  const updateActiveDraft = (updates: Partial<ArticleDraft>) => {
    setDrafts((current) =>
      current.map((draft, index) => (index === activeIndex ? { ...draft, ...updates } : draft))
    )
  }

  const addElement = () => {
    setDrafts((current) => {
      const next = [...current, createDraft()]
      setActiveIndex(next.length - 1)
      return next
    })
    setPlainText('')
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

    const newDrafts = selectedSourcePosts.map((post) =>
      createDraft({
        image: post.imageUrl ?? post.imagePath ?? '',
      })
    )

    setDrafts((current) => {
      const shouldReplaceBlank = current.length === 1 && isBlankDraft(current[0])
      const next = shouldReplaceBlank ? newDrafts : [...current, ...newDrafts]
      setActiveIndex(shouldReplaceBlank ? 0 : current.length)
      return next
    })
    setPlainText('')
    toast({ title: `${newDrafts.length} element${newDrafts.length > 1 ? 's' : ''} created` })
  }

  const removeActiveElement = () => {
    if (drafts.length === 1) {
      setDrafts([createDraft()])
      setActiveIndex(0)
      setPlainText('')
      return
    }

    setDrafts((current) => current.filter((_, index) => index !== activeIndex))
    setActiveIndex((current) => Math.max(0, current - 1))
    setPlainText('')
  }

  const insertHtml = (snippet: string) => {
    updateActiveDraft({
      description: `${activeDraft.description}${activeDraft.description ? '\n' : ''}${snippet}`,
    })
  }

  const convertPlainText = () => {
    updateActiveDraft({ description: plainTextToHtml(plainText) })
  }

  const copyJson = async () => {
    await navigator.clipboard.writeText(generatedJson)
    toast({ title: 'JSON copied' })
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
    setPlainText('')
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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg">Draft</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={addElement}>
                <Plus className="mr-2 h-4 w-4" />
                Add Element
              </Button>
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
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                <Label>Elements</Label>
                <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                  {drafts.map((draft, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setActiveIndex(index)
                        setPlainText('')
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        index === activeIndex
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      <span className="block font-medium">Element {index + 1}</span>
                      <span className="block truncate text-xs">
                        {draft.title || 'Untitled'}
                      </span>
                    </button>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={removeActiveElement}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="composer-title">Title</Label>
                  <Input
                    id="composer-title"
                    value={activeDraft.title}
                    onChange={(event) => updateActiveDraft({ title: event.target.value })}
                    placeholder="Article title"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="composer-image">Thumbnail image URL</Label>
                    <Input
                      id="composer-image"
                      value={activeDraft.image}
                      onChange={(event) => updateActiveDraft({ image: event.target.value })}
                      placeholder="https://..."
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="composer-description">Description HTML</Label>
                    <span className="text-xs text-muted-foreground">{wordCount} words</span>
                  </div>
                  <Textarea
                    id="composer-description"
                    value={activeDraft.description}
                    onChange={(event) => updateActiveDraft({ description: event.target.value })}
                    className="h-[360px] resize-none overflow-y-auto font-mono text-sm"
                    placeholder="<p>Article content...</p>"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <Textarea
                    value={plainText}
                    onChange={(event) => setPlainText(event.target.value)}
                    className="h-28 resize-none overflow-y-auto"
                    placeholder="Paste plain text..."
                  />
                  <Button type="button" variant="secondary" className="lg:self-end" onClick={convertPlainText}>
                    <Code2 className="mr-2 h-4 w-4" />
                    Convert HTML
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">From Scheduled Posts</CardTitle>
              <Button
                type="button"
                size="sm"
                onClick={createElementsFromPosts}
                disabled={selectedSourcePosts.length === 0}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Create Elements
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
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

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">JSON</CardTitle>
              <Button type="button" size="sm" onClick={copyJson}>
                <Clipboard className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea value={generatedJson} readOnly className="h-[320px] resize-none overflow-y-auto font-mono text-xs" />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Import</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={handleImportJson}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Load
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                className="h-40 resize-none overflow-y-auto font-mono text-xs"
                placeholder='[{"title":"","description":"","image":""}]'
              />
            </CardContent>
          </Card>
        </div>
      </div>

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
          <div className="max-h-[680px] space-y-6 overflow-y-auto pr-2">
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
                      {draft.title || 'Untitled article'}
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
    </div>
  )
}

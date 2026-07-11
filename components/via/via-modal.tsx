"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { uploadViaAvatarImage } from '@/lib/supabase'
import type { FacebookPage, ViaAccount, ViaInput, ViaLocation, ViaStatus } from '@/lib/types'

type ViaModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  via?: ViaAccount | null
  pages: FacebookPage[]
  isSaving: boolean
  onSave: (value: ViaInput) => Promise<void>
}

const defaultViaInput: ViaInput = {
  accountName: '',
  accountLink: '',
  accountPassword: '',
  displayName: '',
  twoFactorCode: '',
  outlookEmail: '',
  outlookPassword: '',
  viaEmail: '',
  avatarUrl: '',
  description: '',
  notes: '',
  status: 'active',
  location: 'personal_laptop',
  pageIds: [],
}

function toLabel(value: ViaStatus | ViaLocation) {
  switch (value) {
    case 'active':
      return 'Active'
    case 'inactive':
      return 'Inactive'
    case 'checkpoint':
      return 'Checkpoint'
    case 'personal_laptop':
      return 'Laptop'
    case 'company_computer':
      return 'Company Computer'
  }
}

function extractImageFileFromClipboard(event: React.ClipboardEvent) {
  for (const item of Array.from(event.clipboardData.items)) {
    if (!item.type.startsWith('image/')) continue

    const file = item.getAsFile()
    if (file) return file
  }

  return null
}

export function ViaModal({
  open,
  onOpenChange,
  via,
  pages,
  isSaving,
  onSave,
}: ViaModalProps) {
  const [formData, setFormData] = useState<ViaInput>(defaultViaInput)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setSelectedAvatarFile(null)
    setAvatarPreviewUrl('')
    setErrorMessage('')

    if (via) {
      setFormData({
        accountName: via.accountName,
        accountLink: via.accountLink,
        accountPassword: via.accountPassword,
        displayName: via.displayName,
        twoFactorCode: via.twoFactorCode,
        outlookEmail: via.outlookEmail,
        outlookPassword: via.outlookPassword,
        viaEmail: via.viaEmail,
        avatarUrl: via.avatarUrl || '',
        description: via.description,
        notes: via.notes,
        status: via.status,
        location: via.location,
        pageIds: [...via.pageIds],
      })
      return
    }

    setFormData(defaultViaInput)
  }, [open, via])

  useEffect(() => {
    if (!selectedAvatarFile) {
      setAvatarPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(selectedAvatarFile)
    setAvatarPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedAvatarFile])

  const linkedPages = useMemo(
    () => pages.filter((page) => formData.pageIds.includes(page.id)),
    [formData.pageIds, pages]
  )

  const togglePage = (pageId: string, checked: boolean) => {
    setFormData((current) => ({
      ...current,
      pageIds: checked
        ? [...current.pageIds, pageId]
        : current.pageIds.filter((id) => id !== pageId),
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage('')

    try {
      setIsUploadingAvatar(Boolean(selectedAvatarFile))
      let avatarUrl = formData.avatarUrl?.trim() || ''

      if (selectedAvatarFile) {
        const uploadedAvatar = await uploadViaAvatarImage(selectedAvatarFile)
        avatarUrl = uploadedAvatar.imageUrl
      }

      await onSave({
        ...formData,
        accountName: formData.accountName.trim(),
        accountLink: formData.accountLink.trim(),
        accountPassword: formData.accountPassword.trim(),
        displayName: formData.displayName.trim(),
        twoFactorCode: formData.twoFactorCode.trim(),
        outlookEmail: formData.outlookEmail.trim(),
        outlookPassword: formData.outlookPassword.trim(),
        viaEmail: formData.viaEmail.trim(),
        avatarUrl,
        description: formData.description.trim(),
        notes: formData.notes.trim(),
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not upload avatar image.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleAvatarPaste = (event: React.ClipboardEvent) => {
    const imageFile = extractImageFileFromClipboard(event)
    if (!imageFile) return

    event.preventDefault()
    setErrorMessage('')
    setSelectedAvatarFile(imageFile)
  }

  const avatarPreview = avatarPreviewUrl || formData.avatarUrl || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{via ? 'Edit Via' : 'Add Via'}</DialogTitle>
          <DialogDescription>
            Store via account details, credentials, and page relationships.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="via-account-name">Account Name</Label>
              <Input
                id="via-account-name"
                value={formData.accountName}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, accountName: event.target.value }))
                }
                placeholder="via.username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="via-account-link">Via Link</Label>
              <Input
                id="via-account-link"
                value={formData.accountLink}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, accountLink: event.target.value }))
                }
                placeholder="https://facebook.com/..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="via-account-password">Password</Label>
              <Input
                id="via-account-password"
                value={formData.accountPassword}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, accountPassword: event.target.value }))
                }
                placeholder="Account password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="via-display-name">Display Name</Label>
              <Input
                id="via-display-name"
                value={formData.displayName}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="Owner or profile name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="via-2fa">2FA</Label>
              <Input
                id="via-2fa"
                value={formData.twoFactorCode}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, twoFactorCode: event.target.value }))
                }
                placeholder="2FA code or secret"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="via-outlook-email">Outlook Email</Label>
              <Input
                id="via-outlook-email"
                value={formData.outlookEmail}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, outlookEmail: event.target.value }))
                }
                placeholder="outlook@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="via-outlook-password">Mail Password</Label>
              <Input
                id="via-outlook-password"
                value={formData.outlookPassword}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, outlookPassword: event.target.value }))
                }
                placeholder="Mailbox password"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="via-email">Via Email</Label>
              <Input
                id="via-email"
                value={formData.viaEmail}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, viaEmail: event.target.value }))
                }
                placeholder="Email linked to this via"
              />
            </div>
            <div className="space-y-2" onPaste={handleAvatarPaste}>
              <Label htmlFor="via-avatar-url">Avatar URL</Label>
              <div className="flex gap-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt=""
                    className="h-11 w-11 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary text-xs font-semibold text-foreground">
                    {formData.displayName.slice(0, 2).toUpperCase() || 'VA'}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    id="via-avatar-url"
                    value={formData.avatarUrl || ''}
                    onChange={(event) => {
                      setSelectedAvatarFile(null)
                      setFormData((current) => ({ ...current, avatarUrl: event.target.value }))
                    }}
                    placeholder="Paste image here or enter URL"
                  />
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setSelectedAvatarFile(event.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Copy an image and paste it here. It uploads to storage when you save.
              </p>
              {selectedAvatarFile && (
                <p className="text-xs text-muted-foreground">{selectedAvatarFile.name}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="via-description">Description</Label>
              <Textarea
                id="via-description"
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Short context about this via"
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="via-notes">Notes</Label>
              <Textarea
                id="via-notes"
                value={formData.notes}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Extra reminders, warnings, or account details"
                className="min-h-24"
              />
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: ViaStatus) =>
                  setFormData((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{toLabel('active')}</SelectItem>
                  <SelectItem value="inactive">{toLabel('inactive')}</SelectItem>
                  <SelectItem value="checkpoint">{toLabel('checkpoint')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={formData.location}
                onValueChange={(value: ViaLocation) =>
                  setFormData((current) => ({ ...current, location: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal_laptop">{toLabel('personal_laptop')}</SelectItem>
                  <SelectItem value="company_computer">{toLabel('company_computer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">Linked Pages</p>
                <p className="text-sm text-muted-foreground">
                  One via can link to many pages, and each page can link to many vias.
                </p>
              </div>
              <span className="text-sm text-muted-foreground">{linkedPages.length} pages</span>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pages available to link yet.</p>
              ) : (
                pages.map((page) => (
                  <label
                    key={page.id}
                    className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
                  >
                    <Checkbox
                      checked={formData.pageIds.includes(page.id)}
                      onCheckedChange={(checked) => togglePage(page.id, checked === true)}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{page.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{page.pageUrl}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSaving ||
                isUploadingAvatar ||
                formData.accountName.trim().length === 0 ||
                formData.accountPassword.trim().length === 0 ||
                formData.displayName.trim().length === 0
              }
            >
              {isUploadingAvatar ? 'Uploading avatar...' : isSaving ? 'Saving...' : via ? 'Save Via' : 'Create Via'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

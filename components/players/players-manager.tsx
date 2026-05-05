"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  Users,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import {
  createSportsPlayerRemote,
  createSportsPlayersBulkRemote,
  createSportsTeamRemote,
  deleteSportsPlayerRemote,
  deleteSportsTeamRemote,
  fetchSportsPlayersRemote,
  fetchSportsTeamsRemote,
  isSupabaseConfigured,
  updateSportsPlayerRemote,
  updateSportsTeamRemote,
} from '@/lib/supabase'
import type {
  PlayerStatus,
  SportsPlayer,
  SportsPlayerInput,
  SportsTeam,
  SportsTeamInput,
  SportType,
} from '@/lib/types'

type Language = 'en' | 'vi'

const copy = {
  en: {
    title: 'Team',
    description: 'Manage sports teams and player profile cards.',
    addTeam: 'Add Team',
    addPlayer: 'Add Player',
    teams: 'Teams',
    players: 'Players',
    search: 'Search teams, players, coaches...',
    allTeams: 'All Teams',
    noTeams: 'No teams yet',
    noPlayers: 'No players yet',
    supabaseRequired: 'Supabase required',
    supabaseDescription: 'Configure Supabase and run the updated schema to store teams and players.',
    owner: 'Owner',
    headCoach: 'Head Coach',
    assistantCoaches: 'Assistant Coaches',
    legends: 'Legends',
    family: 'Family',
    editTeam: 'Edit Team',
    editPlayer: 'Edit Player',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save',
    create: 'Create',
    saving: 'Saving...',
  },
  vi: {
    title: 'Đội bóng',
    description: 'Quản lý đội thể thao và thẻ thông tin cầu thủ.',
    addTeam: 'Thêm đội',
    addPlayer: 'Thêm cầu thủ',
    teams: 'Đội bóng',
    players: 'Cầu thủ',
    search: 'Tìm đội, cầu thủ, HLV...',
    allTeams: 'Tất cả đội',
    noTeams: 'Chưa có đội',
    noPlayers: 'Chưa có cầu thủ',
    supabaseRequired: 'Cần Supabase',
    supabaseDescription: 'Cấu hình Supabase và chạy schema mới để lưu đội bóng và cầu thủ.',
    owner: 'Chủ sở hữu',
    headCoach: 'HLV trưởng',
    assistantCoaches: 'Trợ lý HLV',
    legends: 'Huyền thoại',
    family: 'Gia đình',
    editTeam: 'Sửa đội',
    editPlayer: 'Sửa cầu thủ',
    delete: 'Xóa',
    cancel: 'Hủy',
    save: 'Lưu',
    create: 'Tạo',
    saving: 'Đang lưu...',
  },
} satisfies Record<Language, Record<string, string>>

const sportLabels: Record<SportType, string> = {
  baseball: 'Baseball',
  basketball: 'Basketball',
  football: 'Football',
  soccer: 'Soccer',
  other: 'Other',
}

const statusLabels: Record<PlayerStatus, string> = {
  active: 'Active',
  injured: 'Injured',
  inactive: 'Inactive',
  retired: 'Retired',
  left_team: 'Left Team',
}

const defaultTeamInput: SportsTeamInput = {
  name: '',
  sport: 'baseball',
  league: '',
  city: '',
  country: '',
  logoUrl: '',
  ownerName: '',
  headCoach: '',
  assistantCoaches: '',
  legends: '',
  notes: '',
}

const defaultPlayerInput: SportsPlayerInput = {
  teamId: '',
  fullName: '',
  position: '',
  jerseyNumber: '',
  birthDate: '',
  nationality: '',
  photoUrl: '',
  height: '',
  weight: '',
  status: 'active',
  spouse: '',
  father: '',
  mother: '',
  children: '',
  bio: '',
  notes: '',
}

function compactLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TM'
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

const playerStatuses: PlayerStatus[] = ['active', 'injured', 'inactive', 'retired', 'left_team']

function readOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readPlayerStatus(value: unknown): PlayerStatus {
  return typeof value === 'string' && playerStatuses.includes(value as PlayerStatus)
    ? (value as PlayerStatus)
    : 'active'
}

function buildPlayerInputsFromJson(value: unknown, teams: SportsTeam[]) {
  if (!Array.isArray(value)) {
    throw new Error('JSON must be an array of player objects.')
  }

  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const teamsByName = new Map(teams.map((team) => [team.name.trim().toLowerCase(), team]))
  const errors: string[] = []

  const inputs: Array<SportsPlayerInput | null> = value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Item ${index + 1}: must be an object.`)
      return null
    }

    const row = item as Record<string, unknown>
    const fullName = readOptionalString(row.fullName)
    const teamIdValue = readOptionalString(row.teamId)
    const teamName = readOptionalString(row.teamName)
    const matchedTeam = teamsById.get(teamIdValue) ?? teamsByName.get(teamName.toLowerCase())

    if (!fullName) {
      errors.push(`Item ${index + 1}: fullName is required.`)
    }
    if (!matchedTeam) {
      errors.push(`Item ${index + 1}: teamName or teamId must match an existing team.`)
    }

    if (!fullName || !matchedTeam) return null

    return {
      teamId: matchedTeam.id,
      fullName,
      position: readOptionalString(row.position),
      jerseyNumber: readOptionalString(row.jerseyNumber),
      birthDate: readOptionalString(row.birthDate),
      nationality: readOptionalString(row.nationality),
      photoUrl: readOptionalString(row.photoUrl),
      height: readOptionalString(row.height),
      weight: readOptionalString(row.weight),
      status: readPlayerStatus(row.status),
      spouse: readOptionalString(row.spouse),
      father: readOptionalString(row.father),
      mother: readOptionalString(row.mother),
      children: readOptionalString(row.children),
      bio: readOptionalString(row.bio),
      notes: readOptionalString(row.notes),
    } satisfies SportsPlayerInput
  })

  if (errors.length > 0) {
    throw new Error(errors.slice(0, 8).join('\n'))
  }

  return inputs.filter((input): input is SportsPlayerInput => input !== null)
}

type TeamModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: SportsTeam | null
  isSaving: boolean
  language: Language
  onSave: (value: SportsTeamInput) => Promise<void>
}

function TeamModal({ open, onOpenChange, team, isSaving, language, onSave }: TeamModalProps) {
  const text = copy[language]
  const [formData, setFormData] = useState<SportsTeamInput>(defaultTeamInput)

  useEffect(() => {
    if (!open) return
    setFormData(
      team
        ? {
            name: team.name,
            sport: team.sport,
            league: team.league,
            city: team.city,
            country: team.country,
            logoUrl: team.logoUrl || '',
            ownerName: team.ownerName,
            headCoach: team.headCoach,
            assistantCoaches: team.assistantCoaches,
            legends: team.legends,
            notes: team.notes,
          }
        : defaultTeamInput
    )
  }, [open, team])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onSave({
      ...formData,
      name: formData.name.trim(),
      league: formData.league.trim(),
      city: formData.city.trim(),
      country: formData.country.trim(),
      logoUrl: formData.logoUrl?.trim(),
      ownerName: formData.ownerName.trim(),
      headCoach: formData.headCoach.trim(),
      assistantCoaches: formData.assistantCoaches.trim(),
      legends: formData.legends.trim(),
      notes: formData.notes.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{team ? text.editTeam : text.addTeam}</DialogTitle>
          <DialogDescription>Store ownership, coaching staff, legends, and team notes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select value={formData.sport} onValueChange={(value: SportType) => setFormData((current) => ({ ...current, sport: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(sportLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>League</Label>
              <Input value={formData.league} onChange={(event) => setFormData((current) => ({ ...current, league: event.target.value }))} placeholder="MLB, NPB, KBO..." />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input value={formData.logoUrl || ''} onChange={(event) => setFormData((current) => ({ ...current, logoUrl: event.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={formData.city} onChange={(event) => setFormData((current) => ({ ...current, city: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={formData.country} onChange={(event) => setFormData((current) => ({ ...current, country: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{text.owner}</Label>
              <Input value={formData.ownerName} onChange={(event) => setFormData((current) => ({ ...current, ownerName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{text.headCoach}</Label>
              <Input value={formData.headCoach} onChange={(event) => setFormData((current) => ({ ...current, headCoach: event.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{text.assistantCoaches}</Label>
              <Textarea value={formData.assistantCoaches} onChange={(event) => setFormData((current) => ({ ...current, assistantCoaches: event.target.value }))} rows={4} placeholder="One name per line" />
            </div>
            <div className="space-y-2">
              <Label>{text.legends}</Label>
              <Textarea value={formData.legends} onChange={(event) => setFormData((current) => ({ ...current, legends: event.target.value }))} rows={4} placeholder="One name per line" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes} onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))} rows={4} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>{text.cancel}</Button>
            <Button type="submit" disabled={isSaving || formData.name.trim().length === 0}>{isSaving ? text.saving : team ? text.save : text.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type PlayerModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: SportsPlayer | null
  teams: SportsTeam[]
  isSaving: boolean
  language: Language
  onSave: (value: SportsPlayerInput) => Promise<void>
}

function PlayerModal({ open, onOpenChange, player, teams, isSaving, language, onSave }: PlayerModalProps) {
  const text = copy[language]
  const [formData, setFormData] = useState<SportsPlayerInput>(defaultPlayerInput)

  useEffect(() => {
    if (!open) return
    setFormData(
      player
        ? {
            teamId: player.teamId,
            fullName: player.fullName,
            position: player.position,
            jerseyNumber: player.jerseyNumber,
            birthDate: player.birthDate || '',
            nationality: player.nationality,
            photoUrl: player.photoUrl || '',
            height: player.height,
            weight: player.weight,
            status: player.status,
            spouse: player.spouse,
            father: player.father,
            mother: player.mother,
            children: player.children,
            bio: player.bio,
            notes: player.notes,
          }
        : { ...defaultPlayerInput, teamId: teams[0]?.id ?? '' }
    )
  }, [open, player, teams])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onSave({
      ...formData,
      fullName: formData.fullName.trim(),
      position: formData.position.trim(),
      jerseyNumber: formData.jerseyNumber.trim(),
      nationality: formData.nationality.trim(),
      photoUrl: formData.photoUrl?.trim(),
      height: formData.height.trim(),
      weight: formData.weight.trim(),
      spouse: formData.spouse.trim(),
      father: formData.father.trim(),
      mother: formData.mother.trim(),
      children: formData.children.trim(),
      bio: formData.bio.trim(),
      notes: formData.notes.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{player ? text.editPlayer : text.addPlayer}</DialogTitle>
          <DialogDescription>Store player details, family notes, and profile card information.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Full Name</Label>
              <Input value={formData.fullName} onChange={(event) => setFormData((current) => ({ ...current, fullName: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={formData.teamId} onValueChange={(value) => setFormData((current) => ({ ...current, teamId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={formData.position} onChange={(event) => setFormData((current) => ({ ...current, position: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Jersey Number</Label>
              <Input value={formData.jerseyNumber} onChange={(event) => setFormData((current) => ({ ...current, jerseyNumber: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value: PlayerStatus) => setFormData((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Birth Date</Label>
              <Input type="date" value={formData.birthDate || ''} onChange={(event) => setFormData((current) => ({ ...current, birthDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nationality</Label>
              <Input value={formData.nationality} onChange={(event) => setFormData((current) => ({ ...current, nationality: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Photo URL</Label>
              <Input value={formData.photoUrl || ''} onChange={(event) => setFormData((current) => ({ ...current, photoUrl: event.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Height</Label>
              <Input value={formData.height} onChange={(event) => setFormData((current) => ({ ...current, height: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Weight</Label>
              <Input value={formData.weight} onChange={(event) => setFormData((current) => ({ ...current, weight: event.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Spouse</Label><Input value={formData.spouse} onChange={(event) => setFormData((current) => ({ ...current, spouse: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Children</Label><Textarea value={formData.children} onChange={(event) => setFormData((current) => ({ ...current, children: event.target.value }))} rows={3} placeholder="One name per line" /></div>
            <div className="space-y-2"><Label>Father</Label><Input value={formData.father} onChange={(event) => setFormData((current) => ({ ...current, father: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Mother</Label><Input value={formData.mother} onChange={(event) => setFormData((current) => ({ ...current, mother: event.target.value }))} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Bio</Label><Textarea value={formData.bio} onChange={(event) => setFormData((current) => ({ ...current, bio: event.target.value }))} rows={5} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))} rows={5} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>{text.cancel}</Button>
            <Button type="submit" disabled={isSaving || formData.fullName.trim().length === 0 || !formData.teamId}>{isSaving ? text.saving : player ? text.save : text.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PlayersManager() {
  const [language, setLanguage] = useState<Language>('en')
  const text = copy[language]
  const [teams, setTeams] = useState<SportsTeam[]>([])
  const [players, setPlayers] = useState<SportsPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [playerModalOpen, setPlayerModalOpen] = useState(false)
  const [playerImportOpen, setPlayerImportOpen] = useState(false)
  const [playerImportJson, setPlayerImportJson] = useState('')
  const [playerImportError, setPlayerImportError] = useState('')
  const [editingTeam, setEditingTeam] = useState<SportsTeam | null>(null)
  const [editingPlayer, setEditingPlayer] = useState<SportsPlayer | null>(null)
  const [teamPendingDelete, setTeamPendingDelete] = useState<SportsTeam | null>(null)
  const [playerPendingDelete, setPlayerPendingDelete] = useState<SportsPlayer | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadData = async () => {
      try {
        const [remoteTeams, remotePlayers] = await Promise.all([
          fetchSportsTeamsRemote(),
          fetchSportsPlayersRemote(),
        ])
        if (!cancelled) {
          setTeams(remoteTeams)
          setPlayers(remotePlayers)
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Failed to load team data',
            description: getErrorMessage(error, 'Could not load teams and players.'),
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [])

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const normalizedQuery = query.trim().toLowerCase()
  const filteredTeams = useMemo(
    () =>
      teams.filter((team) => {
        if (!normalizedQuery) return true
        return [team.name, team.league, team.city, team.country, team.ownerName, team.headCoach, team.assistantCoaches, team.legends]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      }),
    [normalizedQuery, teams]
  )
  const filteredPlayers = useMemo(
    () =>
      players.filter((player) => {
        const team = teamById.get(player.teamId)
        if (teamFilter !== 'all' && player.teamId !== teamFilter) return false
        if (!normalizedQuery) return true
        return [player.fullName, player.position, player.nationality, player.spouse, player.father, player.mother, player.children, team?.name]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      }),
    [normalizedQuery, players, teamById, teamFilter]
  )

  const openTeamModal = (team: SportsTeam | null) => {
    setEditingTeam(team)
    setTeamModalOpen(true)
  }

  const openPlayerModal = (player: SportsPlayer | null) => {
    setEditingPlayer(player)
    setPlayerModalOpen(true)
  }

  const handleSaveTeam = async (value: SportsTeamInput) => {
    setIsSaving(true)
    try {
      if (editingTeam) {
        const updated = await updateSportsTeamRemote(editingTeam.id, value)
        setTeams((current) => current.map((team) => (team.id === updated.id ? updated : team)))
      } else {
        const created = await createSportsTeamRemote(value)
        setTeams((current) => [...current, created].sort((first, second) => first.name.localeCompare(second.name)))
      }
      setTeamModalOpen(false)
      setEditingTeam(null)
    } catch (error) {
      toast({ title: 'Failed to save team', description: getErrorMessage(error, 'Could not save team.'), variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePlayer = async (value: SportsPlayerInput) => {
    setIsSaving(true)
    try {
      if (editingPlayer) {
        const updated = await updateSportsPlayerRemote(editingPlayer.id, value)
        setPlayers((current) => current.map((player) => (player.id === updated.id ? updated : player)))
      } else {
        const created = await createSportsPlayerRemote(value)
        setPlayers((current) => [...current, created].sort((first, second) => first.fullName.localeCompare(second.fullName)))
      }
      setPlayerModalOpen(false)
      setEditingPlayer(null)
    } catch (error) {
      toast({ title: 'Failed to save player', description: getErrorMessage(error, 'Could not save player.'), variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportPlayers = async () => {
    setIsSaving(true)
    setPlayerImportError('')

    try {
      const parsed = JSON.parse(playerImportJson) as unknown
      const playerInputs = buildPlayerInputsFromJson(parsed, teams)

      if (playerInputs.length === 0) {
        throw new Error('No players were found in the JSON.')
      }

      const createdPlayers = await createSportsPlayersBulkRemote(playerInputs)
      setPlayers((current) =>
        [...current, ...createdPlayers].sort((first, second) =>
          first.fullName.localeCompare(second.fullName)
        )
      )
      setPlayerImportOpen(false)
      setPlayerImportJson('')
      toast({
        title: 'Players imported',
        description: `${createdPlayers.length} player${createdPlayers.length === 1 ? '' : 's'} created.`,
      })
    } catch (error) {
      const message = getErrorMessage(error, 'Could not import players.')
      setPlayerImportError(message)
      toast({ title: 'Failed to import players', description: message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!teamPendingDelete) return
    try {
      await deleteSportsTeamRemote(teamPendingDelete.id)
      setTeams((current) => current.filter((team) => team.id !== teamPendingDelete.id))
      setPlayers((current) => current.filter((player) => player.teamId !== teamPendingDelete.id))
      setTeamPendingDelete(null)
    } catch (error) {
      toast({ title: 'Failed to delete team', description: getErrorMessage(error, 'Could not delete team.'), variant: 'destructive' })
    }
  }

  const handleDeletePlayer = async () => {
    if (!playerPendingDelete) return
    try {
      await deleteSportsPlayerRemote(playerPendingDelete.id)
      setPlayers((current) => current.filter((player) => player.id !== playerPendingDelete.id))
      setPlayerPendingDelete(null)
    } catch (error) {
      toast({ title: 'Failed to delete player', description: getErrorMessage(error, 'Could not delete player.'), variant: 'destructive' })
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <Alert className="border-amber-400/50 bg-amber-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{text.supabaseRequired}</AlertTitle>
        <AlertDescription>{text.supabaseDescription}</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{text.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{text.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}>
              {language === 'en' ? 'VI' : 'EN'}
            </Button>
            <Button variant="outline" onClick={() => openTeamModal(null)}>
              <Plus className="mr-2 h-4 w-4" />
              {text.addTeam}
            </Button>
            <Button variant="outline" onClick={() => {
              setPlayerImportError('')
              setPlayerImportOpen(true)
            }} disabled={teams.length === 0}>
              <Upload className="mr-2 h-4 w-4" />
              Import JSON
            </Button>
            <Button onClick={() => openPlayerModal(null)} disabled={teams.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              {text.addPlayer}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} className="pl-9" />
            </div>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="lg:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{text.allTeams}</SelectItem>
                {teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="teams">
            <TabsList>
              <TabsTrigger value="teams">{text.teams} ({teams.length})</TabsTrigger>
              <TabsTrigger value="players">{text.players} ({players.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="teams" className="mt-5">
              {isLoading ? (
                <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
              ) : filteredTeams.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
                  <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">{text.noTeams}</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredTeams.map((team) => {
                    const playerCount = players.filter((player) => player.teamId === team.id).length
                    return (
                      <Card key={team.id} className="overflow-hidden border-border bg-background">
                        <CardContent className="p-0">
                          <div className="flex gap-4 p-4">
                            {team.logoUrl ? (
                              <img src={team.logoUrl} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-primary text-lg font-semibold text-primary-foreground">{initials(team.name)}</div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="truncate font-semibold text-foreground">{team.name}</h3>
                                  <p className="text-sm text-muted-foreground">{[team.city, team.country].filter(Boolean).join(', ') || '-'}</p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openTeamModal(team)}>{text.editTeam}</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setTeamPendingDelete(team)}><Trash2 className="mr-2 h-4 w-4" />{text.delete}</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant="outline">{sportLabels[team.sport]}</Badge>
                                {team.league ? <Badge variant="secondary">{team.league}</Badge> : null}
                                <Badge variant="outline"><Users className="mr-1 h-3 w-3" />{playerCount}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="grid gap-3 border-t border-border p-4 text-sm md:grid-cols-2">
                            <p><span className="text-muted-foreground">{text.owner}:</span> {team.ownerName || '-'}</p>
                            <p><span className="text-muted-foreground">{text.headCoach}:</span> {team.headCoach || '-'}</p>
                            <div>
                              <p className="text-muted-foreground">{text.assistantCoaches}</p>
                              <div className="mt-1 flex flex-wrap gap-1">{compactLines(team.assistantCoaches).slice(0, 4).map((name) => <Badge key={name} variant="outline">{name}</Badge>)}</div>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{text.legends}</p>
                              <div className="mt-1 flex flex-wrap gap-1">{compactLines(team.legends).slice(0, 4).map((name) => <Badge key={name} variant="secondary"><BadgeCheck className="mr-1 h-3 w-3" />{name}</Badge>)}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="players" className="mt-5">
              {isLoading ? (
                <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
              ) : filteredPlayers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
                  <UserRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">{text.noPlayers}</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredPlayers.map((player) => {
                    const team = teamById.get(player.teamId)
                    return (
                      <Card key={player.id} className="overflow-hidden border-border bg-background">
                        <CardContent className="p-0">
                          <div className="flex gap-4 p-4">
                            {player.photoUrl ? (
                              <img src={player.photoUrl} alt="" className="h-20 w-20 rounded-md border border-border object-cover" />
                            ) : (
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-xl font-semibold">{initials(player.fullName)}</div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="truncate font-semibold text-foreground">{player.fullName}</h3>
                                  <p className="truncate text-sm text-muted-foreground">{team?.name || 'Unknown Team'}</p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openPlayerModal(player)}>{text.editPlayer}</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setPlayerPendingDelete(player)}><Trash2 className="mr-2 h-4 w-4" />{text.delete}</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {player.jerseyNumber ? <Badge variant="default">#{player.jerseyNumber}</Badge> : null}
                                {player.position ? <Badge variant="outline">{player.position}</Badge> : null}
                                <Badge variant="secondary">{statusLabels[player.status]}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3 border-t border-border p-4 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <p><span className="text-muted-foreground">Nationality:</span> {player.nationality || '-'}</p>
                              <p><span className="text-muted-foreground">Born:</span> {player.birthDate || '-'}</p>
                              <p><span className="text-muted-foreground">Height:</span> {player.height || '-'}</p>
                              <p><span className="text-muted-foreground">Weight:</span> {player.weight || '-'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{text.family}</p>
                              <p className="mt-1 text-foreground">
                                {[player.spouse && `Spouse: ${player.spouse}`, player.father && `Father: ${player.father}`, player.mother && `Mother: ${player.mother}`].filter(Boolean).join(' | ') || '-'}
                              </p>
                              {player.children ? <p className="mt-1 text-muted-foreground">Children: {compactLines(player.children).join(', ')}</p> : null}
                            </div>
                            {player.bio ? <p className="line-clamp-3 text-muted-foreground">{player.bio}</p> : null}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={playerImportOpen} onOpenChange={setPlayerImportOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Players JSON</DialogTitle>
            <DialogDescription>
              Paste a JSON array. Each item must include fullName and either teamName or teamId.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Expected fields</p>
              <p className="mt-1">
                teamName, fullName, position, jerseyNumber, birthDate, nationality, photoUrl,
                height, weight, status, spouse, father, mother, children, bio, notes.
              </p>
              <p className="mt-1">
                status: active, injured, inactive, retired, left_team.
              </p>
            </div>
            <Textarea
              value={playerImportJson}
              onChange={(event) => {
                setPlayerImportJson(event.target.value)
                setPlayerImportError('')
              }}
              rows={16}
              placeholder={`[
  {
    "teamName": "${teams[0]?.name ?? 'Los Angeles Dodgers'}",
    "fullName": "Shohei Ohtani",
    "position": "Designated Hitter / Pitcher",
    "jerseyNumber": "17",
    "birthDate": "1994-07-05",
    "nationality": "Japan",
    "photoUrl": "https://example.com/player.jpg",
    "height": "6 ft 4 in",
    "weight": "210 lb",
    "status": "active",
    "spouse": "",
    "father": "",
    "mother": "",
    "children": "",
    "bio": "",
    "notes": ""
  }
]`}
              className="font-mono text-xs"
            />
            {playerImportError ? (
              <pre className="max-h-40 overflow-auto rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs whitespace-pre-wrap text-destructive">
                {playerImportError}
              </pre>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPlayerImportOpen(false)}
              disabled={isSaving}
            >
              {text.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => void handleImportPlayers()}
              disabled={isSaving || playerImportJson.trim().length === 0}
            >
              {isSaving ? text.saving : 'Import Players'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TeamModal open={teamModalOpen} onOpenChange={setTeamModalOpen} team={editingTeam} isSaving={isSaving} language={language} onSave={handleSaveTeam} />
      <PlayerModal open={playerModalOpen} onOpenChange={setPlayerModalOpen} player={editingPlayer} teams={teams} isSaving={isSaving} language={language} onSave={handleSavePlayer} />

      <AlertDialog open={teamPendingDelete !== null} onOpenChange={(open) => !open && setTeamPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>Delete &quot;{teamPendingDelete?.name}&quot; and all linked players?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{text.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleDeleteTeam() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{text.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={playerPendingDelete !== null} onOpenChange={(open) => !open && setPlayerPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Player</AlertDialogTitle>
            <AlertDialogDescription>Delete &quot;{playerPendingDelete?.fullName}&quot;?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{text.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleDeletePlayer() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{text.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

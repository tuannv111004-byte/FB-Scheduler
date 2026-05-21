"use client"

import { FormEvent, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        setError(result?.error || 'Cannot unlock the app.')
        return
      }

      const nextPath = new URLSearchParams(window.location.search).get('next') || '/'
      window.location.assign(nextPath.startsWith('/') ? nextPath : '/')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">PostOps Access</h1>
            <p className="text-sm text-muted-foreground">Enter the app password.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="access-password">Password</Label>
          <Input
            id="access-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="mt-5 w-full" disabled={isSubmitting || !password}>
          {isSubmitting ? 'Unlocking...' : 'Unlock'}
        </Button>
      </form>
    </main>
  )
}

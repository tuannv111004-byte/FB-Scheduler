"use client"

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

interface ThemeToggleProps {
  compact?: boolean
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size={compact ? 'icon' : 'sm'} disabled>
        <Moon className="h-4 w-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme !== 'light'

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? 'icon' : 'sm'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={compact ? '' : 'gap-2'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
    </Button>
  )
}

"use client"

import { useMemo } from 'react'
import { Bell, Search, AlertTriangle, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { format } from 'date-fns'
import Link from 'next/link'
import { MobileSidebar } from './mobile-sidebar'
import { ThemeToggle } from './theme-toggle'
import { useDesktopSidebar } from '@/hooks/use-desktop-sidebar'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const notifications = useAppStore((state) => state.notifications)
  const { isHidden, toggleSidebar } = useDesktopSidebar()
  const today = new Date()

  const { unreadCount, criticalCount } = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead)
    return {
      unreadCount: unread.length,
      criticalCount: unread.filter((n) => n.type === 'error' || n.type === 'warning').length
    }
  }, [notifications])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          onClick={toggleSidebar}
          title={isHidden ? 'Show sidebar' : 'Hide sidebar'}
          aria-label={isHidden ? 'Show sidebar' : 'Hide sidebar'}
        >
          {isHidden ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className="hidden sm:block text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search posts, pages..."
            className="w-64 bg-secondary pl-9"
          />
        </div>

        {/* Date */}
        <div className="hidden text-right lg:block">
          <p className="text-sm font-medium text-foreground">
            {format(today, 'EEEE')}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(today, 'MMM d, yyyy')}
          </p>
        </div>

        {/* Alerts badge */}
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-1.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {criticalCount} alerts
            </span>
          </div>
        )}

        <ThemeToggle compact />

        {/* Notifications */}
        <Link href="/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </Button>
        </Link>
      </div>
    </header>
  )
}

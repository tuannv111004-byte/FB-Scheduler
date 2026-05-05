"use client"

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Settings,
  Bell,
  Facebook,
  Film,
  PanelLeftClose,
  NotebookText,
  SearchCheck,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useDesktopSidebar } from '@/hooks/use-desktop-sidebar'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Pages', href: '/pages', icon: Facebook },
  { name: 'Posts', href: '/posts', icon: FileText },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Notes', href: '/notes', icon: NotebookText },
  { name: 'Poster Lab', href: '/poster-lab', icon: Film },
  { name: 'Team', href: '/players', icon: Trophy },
  { name: 'Sources', href: '/sources', icon: SearchCheck },
  { name: 'Via', href: '/via', icon: ShieldCheck },
]

export function Sidebar() {
  const pathname = usePathname()
  const notifications = useAppStore((state) => state.notifications)
  const pages = useAppStore((state) => state.pages)
  const { isHidden, hideSidebar } = useDesktopSidebar()
  
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications])
  const activePagesCount = useMemo(() => pages.filter((p) => p.isActive).length, [pages])

  return (
    <aside className={cn(
      "app-sidebar fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:flex",
      isHidden && '-translate-x-full'
    )}>
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Calendar className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">PostOps</h1>
          <p className="text-xs text-muted-foreground">FB Scheduler</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Menu
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}

        <div className="my-4 border-t border-sidebar-border" />

        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          System
        </p>
        <Link
          href="/notifications"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/notifications'
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <Bell className="h-5 w-5" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Link>
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        <button
          type="button"
          onClick={hideSidebar}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <PanelLeftClose className="h-5 w-5" />
          Hide Sidebar
        </button>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg bg-sidebar-accent p-3">
          <p className="text-xs text-muted-foreground">
            Connected Pages
          </p>
          <p className="text-lg font-semibold text-sidebar-foreground">
            {activePagesCount} Active
          </p>
        </div>
      </div>
    </aside>
  )
}

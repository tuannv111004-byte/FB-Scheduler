"use client"

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Settings,
  Bell,
  Facebook,
  Menu,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Pages', href: '/pages', icon: Facebook },
  { name: 'Posts', href: '/posts', icon: FileText },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
]

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const notifications = useAppStore((state) => state.notifications)
  
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
        <SheetHeader className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-sidebar-foreground">PostOps</SheetTitle>
              <p className="text-xs text-muted-foreground">FB Scheduler</p>
            </div>
          </div>
        </SheetHeader>

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
                onClick={() => setOpen(false)}
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
            onClick={() => setOpen(false)}
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
            onClick={() => setOpen(false)}
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
        </nav>
      </SheetContent>
    </Sheet>
  )
}

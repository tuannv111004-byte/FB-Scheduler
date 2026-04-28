"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  CheckCheck,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
}

const colorMap = {
  error: {
    icon: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  warning: {
    icon: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  info: {
    icon: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  success: {
    icon: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
}

export function NotificationsList() {
  const {
    notifications,
    pages,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useAppStore()

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const getPageName = (pageId?: string) => {
    if (!pageId) return null
    return pages.find((p) => p.id === pageId)?.name
  }

  const getNotificationLink = (notification: typeof notifications[0]) => {
    if (notification.postId) {
      return `/posts?post=${notification.postId}`
    }
    if (notification.pageId && notification.timeSlot) {
      return `/schedule?page=${notification.pageId}`
    }
    if (notification.pageId) {
      return `/pages`
    }
    return null
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllNotificationsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearNotifications}
              className="text-muted-foreground"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-secondary p-4">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground">No notifications at the moment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedNotifications.map((notification) => {
              const Icon = iconMap[notification.type]
              const colors = colorMap[notification.type]
              const pageName = getPageName(notification.pageId)
              const link = getNotificationLink(notification)

              return (
                <div
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-4 rounded-lg border p-4 transition-colors',
                    notification.isRead
                      ? 'border-border bg-secondary/20'
                      : cn(colors.border, colors.bg)
                  )}
                >
                  <div className={cn('rounded-lg p-2', colors.bg)}>
                    <Icon className={cn('h-5 w-5', colors.icon)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          notification.isRead ? 'text-muted-foreground' : 'text-foreground'
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          {pageName && (
                            <span className="text-xs text-muted-foreground">
                              Page: {pageName}
                            </span>
                          )}
                          {notification.timeSlot && (
                            <span className="text-xs text-muted-foreground">
                              Time: {notification.timeSlot}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {link && (
                          <Link href={link}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => markNotificationRead(notification.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

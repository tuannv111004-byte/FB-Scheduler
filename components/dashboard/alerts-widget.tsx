"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
}

const colorMap = {
  error: 'text-red-400 bg-red-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  info: 'text-blue-400 bg-blue-500/10',
  success: 'text-green-400 bg-green-500/10',
}

export function AlertsWidget() {
  const { notifications, markNotificationRead } = useAppStore()

  const unreadAlerts = notifications
    .filter((n) => !n.isRead && (n.type === 'error' || n.type === 'warning'))
    .slice(0, 5)

  if (unreadAlerts.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Priority Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
            <p className="mt-2 text-sm font-medium text-foreground">All clear!</p>
            <p className="text-xs text-muted-foreground">No urgent alerts right now</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Priority Alerts
          </CardTitle>
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            {unreadAlerts.length} pending
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {unreadAlerts.map((alert) => {
          const Icon = iconMap[alert.type]
          return (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border border-border p-3',
                alert.type === 'error' && 'border-red-500/30 bg-red-500/5',
                alert.type === 'warning' && 'border-amber-500/30 bg-amber-500/5'
              )}
            >
              <div className={cn('rounded-lg p-1.5', colorMap[alert.type])}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{alert.title}</p>
                <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => markNotificationRead(alert.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
        <Link href="/notifications">
          <Button variant="outline" className="w-full mt-2" size="sm">
            View All Notifications
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

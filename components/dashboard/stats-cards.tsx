"use client"

import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Facebook,
  XCircle,
} from 'lucide-react'

export function StatsCards() {
  const { pages, posts, selectedDate } = useAppStore()

  const activePages = pages.filter((p) => p.isActive)
  const todayPosts = posts.filter((p) => p.postDate === selectedDate)

  const totalSlotsToday = activePages.reduce(
    (acc, page) => acc + page.timeSlots.length,
    0
  )

  const postedCount = todayPosts.filter((p) => p.status === 'posted').length
  const pendingCount = todayPosts.filter(
    (p) => p.status === 'scheduled' || p.status === 'ready' || p.status === 'due_now'
  ).length
  const lateCount = todayPosts.filter((p) => p.status === 'late').length
  const emptySlots = totalSlotsToday - todayPosts.length

  const stats = [
    {
      label: 'Active Pages',
      value: activePages.length,
      icon: Facebook,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Posts Today',
      value: todayPosts.length,
      subValue: `/ ${totalSlotsToday} slots`,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Posted',
      value: postedCount,
      icon: CheckCircle2,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Pending',
      value: pendingCount,
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Late',
      value: lateCount,
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Empty Slots',
      value: emptySlots,
      icon: XCircle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                  {stat.subValue && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {stat.subValue}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

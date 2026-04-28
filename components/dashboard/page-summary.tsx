"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { ExternalLink, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function PageSummaryWidget() {
  const { pages, posts, selectedDate } = useAppStore()

  const activePages = pages.filter((p) => p.isActive)

  const pageSummaries = activePages.map((page) => {
    const pagePosts = posts.filter(
      (p) => p.pageId === page.id && p.postDate === selectedDate
    )
    const postedCount = pagePosts.filter((p) => p.status === 'posted').length
    const totalSlots = page.timeSlots.length
    const missingSlots = totalSlots - pagePosts.length
    const lateCount = pagePosts.filter((p) => p.status === 'late').length

    let status: 'good' | 'warning' | 'critical' = 'good'
    if (lateCount > 0 || missingSlots > 2) {
      status = 'critical'
    } else if (missingSlots > 0) {
      status = 'warning'
    }

    return {
      page,
      postsToday: pagePosts.length,
      postedCount,
      totalSlots,
      missingSlots,
      lateCount,
      status,
    }
  })

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Page Performance</CardTitle>
          <Link href="/pages">
            <Button variant="ghost" size="sm" className="text-xs">
              Manage Pages
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pageSummaries.map(({ page, postedCount, totalSlots, missingSlots, lateCount, status }) => (
            <div
              key={page.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3',
                status === 'critical' && 'border-red-500/30 bg-red-500/5',
                status === 'warning' && 'border-amber-500/30 bg-amber-500/5',
                status === 'good' && 'border-border bg-secondary/30'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    status === 'critical' && 'bg-red-400',
                    status === 'warning' && 'bg-amber-400',
                    status === 'good' && 'bg-green-400'
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{page.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{postedCount}/{totalSlots} posted</span>
                    {missingSlots > 0 && (
                      <span className="text-amber-400">{missingSlots} empty</span>
                    )}
                    {lateCount > 0 && (
                      <span className="text-red-400">{lateCount} late</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={page.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Link href={`/schedule?page=${page.id}`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

import { cn } from '@/lib/utils'
import type { PostStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: PostStatus
  size?: 'sm' | 'md'
}

const statusConfig: Record<PostStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-muted text-muted-foreground',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-500/20 text-blue-400',
  },
  ready: {
    label: 'Ready',
    className: 'bg-emerald-500/20 text-emerald-400',
  },
  due_now: {
    label: 'Due Now',
    className: 'bg-amber-500/20 text-amber-400',
  },
  posted: {
    label: 'Posted',
    className: 'bg-green-500/20 text-green-400',
  },
  late: {
    label: 'Late',
    className: 'bg-red-500/20 text-red-400',
  },
  skipped: {
    label: 'Skipped',
    className: 'bg-gray-500/20 text-gray-400',
  },
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        config.className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      {config.label}
    </span>
  )
}

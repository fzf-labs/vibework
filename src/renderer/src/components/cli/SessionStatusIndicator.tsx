import { cn } from '@/lib/utils'

type SessionStatus = 'idle' | 'running' | 'stopped' | 'error'

interface SessionStatusIndicatorProps {
  status: SessionStatus
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig = {
  idle: {
    color: 'bg-zinc-400',
    label: 'Ready',
    animate: false
  },
  running: {
    color: 'bg-green-500',
    label: 'Running',
    animate: true
  },
  stopped: {
    color: 'bg-zinc-500',
    label: 'Stopped',
    animate: false
  },
  error: {
    color: 'bg-red-500',
    label: 'Error',
    animate: false
  }
}

const sizeConfig = {
  sm: { dot: 'w-1.5 h-1.5', text: 'text-xs' },
  md: { dot: 'w-2 h-2', text: 'text-sm' },
  lg: { dot: 'w-3 h-3', text: 'text-base' }
}

export function SessionStatusIndicator({
  status,
  showLabel = true,
  size = 'md',
  className
}: SessionStatusIndicatorProps) {
  const config = statusConfig[status]
  const sizes = sizeConfig[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full',
          sizes.dot,
          config.color,
          config.animate && 'animate-pulse'
        )}
      />
      {showLabel && (
        <span className={cn('text-muted-foreground', sizes.text)}>
          {config.label}
        </span>
      )}
    </div>
  )
}

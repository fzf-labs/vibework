import { ChatInput } from '@/components/shared/ChatInput'
import type { MessageAttachment } from '@/hooks/useAgent'

import type { LanguageStrings } from '../types'

interface ReplyCardProps {
  t: LanguageStrings
  isRunning: boolean
  disabled?: boolean
  placeholder?: string
  onSubmit: (value: string, attachments?: MessageAttachment[]) => Promise<void>
  onStop?: () => void
}

export function ReplyCard({
  t,
  isRunning,
  disabled = false,
  placeholder = '有疑问，继续问我…',
  onSubmit,
  onStop
}: ReplyCardProps) {
  return (
    <section className="border-border/50 bg-background rounded-xl border shadow-sm">
      <div className="border-border/50 flex items-center gap-2 border-b px-3 py-2">
        <span className="text-muted-foreground text-xs font-semibold">
          {t.task.replyCardTitle || 'Reply'}
        </span>
      </div>
      <div className="px-3 py-2">
        <ChatInput
          variant="reply"
          placeholder={placeholder}
          isRunning={isRunning}
          disabled={disabled}
          onStop={onStop}
          onSubmit={onSubmit}
          className="rounded-none border-0 bg-transparent p-0 shadow-none"
        />
      </div>
    </section>
  )
}

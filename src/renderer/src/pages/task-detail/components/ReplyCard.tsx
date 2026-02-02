import { ChatInput } from '@/components/shared/ChatInput';

import type { LanguageStrings } from '../types';

interface ReplyCardProps {
  t: LanguageStrings;
  isRunning: boolean;
  onSubmit: (value: string) => void;
  onStop?: () => void;
}

export function ReplyCard({ t, isRunning, onSubmit, onStop }: ReplyCardProps) {
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
          placeholder="..."
          isRunning={isRunning}
          onStop={onStop}
          onSubmit={onSubmit}
          className="rounded-none border-0 bg-transparent p-0 shadow-none"
        />
      </div>
    </section>
  );
}

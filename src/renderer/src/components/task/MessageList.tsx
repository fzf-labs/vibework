import type { AgentMessage } from '@/hooks/useAgent';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: AgentMessage[];
  isRunning?: boolean;
  searchQuery?: string;
  phase?: string;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
}

export function MessageList({
  messages,
  phase,
  onApprovePlan,
  onRejectPlan,
}: MessageListProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <MessageItem
          key={index}
          message={message}
          phase={phase}
          onApprovePlan={onApprovePlan}
          onRejectPlan={onRejectPlan}
        />
      ))}
    </div>
  );
}

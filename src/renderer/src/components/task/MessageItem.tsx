import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentMessage } from '@/hooks/useAgent';
import { Logo } from '@/components/shared/Logo';
import { PlanApproval } from '@/components/task/PlanApproval';
import { UserMessage } from './UserMessage';
import { ErrorMessage } from './ErrorMessage';

interface MessageItemProps {
  message: AgentMessage;
  phase?: string;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
}

export function MessageItem({
  message,
  phase,
  onApprovePlan,
  onRejectPlan,
}: MessageItemProps) {
  if (message.type === 'user') {
    return (
      <UserMessage
        content={message.content || ''}
        attachments={message.attachments}
      />
    );
  }

  if (message.type === 'plan' && message.plan) {
    return (
      <PlanApproval
        plan={message.plan}
        isWaitingApproval={phase === 'awaiting_approval'}
        onApprove={onApprovePlan}
        onReject={onRejectPlan}
      />
    );
  }

  if (message.type === 'text') {
    return <TextMessage content={message.content || ''} />;
  }

  if (message.type === 'result') {
    return null;
  }

  if (message.type === 'error') {
    return <ErrorMessage message={message.message || ''} />;
  }

  return null;
}

function TextMessage({ content }: { content: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Logo />
      <div className="prose prose-sm text-foreground max-w-none min-w-0 flex-1 overflow-hidden">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre: ({ children }) => (
              <pre className="bg-muted max-w-full overflow-x-auto rounded-lg p-4">
                {children}
              </pre>
            ),
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code
                    className="bg-muted rounded px-1.5 py-0.5 text-sm"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            a: ({ children, href }) => (
              <a
                href={href}
                onClick={async (e) => {
                  e.preventDefault();
                  if (href) {
                    try {
                      const { shell } = await import('@/lib/electron-api');
                      await shell.openUrl(href);
                    } catch {
                      window.open(href, '_blank');
                    }
                  }
                }}
                className="text-primary cursor-pointer hover:underline"
              >
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table className="border-border border-collapse border">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-border bg-muted border px-3 py-2 text-left">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-border border px-3 py-2">{children}</td>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

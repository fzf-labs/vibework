import ReactMarkdown, { type Components } from 'react-markdown';
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

function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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
        content={coerceToString(message.content)}
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
    return <TextMessage content={coerceToString(message.content)} />;
  }

  if (message.type === 'result') {
    return null;
  }

  if (message.type === 'error') {
    return <ErrorMessage message={coerceToString(message.message)} />;
  }

  return null;
}

function TextMessage({ content }: { content: string }) {
  const components = {
    pre: ({ children }: any) => (
      <pre className="bg-muted max-w-full overflow-x-auto rounded-lg p-4">
        {children}
      </pre>
    ),
    code: ({ className, children, ...props }: any) => {
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
    a: ({ children, href }: any) => (
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
    table: ({ children }: any) => (
      <div className="overflow-x-auto">
        <table className="border-border border-collapse border">
          {children}
        </table>
      </div>
    ),
    th: ({ children }: any) => (
      <th className="border-border bg-muted border px-3 py-2 text-left">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border-border border px-3 py-2">{children}</td>
    ),
  } as Components;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Logo />
      <div className="prose prose-sm text-foreground max-w-none min-w-0 flex-1 overflow-hidden">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

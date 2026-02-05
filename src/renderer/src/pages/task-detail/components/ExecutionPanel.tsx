import { Terminal } from 'lucide-react';
import type { RefObject } from 'react';

import { cn } from '@/lib/utils';
import { CLISession, type CLISessionHandle } from '@/components/cli';
import { MessageList, RunningIndicator } from '@/components/task';
import type { AgentMessage, AgentPhase } from '@/hooks/useAgent';

import type { LanguageStrings } from '../types';

interface ExecutionPanelProps {
  t: LanguageStrings;
  isLoading: boolean;
  pipelineBanner: string | null;
  useCliSession: boolean;
  cliStatusInfo: { label: string; color: string };
  cliToolLabel: string;
  messages: AgentMessage[];
  phase: AgentPhase;
  onApprovePlan: () => void;
  onRejectPlan: () => void;
  isRunning: boolean;
  taskId?: string | null;
  sessionId: string;
  toolId: string;
  workingDir: string;
  prompt: string;
  cliSessionRef: RefObject<CLISessionHandle | null>;
  onCliStatusChange: (status: 'idle' | 'running' | 'stopped' | 'error') => void;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function ExecutionPanel({
  t,
  isLoading,
  pipelineBanner,
  useCliSession,
  cliStatusInfo,
  cliToolLabel,
  messages,
  phase,
  onApprovePlan,
  onRejectPlan,
  isRunning,
  taskId,
  sessionId,
  toolId,
  workingDir,
  prompt,
  cliSessionRef,
  onCliStatusChange,
  messagesContainerRef,
  messagesEndRef,
}: ExecutionPanelProps) {
  return (
    <section className="border-border/50 bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
      <div className="border-border/50 bg-background/95 sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-2 backdrop-blur">
        <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
          <Terminal className="size-3.5" />
          <span className="text-foreground text-xs font-medium">
            {cliToolLabel}
          </span>
        </div>
        {cliStatusInfo && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              cliStatusInfo.color
            )}
          >
            {cliStatusInfo.label}
          </span>
        )}
      </div>

      <div
        ref={messagesContainerRef}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground flex items-center gap-3">
              <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>{t.common.loading}</span>
            </div>
          </div>
        ) : (
          <div className="flex min-h-full flex-col px-3 py-3">
            {pipelineBanner && (
              <div className="border-border/50 bg-muted/30 mb-3 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                {pipelineBanner}
              </div>
            )}

            {useCliSession ? (
              <>
                <div className="flex min-h-0 flex-1">
                  <CLISession
                    ref={cliSessionRef}
                    sessionId={sessionId}
                    taskId={taskId}
                    toolId={toolId}
                    workdir={workingDir}
                    prompt={prompt}
                    className="h-full w-full"
                    compact
                    allowStart={false}
                    allowStop={false}
                    onStatusChange={onCliStatusChange}
                  />
                </div>
              </>
            ) : messages.length === 0 && !isRunning ? (
              <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                {t.task.waitingForTask}
              </div>
            ) : (
              <>
                <MessageList
                  messages={messages}
                  phase={phase}
                  onApprovePlan={onApprovePlan}
                  onRejectPlan={onRejectPlan}
                />
                {isRunning && <RunningIndicator messages={messages} />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </section>
  );
}

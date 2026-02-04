import { useCallback, useMemo } from 'react';

import { db, type Task } from '@/data';
import type { AgentMessage, MessageAttachment } from '@/hooks/useAgent';

import type {
  ExecutionStatus,
  PipelineStatus,
  PipelineTemplate,
  WorkflowCurrentNode,
  LanguageStrings,
} from '../types';
import type { CLISessionHandle } from '@/components/cli';

interface UseTaskDetailActionsInput {
  taskId?: string;
  task: Task | null;
  setTask: React.Dispatch<React.SetStateAction<Task | null>>;
  initialPrompt: string;
  initialAttachmentsRef: React.MutableRefObject<MessageAttachment[] | undefined>;
  activeTaskId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
  loadMessages: (taskId: string) => Promise<void>;
  runAgent: (
    prompt: string,
    taskId?: string,
    sessionInfo?: { sessionId: string },
    attachments?: MessageAttachment[],
    workingDir?: string
  ) => Promise<string>;
  continueConversation: (
    prompt: string,
    attachments?: MessageAttachment[],
    workingDir?: string
  ) => Promise<void>;
  isRunning: boolean;
  useCliSession: boolean;
  cliStatus: ExecutionStatus;
  cliSessionRef: React.RefObject<CLISessionHandle | null>;
  runCliPrompt: (prompt?: string) => Promise<void>;
  appendCliUserLog: (content: string) => void;
  appendCliSystemLog: (content: string) => void;
  pipelineTemplate: PipelineTemplate | null;
  pipelineStatus: PipelineStatus;
  startPipelineStage: (index: number, approvalNote?: string) => Promise<void>;
  startNextPipelineStage: (approvalNote?: string) => Promise<void>;
  workingDir: string;
  t: LanguageStrings;
  workflowCurrentNode: WorkflowCurrentNode | null;
  resolveWorkNodePrompt: (
    workNodeId?: string | null,
    nodeIndex?: number | null,
    templateId?: string | null
  ) => Promise<string>;
  buildCliPrompt: (nodePrompt?: string) => string;
  stopAgent: () => Promise<void>;
  stopCli: () => Promise<void>;
  markStartedOnce: () => void;
}

export function useTaskDetailActions({
  taskId,
  task,
  setTask,
  initialPrompt,
  initialAttachmentsRef,
  activeTaskId,
  setMessages,
  loadMessages,
  runAgent,
  continueConversation,
  isRunning,
  useCliSession,
  cliStatus,
  cliSessionRef,
  runCliPrompt,
  appendCliUserLog,
  appendCliSystemLog,
  pipelineTemplate,
  pipelineStatus,
  startPipelineStage,
  startNextPipelineStage,
  workingDir,
  t,
  workflowCurrentNode,
  resolveWorkNodePrompt,
  buildCliPrompt,
  stopAgent,
  stopCli,
  markStartedOnce,
}: UseTaskDetailActionsInput) {
  const handleReply = useCallback(
    async (text: string, messageAttachments?: MessageAttachment[]) => {
      if ((text.trim() || (messageAttachments && messageAttachments.length > 0)) && taskId) {
        if (!useCliSession && isRunning) {
          return;
        }
        if (useCliSession) {
          const content = text.trim();
          if (content) {
            appendCliUserLog(content);
          }
          if (task?.status === 'in_review') {
            try {
              const updatedTask = await db.updateTask(taskId, { status: 'in_progress' });
              if (updatedTask) {
                setTask(updatedTask);
              }
            } catch (error) {
              console.error('[TaskDetail] Failed to update task status for CLI reply:', error);
            }
          }
          try {
            if (content) {
              if (!cliSessionRef.current) {
                throw new Error('CLI session not initialized');
              }
              await runCliPrompt(content);
            }
          } catch (error) {
            console.error('Failed to send CLI input:', error);
            appendCliSystemLog(
              t.common.errors.serverNotRunning ||
              'CLI session is not running.'
            );
          }
          return;
        }
        if (activeTaskId !== taskId) {
          await loadMessages(taskId);
        }
        if (
          pipelineTemplate &&
          (pipelineStatus === 'waiting_approval' || pipelineStatus === 'failed')
        ) {
          const approvalNote = text.trim();
          if (approvalNote) {
            setMessages((prev) => [
              ...prev,
              { type: 'user', content: approvalNote },
            ]);
          }
          await startNextPipelineStage(approvalNote);
          return;
        }
        await continueConversation(
          text.trim(),
          messageAttachments,
          workingDir || undefined
        );
      }
    },
    [
      activeTaskId,
      appendCliSystemLog,
      appendCliUserLog,
      cliSessionRef,
      continueConversation,
      isRunning,
      loadMessages,
      pipelineStatus,
      pipelineTemplate,
      runCliPrompt,
      setMessages,
      setTask,
      startNextPipelineStage,
      t.common.errors.serverNotRunning,
      task?.status,
      taskId,
      useCliSession,
      workingDir,
    ]
  );

  const handleStartTask = useCallback(async () => {
    if (!taskId) return;

    markStartedOnce();
    if (!task?.pipeline_template_id) {
      try {
        const updatedTask = await db.updateTask(taskId, { status: 'in_progress' });
        if (updatedTask) {
          setTask(updatedTask);
        }
      } catch (error) {
        console.error('Failed to update task status:', error);
      }
    }
    if (task?.pipeline_template_id) {
      if (!pipelineTemplate) return;
      if (pipelineStatus !== 'idle' || isRunning) return;
      await startPipelineStage(0);
      return;
    }

    if (useCliSession) {
      try {
        if (!cliSessionRef.current) {
          throw new Error('CLI session not initialized');
        }
        let prompt = task?.prompt || initialPrompt;
        if (task?.workflow_template_id || workflowCurrentNode) {
          const nodePrompt = await resolveWorkNodePrompt(
            workflowCurrentNode?.id,
            workflowCurrentNode?.index ?? 0,
            workflowCurrentNode?.templateId
          );
          const composed = buildCliPrompt(nodePrompt);
          if (composed.trim()) {
            prompt = composed;
          }
        }
        if (prompt) {
          appendCliUserLog(prompt);
        }
        await runCliPrompt(prompt);
      } catch (error) {
        console.error('Failed to start CLI session:', error);
        appendCliSystemLog(
          t.common.errors.serverNotRunning ||
          'CLI session is not running.'
        );
      }
      return;
    }

    const sessionInfo = task?.session_id ? { sessionId: task.session_id } : undefined;

    const pendingAttachments = initialAttachmentsRef.current;
    initialAttachmentsRef.current = undefined;
    await runAgent(
      task?.prompt || initialPrompt,
      taskId,
      sessionInfo,
      pendingAttachments,
      workingDir || undefined
    );
  }, [
    appendCliSystemLog,
    appendCliUserLog,
    buildCliPrompt,
    cliSessionRef,
    initialPrompt,
    initialAttachmentsRef,
    isRunning,
    markStartedOnce,
    pipelineStatus,
    pipelineTemplate,
    resolveWorkNodePrompt,
    runAgent,
    runCliPrompt,
    setTask,
    startPipelineStage,
    t.common.errors.serverNotRunning,
    task?.pipeline_template_id,
    task?.prompt,
    task?.session_id,
    task?.workflow_template_id,
    taskId,
    useCliSession,
    workingDir,
    workflowCurrentNode,
  ]);

  const handleApproveCliTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const updatedTask = await db.updateTask(taskId, { status: 'done' });
      if (updatedTask) {
        setTask(updatedTask);
      }
    } catch (error) {
      console.error('[TaskDetail] Failed to approve task:', error);
    }
  }, [setTask, taskId]);

  const handleStopExecution = useCallback(async () => {
    if (useCliSession) {
      await stopCli();
      return;
    }
    await stopAgent();
  }, [stopAgent, stopCli, useCliSession]);

  const replyIsRunning = useMemo(() => {
    if (useCliSession) {
      return cliStatus === 'running';
    }
    return isRunning;
  }, [cliStatus, isRunning, useCliSession]);

  return {
    handleReply,
    handleStartTask,
    handleApproveCliTask,
    handleStopExecution,
    replyIsRunning,
  };
}

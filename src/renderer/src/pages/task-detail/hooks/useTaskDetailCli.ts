import { useCallback, useEffect, useRef, useState } from 'react';

import { db, type Task } from '@/data';
import { newUlid } from '@/lib/ids';
import type { CLISessionHandle } from '@/components/cli';

import type { ExecutionStatus } from '../types';

interface UseTaskDetailCliInput {
  taskId?: string;
  task: Task | null;
  setTask: React.Dispatch<React.SetStateAction<Task | null>>;
  onExecutionStopped?: () => void;
}

export function useTaskDetailCli({
  taskId,
  task,
  setTask,
  onExecutionStopped,
}: UseTaskDetailCliInput) {
  const [cliStatus, setCliStatus] = useState<ExecutionStatus>('idle');
  const cliSessionRef = useRef<CLISessionHandle>(null);

  useEffect(() => {
    setCliStatus('idle');
  }, [taskId]);

  const resolveCurrentExecutionId = useCallback(async () => {
    if (!taskId) return null;
    try {
      const workflow = (await db.getWorkflowByTaskId(taskId)) as {
        id: string;
        current_node_index: number;
      } | null;
      if (!workflow) return null;

      const nodes = (await db.getWorkNodesByWorkflowId(workflow.id)) as Array<{
        id: string;
      }>;
      const currentNode = nodes[workflow.current_node_index];
      if (!currentNode) return null;

      const latestExecution = (await db.getLatestAgentExecution(currentNode.id)) as {
        id: string;
      } | null;
      return latestExecution?.id ?? null;
    } catch (error) {
      console.error('[TaskDetail] Failed to resolve agent execution:', error);
      return null;
    }
  }, [taskId]);

  const markExecutionRunning = useCallback(async () => {
    const executionId = await resolveCurrentExecutionId();
    if (!executionId) return;
    try {
      await db.updateAgentExecutionStatus(executionId, 'running');
    } catch (error) {
      console.error('[TaskDetail] Failed to mark execution running:', error);
    }
  }, [resolveCurrentExecutionId]);

  const markExecutionCompleted = useCallback(async () => {
    const executionId = await resolveCurrentExecutionId();
    if (!executionId) return;
    try {
      await db.updateAgentExecutionStatus(executionId, 'completed');
    } catch (error) {
      console.error('[TaskDetail] Failed to mark execution completed:', error);
    }
  }, [resolveCurrentExecutionId]);

  const handleCliStatusChange = useCallback(
    (status: ExecutionStatus) => {
      setCliStatus(status);
      if (!taskId) return;
      if (status === 'running') {
        void markExecutionRunning();
      } else if (status === 'stopped') {
        void markExecutionCompleted();
        if (onExecutionStopped) {
          onExecutionStopped();
        }
        void (async () => {
          try {
            const workflow = await db.getWorkflowByTaskId(taskId);
            if (!workflow) {
              const updatedTask = await db.updateTask(taskId, { status: 'in_review' });
              if (updatedTask) {
                setTask(updatedTask as Task);
              }
            }
          } catch (error) {
            console.error('[TaskDetail] Failed to sync task status on CLI completion:', error);
          }
        })();
      }
    },
    [markExecutionCompleted, markExecutionRunning, onExecutionStopped, setTask, taskId]
  );

  const runCliPrompt = useCallback(
    async (prompt?: string) => {
      const session = cliSessionRef.current;
      if (!session) return;
      const content = prompt && prompt.trim() ? prompt.trim() : '';

      const sessionId = task?.session_id;
      if (sessionId && window.api?.cliSession?.getSession) {
        try {
          const existingSession = await window.api.cliSession.getSession(sessionId);
          if (existingSession) {
            if (content) {
              await session.sendInput(content);
            }
            return;
          }
        } catch (error) {
          console.error('[TaskDetail] Failed to check existing CLI session:', error);
        }
      }

      if (cliStatus === 'running') {
        if (content) {
          await session.sendInput(content);
        }
        return;
      }

      await session.start(content ? content : undefined);
    },
    [cliStatus, task?.session_id]
  );

  const appendCliLog = useCallback(
    (content: string, type: 'user_message' | 'system_message') => {
      const sessionId = task?.session_id;
      if (!sessionId) return;
      const trimmed = content.trim();
      if (!trimmed || !window.api?.cliSession?.appendLog) return;
      const timestamp = Date.now();
      const entry = {
        id: newUlid(),
        type,
        timestamp,
        content: trimmed,
      };
      window.api.cliSession
        .appendLog(
          sessionId,
          {
            type: 'normalized',
            entry,
            timestamp,
            task_id: taskId ?? sessionId,
            session_id: sessionId,
          },
          task?.project_id ?? null
        )
        .catch((error: unknown) => {
          console.error('[TaskDetail] Failed to append CLI log:', error);
        });
    },
    [task?.project_id, task?.session_id, taskId]
  );

  const appendCliUserLog = useCallback(
    (content: string) => {
      appendCliLog(content, 'user_message');
    },
    [appendCliLog]
  );

  const appendCliSystemLog = useCallback(
    (content: string) => {
      appendCliLog(content, 'system_message');
    },
    [appendCliLog]
  );

  const stopCli = useCallback(async () => {
    try {
      const session = cliSessionRef.current;
      if (session) {
        await session.stop();
      } else if (task?.session_id && window.api?.cliSession?.stopSession) {
        await window.api.cliSession.stopSession(task.session_id);
      }
    } catch (error) {
      console.error('[TaskDetail] Failed to stop CLI session:', error);
    }
  }, [task?.session_id]);

  return {
    cliStatus,
    cliSessionRef,
    runCliPrompt,
    appendCliUserLog,
    appendCliSystemLog,
    handleCliStatusChange,
    stopCli,
  };
}

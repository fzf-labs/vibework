import { useCallback, useEffect, useMemo, useState } from 'react';

import { db, type Task } from '@/data';
import type { AgentMessage, MessageAttachment } from '@/hooks/useAgent';

import type {
  ExecutionStatus,
  PipelineDisplayStatus,
  PipelineStatus,
  PipelineTemplate,
} from '../types';
import type { LanguageStrings } from '../types';

interface UseTaskDetailPipelineInput {
  taskId?: string;
  task: Task | null;
  messages: AgentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
  isRunning: boolean;
  cliStatus: ExecutionStatus;
  useCliSession: boolean;
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
  workingDir: string;
  buildCliPrompt: (nodePrompt?: string) => string;
  resolveWorkNodePrompt: (
    workNodeId?: string | null,
    nodeIndex?: number | null,
    templateId?: string | null
  ) => Promise<string>;
  runCliPrompt: (prompt?: string) => Promise<void>;
  appendCliUserLog: (content: string) => void;
  t: LanguageStrings;
  pipelineStageIndex: number;
  setPipelineStageIndex: (index: number) => void;
}

export function useTaskDetailPipeline({
  taskId,
  task,
  messages,
  setMessages,
  isRunning,
  cliStatus,
  useCliSession,
  runAgent,
  continueConversation,
  workingDir,
  buildCliPrompt,
  resolveWorkNodePrompt,
  runCliPrompt,
  appendCliUserLog,
  t,
  pipelineStageIndex,
  setPipelineStageIndex,
}: UseTaskDetailPipelineInput) {
  const [pipelineTemplate, setPipelineTemplate] = useState<PipelineTemplate | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [pipelineStageMessageStart, setPipelineStageMessageStart] = useState(0);

  useEffect(() => {
    if (!task?.pipeline_template_id) {
      setPipelineTemplate(null);
      setPipelineStatus('idle');
      return;
    }

    let active = true;
    const loadTemplate = async () => {
      try {
        const template = (await db.getWorkflowTemplate(
          task.pipeline_template_id!
        )) as PipelineTemplate | null;
        if (active) {
          setPipelineTemplate(template);
          setPipelineStageIndex(0);
          setPipelineStatus('idle');
        }
      } catch (error) {
        console.error('Failed to load pipeline template:', error);
      }
    };

    void loadTemplate();
    return () => {
      active = false;
    };
  }, [task?.pipeline_template_id, setPipelineStageIndex]);

  const appendPipelineNotice = useCallback(
    async (content: string) => {
      if (!taskId) return;
      setMessages((prev) => [...prev, { type: 'text', content }]);
    },
    [setMessages, taskId]
  );

  const startPipelineStage = useCallback(
    async (index: number, approvalNote?: string) => {
      if (!pipelineTemplate || !taskId) return;
      const stage = pipelineTemplate.nodes?.[index];
      if (!stage) {
        setPipelineStatus('completed');
        try {
          await db.updateTask(taskId, { status: 'done' });
        } catch (error) {
          console.error('Failed to update task status:', error);
        }
        await appendPipelineNotice(t.task.pipelineCompleted);
        return;
      }

      const resolvedPrompt = await resolveWorkNodePrompt(null, index, stage.id);
      const baseNodePrompt = resolvedPrompt || stage.prompt || '';
      const nodePrompt = approvalNote
        ? `${baseNodePrompt}\n\n${t.task.pipelineApprovalNotePrefix}: ${approvalNote}`
        : baseNodePrompt;
      const prompt = buildCliPrompt(nodePrompt);

      setPipelineStageIndex(index);
      setPipelineStatus('running');
      setPipelineStageMessageStart(messages.length);
      try {
        await db.updateTask(taskId, { status: 'in_progress' });
      } catch (error) {
        console.error('Failed to update task status:', error);
      }

      if (useCliSession) {
        try {
          appendCliUserLog(prompt);
          await runCliPrompt(prompt);
        } catch (error) {
          console.error('Failed to execute CLI session:', error);
          setPipelineStatus('failed');
        }
        return;
      }

      const sessionInfo = task?.session_id ? { sessionId: task.session_id } : undefined;

      if (messages.length === 0) {
        await runAgent(
          prompt,
          taskId,
          sessionInfo,
          undefined,
          workingDir || undefined
        );
      } else {
        await continueConversation(prompt, undefined, workingDir || undefined);
      }
    },
    [
      appendCliUserLog,
      appendPipelineNotice,
      buildCliPrompt,
      continueConversation,
      messages.length,
      pipelineTemplate,
      resolveWorkNodePrompt,
      runAgent,
      runCliPrompt,
      task?.session_id,
      taskId,
      t.task.pipelineApprovalNotePrefix,
      t.task.pipelineCompleted,
      useCliSession,
      workingDir,
      setPipelineStageIndex,
    ]
  );

  const startNextPipelineStage = useCallback(
    async (approvalNote?: string) => {
      await startPipelineStage(pipelineStageIndex + 1, approvalNote);
    },
    [pipelineStageIndex, startPipelineStage]
  );

  const normalizedTaskStatus = useMemo<PipelineDisplayStatus>(() => {
    const rawStatus = task?.status;
    if (!rawStatus) return 'todo';
    if (['todo', 'in_progress', 'in_review', 'done'].includes(rawStatus)) {
      return rawStatus as PipelineDisplayStatus;
    }
    return 'todo';
  }, [task?.status]);

  useEffect(() => {
    if (!pipelineTemplate || pipelineStatus !== 'idle' || isRunning) return;
    if (useCliSession && cliStatus === 'running') return;
    if (!taskId || messages.length > 0) return;
    if (normalizedTaskStatus !== 'in_progress') return;

    let active = true;
    const maybeStart = async () => {
      try {
        const workflow = (await db.getWorkflowByTaskId(taskId)) as {
          id: string;
          current_node_index: number;
        } | null;

        if (workflow) {
          const nodes = (await db.getWorkNodesByWorkflowId(workflow.id)) as Array<{
            id: string;
          }>;
          const currentNode = nodes[workflow.current_node_index];
          if (!currentNode) return;

          const latestExecution = (await db.getLatestAgentExecution(currentNode.id)) as {
            status: 'idle' | 'running' | 'completed';
          } | null;
          if (latestExecution && latestExecution.status !== 'idle') return;
        }
      } catch (error) {
        console.error('[TaskDetail] Failed to check workflow execution before auto-start:', error);
        return;
      }

      if (!active) return;
      startPipelineStage(0).catch((error) => {
        console.error('Failed to start pipeline stage:', error);
      });
    };

    void maybeStart();
    return () => {
      active = false;
    };
  }, [
    cliStatus,
    isRunning,
    messages.length,
    normalizedTaskStatus,
    pipelineStatus,
    pipelineTemplate,
    startPipelineStage,
    taskId,
    useCliSession,
  ]);

  useEffect(() => {
    if (!pipelineTemplate || pipelineStatus !== 'running' || isRunning) return;
    const stageMessages = messages.slice(pipelineStageMessageStart);
    let outcome: (typeof stageMessages)[number] | undefined;
    for (let i = stageMessages.length - 1; i >= 0; i -= 1) {
      if (stageMessages[i].type === 'result' || stageMessages[i].type === 'error') {
        outcome = stageMessages[i];
        break;
      }
    }
    if (!outcome || !taskId) return;

    const stage = pipelineTemplate.nodes?.[pipelineStageIndex];
    const stageName = stage?.name || `${t.task.stageLabel} ${pipelineStageIndex + 1}`;

    if (outcome.type === 'result' && outcome.subtype === 'success') {
      setPipelineStatus('waiting_approval');
      db.updateTask(taskId, { status: 'in_review' }).catch((error) => {
        console.error('Failed to update task status:', error);
      });
      appendPipelineNotice(
        `${t.task.pipelineStageCompleted.replace('{name}', stageName)}`
      );
    } else {
      setPipelineStatus('failed');
      appendPipelineNotice(
        `${t.task.pipelineStageFailed.replace('{name}', stageName)}`
      );
    }
  }, [
    appendPipelineNotice,
    isRunning,
    messages,
    pipelineStageIndex,
    pipelineStageMessageStart,
    pipelineStatus,
    pipelineTemplate,
    taskId,
    t.task.pipelineStageCompleted,
    t.task.pipelineStageFailed,
    t.task.stageLabel,
  ]);

  const pipelineBanner = useMemo(() => {
    if (!pipelineTemplate) return null;
    const stage = pipelineTemplate.nodes?.[pipelineStageIndex];
    const stageName = stage?.name || `${t.task.stageLabel} ${pipelineStageIndex + 1}`;
    if (pipelineStatus === 'waiting_approval') {
      return t.task.pipelineStageCompleted.replace('{name}', stageName);
    }
    if (pipelineStatus === 'failed') {
      return t.task.pipelineStageFailed.replace('{name}', stageName);
    }
    if (pipelineStatus === 'completed') {
      return t.task.pipelineCompleted;
    }
    return null;
  }, [
    pipelineStageIndex,
    pipelineStatus,
    pipelineTemplate,
    t.task.pipelineCompleted,
    t.task.pipelineStageCompleted,
    t.task.pipelineStageFailed,
    t.task.stageLabel,
  ]);

  return {
    pipelineTemplate,
    pipelineStatus,
    pipelineBanner,
    startPipelineStage,
    startNextPipelineStage,
  };
}

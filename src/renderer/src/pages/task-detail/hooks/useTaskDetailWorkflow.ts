import { useCallback, useEffect, useRef, useState } from 'react';

import { db, type Task } from '@/data';

import type {
  ExecutionStatus,
  PipelineTemplate,
  WorkflowCurrentNode,
  WorkflowNode,
  WorkflowReviewNode,
} from '../types';
import type { LanguageStrings } from '../types';

interface UseTaskDetailWorkflowInput {
  taskId?: string;
  taskSessionId?: string | null;
  pipelineTemplate: PipelineTemplate | null;
  useCliSession: boolean;
  isRunning: boolean;
  cliStatus: ExecutionStatus;
  t: LanguageStrings;
  setPipelineStageIndex: (index: number) => void;
  setTask: React.Dispatch<React.SetStateAction<Task | null>>;
  buildCliPrompt: (nodePrompt?: string) => string;
  runCliPrompt: (prompt?: string) => Promise<void>;
  appendCliUserLog: (content: string) => void;
}

export function useTaskDetailWorkflow({
  taskId,
  taskSessionId,
  pipelineTemplate,
  useCliSession,
  isRunning,
  cliStatus,
  t,
  setPipelineStageIndex,
  setTask,
  buildCliPrompt,
  runCliPrompt,
  appendCliUserLog,
}: UseTaskDetailWorkflowInput) {
  const [currentWorkNode, setCurrentWorkNode] = useState<WorkflowReviewNode | null>(null);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowCurrentNode, setWorkflowCurrentNode] = useState<WorkflowCurrentNode | null>(null);

  const isMountedRef = useRef(true);
  const prevTaskIdRef = useRef<string | undefined>(undefined);
  const lastAutoRunWorkNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevTaskIdRef.current !== taskId) {
      if (prevTaskIdRef.current !== undefined) {
        setCurrentWorkNode(null);
        setWorkflowNodes([]);
        setWorkflowCurrentNode(null);
        lastAutoRunWorkNodeIdRef.current = null;
      }
      prevTaskIdRef.current = taskId;
    }
  }, [taskId]);

  const resolveWorkNodePrompt = useCallback(
    async (
      workNodeId?: string | null,
      nodeIndex?: number | null,
      templateId?: string | null
    ) => {
      const sortedNodes = [...workflowNodes].sort(
        (a, b) => a.node_order - b.node_order
      );
      const fromState =
        (workNodeId
          ? sortedNodes.find((node) => node.id === workNodeId)
          : null) ||
        (typeof nodeIndex === 'number'
          ? sortedNodes[nodeIndex]
          : null) ||
        sortedNodes.find((node) => node.node_order === nodeIndex) ||
        (templateId
          ? sortedNodes.find(
              (node) =>
                node.work_node_template_id === templateId ||
                node.template_node_id === templateId
            )
          : null);
      if (fromState?.prompt && fromState.prompt.trim()) {
        return fromState.prompt.trim();
      }

      if (!taskId) return '';
      try {
        const workflow = (await db.getWorkflowByTaskId(taskId)) as {
          id: string;
        } | null;
        if (!workflow) return '';

        const nodes = (await db.getWorkNodesByWorkflowId(workflow.id)) as Array<{
          id: string;
          node_order: number;
          template_node_id?: string | null;
          work_node_template_id?: string | null;
          prompt?: string;
        }>;
        const byId = workNodeId
          ? nodes.find((node) => node.id === workNodeId)
          : null;
        const byIndex =
          typeof nodeIndex === 'number'
            ? [...nodes]
                .sort((a, b) => a.node_order - b.node_order)[nodeIndex]
            : null;
        const byTemplate =
          templateId
            ? nodes.find(
                (node) =>
                  node.work_node_template_id === templateId ||
                  node.template_node_id === templateId
              )
            : null;
        const prompt = byId?.prompt || byIndex?.prompt || byTemplate?.prompt || '';
        return prompt.trim();
      } catch (error) {
        console.error('[TaskDetail] Failed to resolve work node prompt:', error);
        return '';
      }
    },
    [taskId, workflowNodes]
  );

  const loadWorkflowStatus = useCallback(async () => {
    if (!taskId) return;
    try {
      const workflow = (await db.getWorkflowByTaskId(taskId)) as {
        id: string;
        current_node_index: number;
        status: string;
      } | null;

      if (!workflow) {
        if (isMountedRef.current) {
          setCurrentWorkNode(null);
          setWorkflowNodes([]);
          setWorkflowCurrentNode(null);
        }
        return;
      }

      const nodes = (await db.getWorkNodesByWorkflowId(workflow.id)) as Array<{
        id: string;
        template_node_id?: string | null;
        work_node_template_id?: string | null;
        node_order: number;
        status: 'todo' | 'in_progress' | 'in_review' | 'done';
        name?: string;
        prompt?: string;
      }>;
      const normalizedNodes = nodes.map((node) => ({
        ...node,
        work_node_template_id:
          node.work_node_template_id || node.template_node_id || '',
        template_node_id:
          node.template_node_id || node.work_node_template_id || null,
      }));

      const currentNode = normalizedNodes[workflow.current_node_index];
      if (!currentNode) {
        if (isMountedRef.current) {
          setCurrentWorkNode(null);
          setWorkflowCurrentNode(null);
          setWorkflowNodes(normalizedNodes);
        }
        return;
      }

      if (isMountedRef.current) {
        setWorkflowNodes(normalizedNodes);
        setWorkflowCurrentNode({
          id: currentNode.id,
          templateId: currentNode.work_node_template_id || currentNode.template_node_id || '',
          status: currentNode.status,
          index: workflow.current_node_index,
        });
        if (useCliSession) {
          setPipelineStageIndex(workflow.current_node_index);
        }
      }

      if (currentNode.status === 'in_review') {
        const nodeTemplate = pipelineTemplate?.nodes.find(
          (node) => node.id === (currentNode.work_node_template_id || currentNode.template_node_id)
        );
        const fallbackName = `${t.task.stageLabel} ${workflow.current_node_index + 1}`;
        if (isMountedRef.current) {
          setCurrentWorkNode({
            id: currentNode.id,
            name: currentNode.name || nodeTemplate?.name || fallbackName,
            status: currentNode.status as 'in_review',
          });
        }
        return;
      }

      if (isMountedRef.current) {
        setCurrentWorkNode(null);
      }
    } catch (error) {
      console.error('Failed to load workflow status:', error);
    }
  }, [pipelineTemplate, setPipelineStageIndex, taskId, t.task.stageLabel, useCliSession]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [taskId]);

  // Load workflow instance and current work node status
  useEffect(() => {
    if (!taskId) return;

    let active = true;
    const run = async () => {
      if (!active) return;
      await loadWorkflowStatus();
    };

    void run();
    const shouldPoll = isRunning || cliStatus === 'running';
    const interval = shouldPoll
      ? setInterval(() => {
          if (!active) return;
          void loadWorkflowStatus();
        }, 2000)
      : null;

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [taskId, loadWorkflowStatus, isRunning, cliStatus]);

  useEffect(() => {
    if (!taskId) return;
    if (isRunning || cliStatus === 'running') return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      void loadWorkflowStatus();
      if (attempts >= 8) {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [taskId, isRunning, cliStatus, loadWorkflowStatus]);

  const handleApproveWorkNode = useCallback(async () => {
    if (!currentWorkNode) return;
    await db.approveWorkNode(currentWorkNode.id);
    setCurrentWorkNode(null);
    lastAutoRunWorkNodeIdRef.current = null;
    await loadWorkflowStatus();
    if (taskId) {
      try {
        const updatedTask = await db.getTask(taskId);
        if (updatedTask) {
          setTask(updatedTask as Task);
        }
      } catch (error) {
        console.error('[TaskDetail] Failed to refresh task after work node approval:', error);
      }
    }
  }, [currentWorkNode, loadWorkflowStatus, setTask, taskId]);

  useEffect(() => {
    if (!useCliSession) return;
    if (!workflowCurrentNode) return;
    if (workflowCurrentNode.status !== 'in_progress') return;
    if (cliStatus === 'running') return;
    if (lastAutoRunWorkNodeIdRef.current === workflowCurrentNode.id) return;
    let active = true;
    const run = async () => {
      const sessionId = taskSessionId;
      if (sessionId && window.api?.cliSession?.getSession) {
        try {
          const existingSession = await window.api.cliSession.getSession(sessionId);
          if (!active) return;
          if (existingSession) {
            if (existingSession.status === 'running') {
              return;
            }
          }
        } catch (error) {
          console.error('[TaskDetail] Failed to check existing CLI session:', error);
        }
      }

      try {
        const latestExecution = (await db.getLatestAgentExecution(workflowCurrentNode.id)) as {
          status: 'idle' | 'running' | 'completed';
        } | null;
        if (!active) return;
        if (latestExecution && latestExecution.status !== 'idle') {
          return;
        }
      } catch (error) {
        console.error('[TaskDetail] Failed to check execution before auto-run:', error);
        if (!active) return;
      }

      const templateNode = pipelineTemplate?.nodes?.find(
        (node) => node.id === workflowCurrentNode.templateId
      );
      const resolvedPrompt = await resolveWorkNodePrompt(
        workflowCurrentNode.id,
        workflowCurrentNode.index,
        workflowCurrentNode.templateId
      );
      const nodePrompt = resolvedPrompt || templateNode?.prompt || '';
      const prompt = buildCliPrompt(nodePrompt);
      if (!prompt.trim() || !active) return;

      lastAutoRunWorkNodeIdRef.current = workflowCurrentNode.id;
      appendCliUserLog(prompt);
      void runCliPrompt(prompt);
    };

    void run();
    return () => {
      active = false;
    };
  }, [
    appendCliUserLog,
    buildCliPrompt,
    cliStatus,
    pipelineTemplate,
    resolveWorkNodePrompt,
    runCliPrompt,
    taskSessionId,
    useCliSession,
    workflowCurrentNode,
  ]);

  return {
    currentWorkNode,
    workflowNodes,
    workflowCurrentNode,
    loadWorkflowStatus,
    resolveWorkNodePrompt,
    handleApproveWorkNode,
  };
}

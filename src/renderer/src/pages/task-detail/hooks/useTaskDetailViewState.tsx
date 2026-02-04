import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, GitBranch } from 'lucide-react';

import type { Task } from '@/data';
import type { AgentMessage } from '@/hooks/useAgent';

import { statusConfig } from '../constants';
import {
  filterVisibleMetaRows,
  type CLIToolInfo,
  type ExecutionStatus,
  type PipelineDisplayStatus,
  type PipelineStatus,
  type PipelineTemplate,
  type TaskMetaRow,
  type WorkflowNode,
  type WorkflowReviewNode,
  type LanguageStrings,
} from '../types';

interface UseTaskDetailViewStateInput {
  taskId?: string;
  task: Task | null;
  initialPrompt: string;
  messages: AgentMessage[];
  isRunning: boolean;
  cliStatus: ExecutionStatus;
  useCliSession: boolean;
  pipelineTemplate: PipelineTemplate | null;
  pipelineStatus: PipelineStatus;
  cliTools: CLIToolInfo[];
  workflowNodes: WorkflowNode[];
  currentWorkNode: WorkflowReviewNode | null;
  t: LanguageStrings;
}

export function useTaskDetailViewState({
  taskId,
  task,
  initialPrompt,
  messages,
  isRunning,
  cliStatus,
  useCliSession,
  pipelineTemplate,
  pipelineStatus,
  cliTools,
  workflowNodes,
  currentWorkNode,
  t,
}: UseTaskDetailViewStateInput) {
  const [hasStartedOnce, setHasStartedOnce] = useState(false);

  const normalizedTaskStatus = useMemo<PipelineDisplayStatus>(() => {
    const rawStatus = task?.status;
    if (!rawStatus) return 'todo';
    if (['todo', 'in_progress', 'in_review', 'done'].includes(rawStatus)) {
      return rawStatus as PipelineDisplayStatus;
    }
    return 'todo';
  }, [task?.status]);

  const isCliTaskReviewPending = useMemo(
    () => Boolean(useCliSession && !task?.pipeline_template_id && task?.status === 'in_review'),
    [task?.pipeline_template_id, task?.status, useCliSession]
  );

  useEffect(() => {
    if (task?.status && normalizedTaskStatus !== 'todo') {
      setHasStartedOnce(true);
    }
  }, [normalizedTaskStatus, task?.status]);

  useEffect(() => {
    if (messages.length > 0) {
      setHasStartedOnce(true);
    }
  }, [messages.length]);

  useEffect(() => {
    setHasStartedOnce(false);
  }, [taskId]);

  const markStartedOnce = useCallback(() => {
    setHasStartedOnce(true);
  }, []);

  const displayTitle = task?.title || task?.prompt || initialPrompt;

  const cliToolName = useMemo(() => {
    if (!task?.cli_tool_id) return null;
    const match = cliTools.find((tool) => tool.id === task.cli_tool_id);
    return match?.displayName || match?.name || task.cli_tool_id;
  }, [cliTools, task?.cli_tool_id]);

  const cliToolLabel = cliToolName || t.task.detailCli || 'CLI';

  const startDisabled = useMemo(() => {
    if (!taskId) return true;
    if (task?.pipeline_template_id) {
      return (
        !pipelineTemplate ||
        pipelineStatus !== 'idle' ||
        isRunning ||
        (useCliSession && cliStatus === 'running')
      );
    }
    if (useCliSession) {
      return cliStatus === 'running';
    }
    return isRunning;
  }, [
    cliStatus,
    isRunning,
    pipelineStatus,
    pipelineTemplate,
    task?.pipeline_template_id,
    taskId,
    useCliSession,
  ]);

  const hasExecuted = useMemo(() => {
    if (messages.length > 0) return true;
    if (hasStartedOnce) return true;
    if (isRunning) return true;
    if (!task) return false;
    if (task.status && normalizedTaskStatus !== 'todo') return true;
    return false;
  }, [hasStartedOnce, isRunning, messages.length, normalizedTaskStatus, task]);

  const showStartButton = !hasExecuted;
  const showActionButton = showStartButton || isCliTaskReviewPending;
  const actionLabel = isCliTaskReviewPending
    ? (t.task.completeTask || 'Complete task')
    : (t.task.startExecution || 'Start');
  const actionDisabled = isCliTaskReviewPending ? false : startDisabled;

  const displayStatus = useMemo<PipelineDisplayStatus | null>(() => {
    if (!task?.status) return null;
    return normalizedTaskStatus;
  }, [normalizedTaskStatus, task?.status]);

  const statusInfo = displayStatus ? statusConfig[displayStatus] : null;
  const StatusIcon = statusInfo?.icon || Clock;

  const executionStatus = useMemo<ExecutionStatus>(() => {
    if (useCliSession) return cliStatus;
    if (isRunning) return 'running';
    return 'idle';
  }, [cliStatus, isRunning, useCliSession]);

  const cliStatusInfo = useMemo(() => {
    const statusMap = {
      idle: {
        label: t.task.cliStatusIdle || 'Idle',
        color: 'text-muted-foreground bg-muted/60',
      },
      running: {
        label: t.task.cliStatusRunning || 'Running',
        color: 'text-blue-600 bg-blue-500/10',
      },
      stopped: {
        label: t.task.cliStatusStopped || 'Stopped',
        color: 'text-emerald-600 bg-emerald-500/10',
      },
      error: {
        label: t.task.cliStatusError || 'Error',
        color: 'text-red-600 bg-red-500/10',
      },
    };
    return statusMap[executionStatus];
  }, [
    executionStatus,
    t.task.cliStatusError,
    t.task.cliStatusIdle,
    t.task.cliStatusRunning,
    t.task.cliStatusStopped,
  ]);

  const showWorkflowCard = useMemo(
    () => Boolean(workflowNodes.length || pipelineTemplate?.nodes?.length) ||
      currentWorkNode?.status === 'in_review',
    [currentWorkNode?.status, pipelineTemplate?.nodes?.length, workflowNodes.length]
  );

  const workflowTemplateNodeMap = useMemo(() => {
    const map = new Map<string, { id: string; name?: string; prompt?: string }>();
    pipelineTemplate?.nodes?.forEach((node) => {
      map.set(node.id, node);
    });
    return map;
  }, [pipelineTemplate?.nodes]);

  const workflowNodesForDisplay = useMemo(() => {
    if (workflowNodes.length > 0) {
      return [...workflowNodes].sort((a, b) => a.node_order - b.node_order);
    }
    if (pipelineTemplate?.nodes?.length) {
      return pipelineTemplate.nodes.map((node, index) => ({
        id: `template-${node.id}`,
        work_node_template_id: node.id,
        node_order: index,
        status: 'todo' as const,
        name: node.name,
        prompt: node.prompt,
      }));
    }
    return [];
  }, [pipelineTemplate?.nodes, workflowNodes]);

  const metaRows = useMemo<TaskMetaRow[]>(
    () => [
      {
        key: 'branch',
        icon: GitBranch,
        value: task?.branch_name ? (
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
            {task.branch_name}
          </code>
        ) : null,
        visible: Boolean(task?.branch_name),
      },
      {
        key: 'status',
        icon: StatusIcon,
        value: statusInfo ? (
          <span className="text-foreground text-xs font-medium">
            {statusInfo.label}
          </span>
        ) : null,
        visible: Boolean(statusInfo),
      },
    ],
    [statusInfo, StatusIcon, task?.branch_name]
  );

  const visibleMetaRows = filterVisibleMetaRows(metaRows);

  return {
    normalizedTaskStatus,
    isCliTaskReviewPending,
    displayTitle,
    cliToolLabel,
    startDisabled,
    hasExecuted,
    showActionButton,
    actionLabel,
    actionDisabled,
    displayStatus,
    statusInfo,
    StatusIcon,
    executionStatus,
    cliStatusInfo,
    showWorkflowCard,
    workflowTemplateNodeMap,
    workflowNodesForDisplay,
    metaRows,
    visibleMetaRows,
    markStartedOnce,
  };
}

/**
 * useTaskDetail - Consolidated hook for task detail page
 *
 * This hook merges the functionality of 13 separate hooks into a single,
 * cohesive hook with clear sections:
 *
 * 1. Init - Task initialization and loading
 * 2. Dialogs - Edit/Delete dialog state
 * 3. CLI - CLI session management
 * 4. Pipeline - Pipeline execution
 * 5. Workflow - Workflow node management
 * 6. Artifacts - File artifacts extraction
 * 7. View State - UI state derivation
 * 8. Actions - User action handlers
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { Clock, GitBranch } from 'lucide-react';

import { db, type Task } from '@/data';
import { getSettings } from '@/data/settings';
import { newUlid, newUuid } from '@/lib/ids';
import type { AgentMessage, MessageAttachment } from '@/hooks/useAgent';
import { hasValidSearchResults, type Artifact } from '@/components/artifacts';
import { getArtifactTypeFromExt } from '@/components/task';
import type { CLISessionHandle } from '@/components/cli';

import { statusConfig } from './constants';
import {
  filterVisibleMetaRows,
  type CLIToolInfo,
  type ExecutionStatus,
  type PipelineDisplayStatus,
  type PipelineStatus,
  type PipelineTemplate,
  type TaskMetaRow,
  type WorkflowCurrentNode,
  type WorkflowNode,
  type WorkflowReviewNode,
  type LanguageStrings,
} from './types';

// ============================================================================
// Utils
// ============================================================================

const FILE_PATH_PATTERNS = [
  /`([^`]+\.(?:pptx|xlsx|docx|pdf))`/gi,
  /(\/[^\s"'`\n]+\.(?:pptx|xlsx|docx|pdf))/gi,
  /(\/[^\s"'\n]*[\u4e00-\u9fff][^\s"'\n]*\.(?:pptx|xlsx|docx|pdf))/gi,
];

const extractFilePaths = (text: string): string[] => {
  const results: string[] = [];
  for (const pattern of FILE_PATH_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const filePath = match[1] || match[0];
      if (filePath) results.push(filePath);
    }
  }
  return results;
};

const hasFilePathMatch = (text: string): boolean => {
  return FILE_PATH_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
};

// ============================================================================
// Types
// ============================================================================

interface UseTaskDetailInput {
  taskId?: string;
  initialPrompt: string;
  initialSessionId?: string;
  initialAttachmentsRef: React.MutableRefObject<MessageAttachment[] | undefined>;
  navigate: NavigateFunction;
  activeTaskId: string | null;
  messages: AgentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
  isRunning: boolean;
  stopAgent: () => Promise<void>;
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
  loadTask: (taskId: string) => Promise<Task | null>;
  loadMessages: (taskId: string) => Promise<void>;
  sessionFolder: string | null;
  t: LanguageStrings;
}

interface PipelineTemplateOption {
  id: string;
  name: string;
  description: string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTaskDetail({
  taskId,
  initialPrompt,
  initialSessionId,
  initialAttachmentsRef,
  navigate,
  activeTaskId,
  messages,
  setMessages,
  isRunning,
  stopAgent,
  runAgent,
  continueConversation,
  loadTask,
  loadMessages,
  sessionFolder,
  t,
}: UseTaskDetailInput) {
  // ===========================================================================
  // Section 1: Init State
  // ===========================================================================
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const isInitializingRef = useRef(false);
  const initializedTaskIdRef = useRef<string | null>(null);
  const prevTaskIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevTaskIdRef.current !== taskId) {
      if (prevTaskIdRef.current !== undefined) {
        setTask(null);
        setHasStarted(false);
        isInitializingRef.current = false;
        initializedTaskIdRef.current = null;
      }
      prevTaskIdRef.current = taskId;
    }
  }, [taskId]);

  useEffect(() => {
    async function initialize() {
      if (!taskId) { setIsLoading(false); return; }
      if (initializedTaskIdRef.current === taskId) return;
      if (isInitializingRef.current) return;
      isInitializingRef.current = true;

      try {
        setIsLoading(true);
        const existingTask = await loadTask(taskId);

        if (existingTask) {
          setTask(existingTask);
          await loadMessages(taskId);
          setHasStarted(true);
          setIsLoading(false);
        } else if (initialPrompt && !hasStarted) {
          setHasStarted(true);
          setIsLoading(false);
          setMessages([]);

          const sessionId = initialSessionId || null;
          try {
            const settings = getSettings();
            const createdTask = await db.createTask({
              id: taskId,
              session_id: sessionId ?? undefined,
              title: initialPrompt,
              prompt: initialPrompt,
              cli_tool_id: settings.defaultCliToolId || null,
            });
            setTask(createdTask);
          } catch (error) {
            console.error('[TaskDetail] Failed to initialize task:', error);
            const newTask = await loadTask(taskId);
            setTask(newTask);
          }
        } else {
          setIsLoading(false);
        }
      } finally {
        initializedTaskIdRef.current = taskId;
        isInitializingRef.current = false;
      }
    }
    void initialize();
  }, [taskId, loadMessages, loadTask, initialPrompt, initialSessionId, hasStarted, setMessages]);

  const useCliSession = Boolean(task?.cli_tool_id);

  // ===========================================================================
  // Section 2: CLI Tools
  // ===========================================================================
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([]);

  useEffect(() => {
    let active = true;
    const loadCliTools = async () => {
      try {
        const result = (await window.api?.cliTools?.getAll?.()) || (await window.api?.cliTools?.detectAll?.());
        if (active) setCliTools(Array.isArray(result) ? (result as CLIToolInfo[]) : []);
      } catch {
        if (active) setCliTools([]);
      }
    };
    void loadCliTools();
    return () => { active = false; };
  }, []);

  // ===========================================================================
  // Section 3: Dialog State
  // ===========================================================================
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editCliToolId, setEditCliToolId] = useState('');
  const [editPipelineTemplateId, setEditPipelineTemplateId] = useState('');
  const [pipelineTemplates, setPipelineTemplates] = useState<PipelineTemplateOption[]>([]);

  const handleOpenEdit = useCallback(() => {
    if (!task || task.status !== 'todo') return;
    setEditPrompt(task.prompt || '');
    setEditCliToolId(task.cli_tool_id || '');
    setEditPipelineTemplateId(task.pipeline_template_id || '');
    setIsEditOpen(true);
  }, [task]);

  const handleSaveEdit = useCallback(async () => {
    if (!taskId) return;
    const trimmedPrompt = editPrompt.trim();
    if (!trimmedPrompt) return;
    try {
      const updatedTask = await db.updateTask(taskId, {
        prompt: trimmedPrompt,
        cli_tool_id: editCliToolId || null,
        pipeline_template_id: editPipelineTemplateId || null,
      });
      if (updatedTask) setTask(updatedTask);
      setIsEditOpen(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }, [editCliToolId, editPipelineTemplateId, editPrompt, taskId]);

  const handleDeleteTask = useCallback(async () => {
    if (!taskId) return;
    try {
      await db.deleteTask(taskId);
      setIsDeleteOpen(false);
      navigate('/board', { replace: true });
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [navigate, taskId]);

  useEffect(() => {
    if (!isEditOpen) return;
    let active = true;
    const loadTemplates = async () => {
      if (!task?.project_id) { setPipelineTemplates([]); return; }
      try {
        const templates = await db.getWorkflowTemplatesByProject(task.project_id);
        if (active) setPipelineTemplates(templates as PipelineTemplateOption[]);
      } catch {
        if (active) setPipelineTemplates([]);
      }
    };
    void loadTemplates();
    return () => { active = false; };
  }, [isEditOpen, task?.project_id]);

  // ===========================================================================
  // Section 4: CLI Session
  // ===========================================================================
  const [cliStatus, setCliStatus] = useState<ExecutionStatus>('idle');
  const cliSessionRef = useRef<CLISessionHandle>(null);
  const pendingCliStartRef = useRef(false);
  const pendingCliPromptRef = useRef<string | undefined>(undefined);

  const ensureCliSessionId = useCallback(async (): Promise<string | null> => {
    if (!taskId) return null;
    if (task?.session_id) return task.session_id;
    const newSessionId = newUuid();
    try {
      const updated = await db.updateTask(taskId, { session_id: newSessionId });
      if (updated) {
        setTask(updated as Task);
      } else {
        setTask((prev) => (prev ? { ...prev, session_id: newSessionId } : prev));
      }
    } catch (error) {
      console.error('[TaskDetail] Failed to persist session_id:', error);
      setTask((prev) => (prev ? { ...prev, session_id: newSessionId } : prev));
    }
    return newSessionId;
  }, [setTask, task?.session_id, taskId]);

  useEffect(() => {
    if (!task?.session_id || !pendingCliStartRef.current) return;
    const promptOverride = pendingCliPromptRef.current;
    pendingCliStartRef.current = false;
    pendingCliPromptRef.current = undefined;
    cliSessionRef.current?.start(promptOverride).catch(() => {});
  }, [task?.session_id]);

  useEffect(() => { setCliStatus('idle'); }, [taskId]);

  const resolveCurrentExecutionId = useCallback(async () => {
    if (!taskId) return null;
    try {
      const workflow = (await db.getWorkflowByTaskId(taskId)) as { id: string; current_node_index: number } | null;
      if (!workflow) return null;
      const nodes = (await db.getWorkNodesByWorkflowId(workflow.id)) as Array<{ id: string }>;
      const currentNode = nodes[workflow.current_node_index];
      if (!currentNode) return null;
      const latestExecution = (await db.getLatestAgentExecution(currentNode.id)) as { id: string } | null;
      return latestExecution?.id ?? null;
    } catch (error) {
      console.error('[TaskDetail] Failed to resolve agent execution:', error);
      return null;
    }
  }, [taskId]);

  const markExecutionRunning = useCallback(async () => {
    const executionId = await resolveCurrentExecutionId();
    if (executionId) {
      try { await db.updateAgentExecutionStatus(executionId, 'running'); } catch { /* ignore */ }
    }
  }, [resolveCurrentExecutionId]);

  const markExecutionCompleted = useCallback(async () => {
    const executionId = await resolveCurrentExecutionId();
    if (executionId) {
      try { await db.updateAgentExecutionStatus(executionId, 'completed'); } catch { /* ignore */ }
    }
  }, [resolveCurrentExecutionId]);

  // Forward declare loadWorkflowStatus for use in handleCliStatusChange
  const loadWorkflowStatusRef = useRef<() => Promise<void>>(async () => {});

  const handleCliStatusChange = useCallback(
    (status: ExecutionStatus) => {
      setCliStatus(status);
      if (!taskId) return;
      if (status === 'running') {
        void markExecutionRunning();
      } else if (status === 'stopped') {
        void markExecutionCompleted();
        void loadWorkflowStatusRef.current();
        void (async () => {
          try {
            const workflow = await db.getWorkflowByTaskId(taskId);
            if (!workflow) {
              const updatedTask = await db.updateTask(taskId, { status: 'in_review' });
              if (updatedTask) setTask(updatedTask as Task);
            }
          } catch { /* ignore */ }
        })();
      }
    },
    [markExecutionCompleted, markExecutionRunning, taskId]
  );

  const runCliPrompt = useCallback(
    async (prompt?: string, sessionIdOverride?: string | null) => {
      const session = cliSessionRef.current;
      if (!session) return;
      const content = prompt?.trim() || '';

      let sessionId = sessionIdOverride ?? task?.session_id;
      if (!sessionId) {
        sessionId = await ensureCliSessionId();
        if (!sessionId) return;
        pendingCliStartRef.current = true;
        pendingCliPromptRef.current = content || undefined;
        return;
      }
      if (sessionId && window.api?.cliSession?.getSession) {
        try {
          const existingSession = await window.api.cliSession.getSession(sessionId);
          if (existingSession) {
            if (content) await session.sendInput(content);
            return;
          }
        } catch { /* ignore */ }
      }

      if (cliStatus === 'running') {
        if (content) await session.sendInput(content);
        return;
      }

      await session.start(content || undefined);
    },
    [cliStatus, ensureCliSessionId, task?.session_id]
  );

  const appendCliLog = useCallback(
    async (content: string, type: 'user_message' | 'system_message', sessionIdOverride?: string | null): Promise<string | null> => {
      if (!taskId) return null;
      const sessionId = sessionIdOverride ?? (await ensureCliSessionId());
      if (!sessionId) return null;
      const trimmed = content.trim();
      if (!trimmed || !window.api?.cliSession?.appendLog) return sessionId;
      const timestamp = Date.now();
      window.api.cliSession.appendLog(
        taskId,
        sessionId,
        {
          type: 'normalized',
          entry: { id: newUlid(), type, timestamp, content: trimmed },
          timestamp,
          task_id: taskId,
          session_id: sessionId
        },
        task?.project_id ?? null
      ).catch(() => {});
      return sessionId;
    },
    [ensureCliSessionId, task?.project_id, taskId]
  );

  const appendCliUserLog = useCallback(
    async (content: string, sessionIdOverride?: string | null) =>
      appendCliLog(content, 'user_message', sessionIdOverride),
    [appendCliLog]
  );
  const appendCliSystemLog = useCallback(
    async (content: string, sessionIdOverride?: string | null) =>
      appendCliLog(content, 'system_message', sessionIdOverride),
    [appendCliLog]
  );

  const stopCli = useCallback(async () => {
    try {
      const session = cliSessionRef.current;
      if (session) await session.stop();
      else if (task?.session_id && window.api?.cliSession?.stopSession) {
        await window.api.cliSession.stopSession(task.session_id);
      }
    } catch { /* ignore */ }
  }, [task?.session_id]);

  // ===========================================================================
  // Section 5: Prompt
  // ===========================================================================
  const baseTaskPrompt = useMemo(() => task?.prompt || initialPrompt || '', [initialPrompt, task?.prompt]);
  const taskPrompt = useMemo(() => task?.prompt || initialPrompt, [initialPrompt, task?.prompt]);

  const buildCliPrompt = useCallback(
    (nodePrompt?: string) => {
      const trimmedNode = nodePrompt?.trim();
      if (trimmedNode) return baseTaskPrompt ? `${baseTaskPrompt}\n\n${trimmedNode}` : trimmedNode;
      return baseTaskPrompt;
    },
    [baseTaskPrompt]
  );

  // ===========================================================================
  // Section 6: Tool Selection
  // ===========================================================================
  const [selectedToolIndex, setSelectedToolIndex] = useState<number | null>(null);
  const toolCount = useMemo(() => messages.filter((m) => m.type === 'tool_use').length, [messages]);

  useEffect(() => { if (isRunning && toolCount > 0) setSelectedToolIndex(toolCount - 1); }, [toolCount, isRunning]);
  useEffect(() => { setSelectedToolIndex(null); }, [taskId]);

  const toolSelectionValue = useMemo(
    () => ({ selectedToolIndex, setSelectedToolIndex, showComputer: () => {} }),
    [selectedToolIndex]
  );

  // ===========================================================================
  // Section 7: Scroll
  // ===========================================================================
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  useEffect(() => { userScrolledUpRef.current = false; lastScrollTopRef.current = 0; }, [taskId]);
  useEffect(() => { if (!userScrolledUpRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (scrollTop < lastScrollTopRef.current && distanceFromBottom > 100) userScrolledUpRef.current = true;
    if (distanceFromBottom < 50) userScrolledUpRef.current = false;
    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', checkScrollPosition);
    checkScrollPosition();
    return () => container.removeEventListener('scroll', checkScrollPosition);
  }, [checkScrollPosition]);

  useEffect(() => {
    if (!isLoading && messages.length > 0) requestAnimationFrame(() => checkScrollPosition());
  }, [checkScrollPosition, isLoading, messages.length]);

  // ===========================================================================
  // Section 8: Working Dir
  // ===========================================================================
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const workingDir = useMemo(() => {
    if (task?.workspace_path) return task.workspace_path;
    if (task?.worktree_path) return task.worktree_path;
    if (sessionFolder) return sessionFolder;
    for (const artifact of artifacts) {
      if (artifact.path?.includes('/sessions/')) {
        const match = artifact.path.match(/^(.+\/sessions\/[^/]+)/);
        if (match) return match[1];
      }
    }
    return '';
  }, [artifacts, sessionFolder, task?.workspace_path, task?.worktree_path]);

  // ===========================================================================
  // Section 9: Pipeline
  // ===========================================================================
  const [pipelineTemplate, setPipelineTemplate] = useState<PipelineTemplate | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [pipelineStageIndex, setPipelineStageIndex] = useState(0);
  const [pipelineStageMessageStart, setPipelineStageMessageStart] = useState(0);

  useEffect(() => {
    if (!task?.pipeline_template_id) { setPipelineTemplate(null); setPipelineStatus('idle'); return; }
    let active = true;
    const loadTemplate = async () => {
      try {
        const template = (await db.getWorkflowTemplate(task.pipeline_template_id!)) as PipelineTemplate | null;
        if (active) { setPipelineTemplate(template); setPipelineStageIndex(0); setPipelineStatus('idle'); }
      } catch { /* ignore */ }
    };
    void loadTemplate();
    return () => { active = false; };
  }, [task?.pipeline_template_id]);

  // ===========================================================================
  // Section 10: Workflow
  // ===========================================================================
  const [currentWorkNode, setCurrentWorkNode] = useState<WorkflowReviewNode | null>(null);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowCurrentNode, setWorkflowCurrentNode] = useState<WorkflowCurrentNode | null>(null);

  const isMountedRef = useRef(true);
  const workflowPrevTaskIdRef = useRef<string | undefined>(undefined);
  const lastAutoRunWorkNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (workflowPrevTaskIdRef.current !== taskId) {
      if (workflowPrevTaskIdRef.current !== undefined) {
        setCurrentWorkNode(null);
        setWorkflowNodes([]);
        setWorkflowCurrentNode(null);
        lastAutoRunWorkNodeIdRef.current = null;
      }
      workflowPrevTaskIdRef.current = taskId;
    }
  }, [taskId]);

  const resolveWorkNodePrompt = useCallback(
    async (workNodeId?: string | null, nodeIndex?: number | null, templateId?: string | null) => {
      const sortedNodes = [...workflowNodes].sort((a, b) => a.node_order - b.node_order);
      const fromState =
        (workNodeId ? sortedNodes.find((n) => n.id === workNodeId) : null) ||
        (typeof nodeIndex === 'number' ? sortedNodes[nodeIndex] : null) ||
        sortedNodes.find((n) => n.node_order === nodeIndex) ||
        (templateId ? sortedNodes.find((n) => n.work_node_template_id === templateId || n.template_node_id === templateId) : null);
      if (fromState?.prompt?.trim()) return fromState.prompt.trim();

      if (!taskId) return '';
      try {
        const workflow = (await db.getWorkflowByTaskId(taskId)) as { id: string } | null;
        if (!workflow) return '';
        const nodes = (await db.getWorkNodesByWorkflowId(workflow.id)) as Array<{ id: string; node_order: number; template_node_id?: string | null; work_node_template_id?: string | null; prompt?: string }>;
        const byId = workNodeId ? nodes.find((n) => n.id === workNodeId) : null;
        const byIndex = typeof nodeIndex === 'number' ? [...nodes].sort((a, b) => a.node_order - b.node_order)[nodeIndex] : null;
        const byTemplate = templateId ? nodes.find((n) => n.work_node_template_id === templateId || n.template_node_id === templateId) : null;
        return (byId?.prompt || byIndex?.prompt || byTemplate?.prompt || '').trim();
      } catch { return ''; }
    },
    [taskId, workflowNodes]
  );

  const loadWorkflowStatus = useCallback(async () => {
    if (!taskId) return;
    try {
      const workflow = (await db.getWorkflowByTaskId(taskId)) as { id: string; current_node_index: number; status: string } | null;
      if (!workflow) {
        if (isMountedRef.current) { setCurrentWorkNode(null); setWorkflowNodes([]); setWorkflowCurrentNode(null); }
        return;
      }

      const nodes = (await db.getWorkNodesByWorkflowId(workflow.id)) as Array<{ id: string; template_node_id?: string | null; work_node_template_id?: string | null; node_order: number; status: PipelineDisplayStatus; name?: string; prompt?: string }>;
      const normalizedNodes = nodes.map((n) => ({
        ...n,
        work_node_template_id: n.work_node_template_id || n.template_node_id || '',
        template_node_id: n.template_node_id || n.work_node_template_id || null,
      }));

      const currentNode = normalizedNodes[workflow.current_node_index];
      if (!currentNode) {
        if (isMountedRef.current) { setCurrentWorkNode(null); setWorkflowCurrentNode(null); setWorkflowNodes(normalizedNodes); }
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
        if (useCliSession) setPipelineStageIndex(workflow.current_node_index);
      }

      if (currentNode.status === 'in_review') {
        const nodeTemplate = pipelineTemplate?.nodes.find((n) => n.id === (currentNode.work_node_template_id || currentNode.template_node_id));
        const fallbackName = `${t.task.stageLabel} ${workflow.current_node_index + 1}`;
        if (isMountedRef.current) {
          setCurrentWorkNode({ id: currentNode.id, name: currentNode.name || nodeTemplate?.name || fallbackName, status: currentNode.status as 'in_review' });
        }
        return;
      }

      if (isMountedRef.current) setCurrentWorkNode(null);
    } catch { /* ignore */ }
  }, [pipelineTemplate, taskId, t.task.stageLabel, useCliSession]);

  // Assign to ref for use in handleCliStatusChange
  loadWorkflowStatusRef.current = loadWorkflowStatus;

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    void (async () => { if (active) await loadWorkflowStatus(); })();
    const shouldPoll = isRunning || cliStatus === 'running';
    const interval = shouldPoll ? setInterval(() => { if (active) void loadWorkflowStatus(); }, 2000) : null;
    return () => { active = false; if (interval) clearInterval(interval); };
  }, [taskId, loadWorkflowStatus, isRunning, cliStatus]);

  useEffect(() => {
    if (!taskId || isRunning || cliStatus === 'running') return;
    let attempts = 0;
    const interval = setInterval(() => { attempts++; void loadWorkflowStatus(); if (attempts >= 8) clearInterval(interval); }, 500);
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
        if (updatedTask) setTask(updatedTask as Task);
      } catch { /* ignore */ }
    }
  }, [currentWorkNode, loadWorkflowStatus, taskId]);

  // ===========================================================================
  // Section 11: Pipeline Actions
  // ===========================================================================
  const appendPipelineNotice = useCallback(
    async (content: string) => { if (taskId) setMessages((prev) => [...prev, { type: 'text', content }]); },
    [setMessages, taskId]
  );

  const startPipelineStage = useCallback(
    async (index: number, approvalNote?: string) => {
      if (!pipelineTemplate || !taskId) return;
      const stage = pipelineTemplate.nodes?.[index];
      if (!stage) {
        setPipelineStatus('completed');
        try { await db.updateTask(taskId, { status: 'done' }); } catch { /* ignore */ }
        await appendPipelineNotice(t.task.pipelineCompleted);
        return;
      }

      const resolvedPrompt = await resolveWorkNodePrompt(null, index, stage.id);
      const baseNodePrompt = resolvedPrompt || stage.prompt || '';
      const nodePrompt = approvalNote ? `${baseNodePrompt}\n\n${t.task.pipelineApprovalNotePrefix}: ${approvalNote}` : baseNodePrompt;
      const prompt = buildCliPrompt(nodePrompt);

      setPipelineStageIndex(index);
      setPipelineStatus('running');
      setPipelineStageMessageStart(messages.length);
      try { await db.updateTask(taskId, { status: 'in_progress' }); } catch { /* ignore */ }

      if (useCliSession) {
        try {
          const sessionId = await appendCliUserLog(prompt);
          await runCliPrompt(prompt, sessionId);
        } catch {
          setPipelineStatus('failed');
        }
        return;
      }

      const sessionInfo = task?.session_id ? { sessionId: task.session_id } : undefined;
      if (messages.length === 0) {
        await runAgent(prompt, taskId, sessionInfo, undefined, workingDir || undefined);
      } else {
        await continueConversation(prompt, undefined, workingDir || undefined);
      }
    },
    [appendCliUserLog, appendPipelineNotice, buildCliPrompt, continueConversation, messages.length, pipelineTemplate, resolveWorkNodePrompt, runAgent, runCliPrompt, task?.session_id, taskId, t.task.pipelineApprovalNotePrefix, t.task.pipelineCompleted, useCliSession, workingDir]
  );

  const startNextPipelineStage = useCallback(
    async (approvalNote?: string) => { await startPipelineStage(pipelineStageIndex + 1, approvalNote); },
    [pipelineStageIndex, startPipelineStage]
  );

  const normalizedTaskStatus = useMemo<PipelineDisplayStatus>(() => {
    const rawStatus = task?.status;
    if (!rawStatus) return 'todo';
    if (['todo', 'in_progress', 'in_review', 'done'].includes(rawStatus)) return rawStatus as PipelineDisplayStatus;
    return 'todo';
  }, [task?.status]);

  // Auto-start pipeline
  useEffect(() => {
    if (!pipelineTemplate || pipelineStatus !== 'idle' || isRunning) return;
    if (useCliSession && cliStatus === 'running') return;
    if (!taskId || messages.length > 0) return;
    if (normalizedTaskStatus !== 'in_progress') return;

    let active = true;
    const maybeStart = async () => {
      try {
        const workflow = (await db.getWorkflowByTaskId(taskId)) as { id: string; current_node_index: number } | null;
        if (workflow) {
          const nodes = (await db.getWorkNodesByWorkflowId(workflow.id)) as Array<{ id: string }>;
          const currentNode = nodes[workflow.current_node_index];
          if (!currentNode) return;
          const latestExecution = (await db.getLatestAgentExecution(currentNode.id)) as { status: string } | null;
          if (latestExecution && latestExecution.status !== 'idle') return;
        }
      } catch { return; }
      if (!active) return;
      startPipelineStage(0).catch(() => {});
    };
    void maybeStart();
    return () => { active = false; };
  }, [cliStatus, isRunning, messages.length, normalizedTaskStatus, pipelineStatus, pipelineTemplate, startPipelineStage, taskId, useCliSession]);

  // Handle pipeline stage completion
  useEffect(() => {
    if (!pipelineTemplate || pipelineStatus !== 'running' || isRunning) return;
    const stageMessages = messages.slice(pipelineStageMessageStart);
    let outcome: (typeof stageMessages)[number] | undefined;
    for (let i = stageMessages.length - 1; i >= 0; i--) {
      if (stageMessages[i].type === 'result' || stageMessages[i].type === 'error') { outcome = stageMessages[i]; break; }
    }
    if (!outcome || !taskId) return;

    const stage = pipelineTemplate.nodes?.[pipelineStageIndex];
    const stageName = stage?.name || `${t.task.stageLabel} ${pipelineStageIndex + 1}`;

    if (outcome.type === 'result' && outcome.subtype === 'success') {
      setPipelineStatus('waiting_approval');
      db.updateTask(taskId, { status: 'in_review' }).catch(() => {});
      appendPipelineNotice(t.task.pipelineStageCompleted.replace('{name}', stageName));
    } else {
      setPipelineStatus('failed');
      appendPipelineNotice(t.task.pipelineStageFailed.replace('{name}', stageName));
    }
  }, [appendPipelineNotice, isRunning, messages, pipelineStageIndex, pipelineStageMessageStart, pipelineStatus, pipelineTemplate, taskId, t.task.pipelineStageCompleted, t.task.pipelineStageFailed, t.task.stageLabel]);

  const pipelineBanner = useMemo(() => {
    if (!pipelineTemplate) return null;
    const stage = pipelineTemplate.nodes?.[pipelineStageIndex];
    const stageName = stage?.name || `${t.task.stageLabel} ${pipelineStageIndex + 1}`;
    if (pipelineStatus === 'waiting_approval') return t.task.pipelineStageCompleted.replace('{name}', stageName);
    if (pipelineStatus === 'failed') return t.task.pipelineStageFailed.replace('{name}', stageName);
    if (pipelineStatus === 'completed') return t.task.pipelineCompleted;
    return null;
  }, [pipelineStageIndex, pipelineStatus, pipelineTemplate, t.task.pipelineCompleted, t.task.pipelineStageCompleted, t.task.pipelineStageFailed, t.task.stageLabel]);

  // Auto-run workflow node for CLI session
  useEffect(() => {
    if (!useCliSession || !workflowCurrentNode || workflowCurrentNode.status !== 'in_progress' || cliStatus === 'running') return;
    if (lastAutoRunWorkNodeIdRef.current === workflowCurrentNode.id) return;
    let active = true;
    const run = async () => {
      const sessionId = task?.session_id;
      if (sessionId && window.api?.cliSession?.getSession) {
        try {
          const existingSession = await window.api.cliSession.getSession(sessionId);
          if (!active) return;
          if (existingSession?.status === 'running') return;
        } catch { /* ignore */ }
      }

      try {
        const latestExecution = (await db.getLatestAgentExecution(workflowCurrentNode.id)) as { status: string } | null;
        if (!active) return;
        if (latestExecution && latestExecution.status !== 'idle') return;
      } catch { if (!active) return; }

      const templateNode = pipelineTemplate?.nodes?.find((n) => n.id === workflowCurrentNode.templateId);
      const resolvedPrompt = await resolveWorkNodePrompt(workflowCurrentNode.id, workflowCurrentNode.index, workflowCurrentNode.templateId);
      const nodePrompt = resolvedPrompt || templateNode?.prompt || '';
      const prompt = buildCliPrompt(nodePrompt);
      if (!prompt.trim() || !active) return;

      lastAutoRunWorkNodeIdRef.current = workflowCurrentNode.id;
      const sessionId = await appendCliUserLog(prompt);
      await runCliPrompt(prompt, sessionId);
    };
    void run();
    return () => { active = false; };
  }, [appendCliUserLog, buildCliPrompt, cliStatus, pipelineTemplate, resolveWorkNodePrompt, runCliPrompt, task?.session_id, useCliSession, workflowCurrentNode]);

  // ===========================================================================
  // Section 12: Artifacts
  // ===========================================================================
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);

  const lastWorkspaceRefreshMessageIndexRef = useRef(0);
  const prevRunStateRef = useRef<{ isRunning: boolean; cliStatus: ExecutionStatus }>({ isRunning: false, cliStatus: 'idle' });
  const artifactsPrevTaskIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (artifactsPrevTaskIdRef.current !== taskId) {
      if (artifactsPrevTaskIdRef.current !== undefined) {
        setIsPreviewVisible(false);
        setSelectedArtifact(null);
        setArtifacts([]);
        lastWorkspaceRefreshMessageIndexRef.current = 0;
        setWorkspaceRefreshToken(0);
      }
      artifactsPrevTaskIdRef.current = taskId;
    }
  }, [taskId]);

  const handleSelectArtifact = useCallback((artifact: Artifact | null) => {
    setSelectedArtifact(artifact);
    if (artifact) setIsPreviewVisible(true);
  }, []);

  const handleClosePreview = useCallback(() => { setSelectedArtifact(null); }, []);

  // Extract artifacts from messages
  useEffect(() => {
    const extractedArtifacts: Artifact[] = [];
    const seenPaths = new Set<string>();

    messages.forEach((msg) => {
      if (msg.type === 'tool_use' && msg.name === 'Write') {
        const input = msg.input as Record<string, unknown> | undefined;
        const filePath = input?.file_path as string | undefined;
        const content = input?.content as string | undefined;
        if (filePath && !seenPaths.has(filePath)) {
          seenPaths.add(filePath);
          const filename = filePath.split('/').pop() || filePath;
          const ext = filename.split('.').pop()?.toLowerCase();
          extractedArtifacts.push({ id: filePath, name: filename, type: getArtifactTypeFromExt(ext), content, path: filePath });
        }
      }

      if (msg.type === 'tool_use' && msg.name === 'WebSearch') {
        const input = msg.input as Record<string, unknown> | undefined;
        const query = input?.query as string | undefined;
        const toolUseId = msg.id;
        if (query) {
          let output = '';
          if (toolUseId) {
            const resultMsg = messages.find((m) => m.type === 'tool_result' && m.toolUseId === toolUseId);
            output = resultMsg?.output || '';
          }
          if (!output) {
            const msgIndex = messages.indexOf(msg);
            for (let i = msgIndex + 1; i < messages.length; i++) {
              if (messages[i].type === 'tool_result') { output = messages[i].output || ''; break; }
              if (messages[i].type === 'tool_use') break;
            }
          }
          const artifactId = `websearch-${query}`;
          if (!seenPaths.has(artifactId) && output && hasValidSearchResults(output)) {
            seenPaths.add(artifactId);
            extractedArtifacts.push({ id: artifactId, name: `Search: ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}`, type: 'websearch', content: output });
          }
        }
      }
    });

    messages.forEach((msg) => {
      const textToSearch = msg.type === 'tool_result' ? msg.output : msg.type === 'text' ? msg.content : null;
      if (textToSearch) {
        const filePaths = extractFilePaths(textToSearch);
        for (const filePath of filePaths) {
          if (filePath && !seenPaths.has(filePath)) {
            seenPaths.add(filePath);
            const filename = filePath.split('/').pop() || filePath;
            const ext = filename.split('.').pop()?.toLowerCase();
            extractedArtifacts.push({ id: filePath, name: filename, type: getArtifactTypeFromExt(ext), path: filePath });
          }
        }
      }
    });

    setArtifacts(extractedArtifacts);
  }, [messages, taskId]);

  // Workspace refresh tracking
  useEffect(() => {
    if (messages.length < lastWorkspaceRefreshMessageIndexRef.current) lastWorkspaceRefreshMessageIndexRef.current = 0;
    if (messages.length === 0) return;
    const startIndex = lastWorkspaceRefreshMessageIndexRef.current;
    if (startIndex >= messages.length) return;

    const newMessages = messages.slice(startIndex);
    lastWorkspaceRefreshMessageIndexRef.current = messages.length;

    let shouldRefresh = false;
    for (const msg of newMessages) {
      if (msg.type === 'tool_use' && msg.name === 'Write') { shouldRefresh = true; break; }
      const textToSearch = msg.type === 'tool_result' ? msg.output : msg.type === 'text' ? msg.content : null;
      if (textToSearch && hasFilePathMatch(textToSearch)) { shouldRefresh = true; break; }
    }
    if (shouldRefresh) setWorkspaceRefreshToken((prev) => prev + 1);
  }, [messages]);

  useEffect(() => {
    const prev = prevRunStateRef.current;
    const wasRunning = prev.isRunning || prev.cliStatus === 'running';
    const isNowRunning = isRunning || cliStatus === 'running';
    if (wasRunning && !isNowRunning) setWorkspaceRefreshToken((prevToken) => prevToken + 1);
    prevRunStateRef.current = { isRunning, cliStatus };
  }, [cliStatus, isRunning]);

  // ===========================================================================
  // Section 13: View State
  // ===========================================================================
  const [hasStartedOnce, setHasStartedOnce] = useState(false);

  const isCliTaskReviewPending = useMemo(
    () => Boolean(useCliSession && !task?.pipeline_template_id && task?.status === 'in_review'),
    [task?.pipeline_template_id, task?.status, useCliSession]
  );

  useEffect(() => { if (task?.status && normalizedTaskStatus !== 'todo') setHasStartedOnce(true); }, [normalizedTaskStatus, task?.status]);
  useEffect(() => { if (messages.length > 0) setHasStartedOnce(true); }, [messages.length]);
  useEffect(() => { setHasStartedOnce(false); }, [taskId]);

  const markStartedOnce = useCallback(() => { setHasStartedOnce(true); }, []);

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
      return !pipelineTemplate || pipelineStatus !== 'idle' || isRunning || (useCliSession && cliStatus === 'running');
    }
    if (useCliSession) return cliStatus === 'running';
    return isRunning;
  }, [cliStatus, isRunning, pipelineStatus, pipelineTemplate, task?.pipeline_template_id, taskId, useCliSession]);

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
  const actionLabel = isCliTaskReviewPending ? (t.task.completeTask || 'Complete task') : (t.task.startExecution || 'Start');
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
      idle: { label: t.task.cliStatusIdle || 'Idle', color: 'text-muted-foreground bg-muted/60' },
      running: { label: t.task.cliStatusRunning || 'Running', color: 'text-blue-600 bg-blue-500/10' },
      stopped: { label: t.task.cliStatusStopped || 'Stopped', color: 'text-emerald-600 bg-emerald-500/10' },
      error: { label: t.task.cliStatusError || 'Error', color: 'text-red-600 bg-red-500/10' },
    };
    return statusMap[executionStatus];
  }, [executionStatus, t.task.cliStatusError, t.task.cliStatusIdle, t.task.cliStatusRunning, t.task.cliStatusStopped]);

  const showWorkflowCard = useMemo(
    () => Boolean(workflowNodes.length || pipelineTemplate?.nodes?.length) || currentWorkNode?.status === 'in_review',
    [currentWorkNode?.status, pipelineTemplate?.nodes?.length, workflowNodes.length]
  );

  const workflowTemplateNodeMap = useMemo(() => {
    const map = new Map<string, { id: string; name?: string; prompt?: string }>();
    pipelineTemplate?.nodes?.forEach((node) => { map.set(node.id, node); });
    return map;
  }, [pipelineTemplate?.nodes]);

  const workflowNodesForDisplay = useMemo(() => {
    if (workflowNodes.length > 0) return [...workflowNodes].sort((a, b) => a.node_order - b.node_order);
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
        value: task?.branch_name ? <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{task.branch_name}</code> : null,
        visible: Boolean(task?.branch_name),
      },
      {
        key: 'status',
        icon: StatusIcon,
        value: statusInfo ? <span className="text-foreground text-xs font-medium">{statusInfo.label}</span> : null,
        visible: Boolean(statusInfo),
      },
    ],
    [statusInfo, StatusIcon, task?.branch_name]
  );

  const visibleMetaRows = filterVisibleMetaRows(metaRows);

  // ===========================================================================
  // Section 14: Actions
  // ===========================================================================
  const handleReply = useCallback(
    async (text: string, messageAttachments?: MessageAttachment[]) => {
      if ((text.trim() || (messageAttachments && messageAttachments.length > 0)) && taskId) {
        if (!useCliSession && isRunning) return;
        if (useCliSession) {
          const content = text.trim();
          let sessionId: string | null = null;
          if (content) {
            sessionId = await appendCliUserLog(content);
          }
          if (task?.status === 'in_review') {
            try {
              const updatedTask = await db.updateTask(taskId, { status: 'in_progress' });
              if (updatedTask) setTask(updatedTask);
            } catch { /* ignore */ }
          }
          try {
            if (content) {
              if (!cliSessionRef.current) throw new Error('CLI session not initialized');
              await runCliPrompt(content, sessionId);
            }
          } catch {
            await appendCliSystemLog(
              t.common.errors.serverNotRunning || 'CLI session is not running.',
              sessionId
            );
          }
          return;
        }
        if (activeTaskId !== taskId) await loadMessages(taskId);
        if (pipelineTemplate && (pipelineStatus === 'waiting_approval' || pipelineStatus === 'failed')) {
          const approvalNote = text.trim();
          if (approvalNote) setMessages((prev) => [...prev, { type: 'user', content: approvalNote }]);
          await startNextPipelineStage(approvalNote);
          return;
        }
        await continueConversation(text.trim(), messageAttachments, workingDir || undefined);
      }
    },
    [activeTaskId, appendCliSystemLog, appendCliUserLog, continueConversation, isRunning, loadMessages, pipelineStatus, pipelineTemplate, runCliPrompt, setMessages, setTask, startNextPipelineStage, t.common.errors.serverNotRunning, task?.status, taskId, useCliSession, workingDir]
  );

  const handleStartTask = useCallback(async () => {
    if (!taskId) return;
    markStartedOnce();
    if (!task?.pipeline_template_id) {
      try {
        const updatedTask = await db.updateTask(taskId, { status: 'in_progress' });
        if (updatedTask) setTask(updatedTask);
      } catch { /* ignore */ }
    }
    if (task?.pipeline_template_id) {
      if (!pipelineTemplate || pipelineStatus !== 'idle' || isRunning) return;
      await startPipelineStage(0);
      return;
    }

      if (useCliSession) {
        try {
          if (!cliSessionRef.current) throw new Error('CLI session not initialized');
          let prompt = task?.prompt || initialPrompt;
          if (task?.workflow_template_id || workflowCurrentNode) {
            const nodePrompt = await resolveWorkNodePrompt(workflowCurrentNode?.id, workflowCurrentNode?.index ?? 0, workflowCurrentNode?.templateId);
            const composed = buildCliPrompt(nodePrompt);
            if (composed.trim()) prompt = composed;
          }
          let sessionId: string | null = null;
          if (prompt) {
            sessionId = await appendCliUserLog(prompt);
          }
          await runCliPrompt(prompt, sessionId);
        } catch {
          await appendCliSystemLog(t.common.errors.serverNotRunning || 'CLI session is not running.');
        }
        return;
      }

    const sessionInfo = task?.session_id ? { sessionId: task.session_id } : undefined;
    const pendingAttachments = initialAttachmentsRef.current;
    initialAttachmentsRef.current = undefined;
    await runAgent(task?.prompt || initialPrompt, taskId, sessionInfo, pendingAttachments, workingDir || undefined);
  }, [appendCliSystemLog, appendCliUserLog, buildCliPrompt, initialPrompt, initialAttachmentsRef, isRunning, markStartedOnce, pipelineStatus, pipelineTemplate, resolveWorkNodePrompt, runAgent, runCliPrompt, setTask, startPipelineStage, t.common.errors.serverNotRunning, task?.pipeline_template_id, task?.prompt, task?.session_id, task?.workflow_template_id, taskId, useCliSession, workingDir, workflowCurrentNode]);

  const handleApproveCliTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const updatedTask = await db.updateTask(taskId, { status: 'done' });
      if (updatedTask) setTask(updatedTask);
    } catch { /* ignore */ }
  }, [setTask, taskId]);

  const handleStopExecution = useCallback(async () => {
    if (useCliSession) { await stopCli(); return; }
    await stopAgent();
  }, [stopAgent, stopCli, useCliSession]);

  const replyIsRunning = useMemo(() => {
    if (useCliSession) return cliStatus === 'running';
    return isRunning;
  }, [cliStatus, isRunning, useCliSession]);

  // ===========================================================================
  // Return
  // ===========================================================================
  return {
    // Task
    task,
    setTask,
    isLoading,
    useCliSession,

    // CLI Tools
    cliTools,

    // Dialogs
    isEditOpen,
    setIsEditOpen,
    editPrompt,
    setEditPrompt,
    editCliToolId,
    setEditCliToolId,
    editPipelineTemplateId,
    setEditPipelineTemplateId,
    pipelineTemplates,
    isDeleteOpen,
    setIsDeleteOpen,
    handleOpenEdit,
    handleSaveEdit,
    handleDeleteTask,

    // CLI Session
    cliStatus,
    cliSessionRef,
    handleCliStatusChange,

    // Prompt
    taskPrompt,

    // Tool Selection
    toolSelectionValue,

    // Scroll
    messagesEndRef,
    messagesContainerRef,

    // Working Dir
    workingDir,

    // Pipeline
    pipelineTemplate,
    pipelineStatus,
    pipelineBanner,
    startPipelineStage,
    startNextPipelineStage,

    // Workflow
    currentWorkNode,
    workflowNodes,
    workflowCurrentNode,
    handleApproveWorkNode,

    // Artifacts
    artifacts,
    selectedArtifact,
    isPreviewVisible,
    workspaceRefreshToken,
    handleSelectArtifact,
    handleClosePreview,
    setIsPreviewVisible,

    // View State
    displayTitle,
    cliToolLabel,
    cliStatusInfo,
    showActionButton,
    actionLabel,
    actionDisabled,
    showWorkflowCard,
    workflowTemplateNodeMap,
    workflowNodesForDisplay,
    visibleMetaRows,

    // Actions
    handleReply,
    handleStartTask,
    handleApproveCliTask,
    handleStopExecution,
    replyIsRunning,
    isCliTaskReviewPending,
  };
}

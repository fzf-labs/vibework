import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db, type Task } from '@/data';
import { getSettings } from '@/data/settings';
import {
  useAgent,
  type MessageAttachment,
} from '@/hooks/useAgent';
import { useVitePreview } from '@/hooks/useVitePreview';
import { newUlid, newUuid } from '@/lib/ids';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import {
  CheckCircle,
  Clock,
  Play,
  GitBranch,
} from 'lucide-react';

import { hasValidSearchResults, type Artifact } from '@/components/artifacts';
import { LeftSidebar, useSidebar } from '@/components/layout';
import { type CLISessionHandle } from '@/components/cli';
import {
  ToolSelectionContext,
  getArtifactTypeFromExt,
} from '@/components/task';

import { ExecutionPanel } from './components/ExecutionPanel';
import { ReplyCard } from './components/ReplyCard';
import { RightPanelSection } from './components/RightPanelSection';
import { TaskCard } from './components/TaskCard';
import { TaskDialogs } from './components/TaskDialogs';
import { WorkflowCard, type WorkflowDisplayNode } from './components/WorkflowCard';
import { filterVisibleMetaRows, type PipelineDisplayStatus, type TaskMetaRow } from './types';

interface LocationState {
  prompt?: string;
  sessionId?: string;
  attachments?: MessageAttachment[];
}

interface WorkNodeTemplate {
  id: string;
  workflow_template_id: string;
  node_order: number;
  name: string;
  prompt: string;
  requires_approval: boolean;
  continue_on_error: boolean;
  created_at: string;
  updated_at: string;
}

interface PipelineTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: 'global' | 'project';
  project_id: string | null;
  created_at: string;
  updated_at: string;
  nodes: WorkNodeTemplate[];
}

interface CLIToolInfo {
  id: string;
  name?: string;
  displayName?: string;
}

const statusConfig: Record<
  PipelineDisplayStatus,
  { icon: typeof Clock; label: string; color: string }
> = {
  todo: {
    icon: Clock,
    label: 'Todo',
    color: 'text-slate-500 bg-slate-500/10',
  },
  in_progress: {
    icon: Play,
    label: 'In Progress',
    color: 'text-blue-500 bg-blue-500/10',
  },
  in_review: {
    icon: Clock,
    label: 'In Review',
    color: 'text-amber-500 bg-amber-500/10',
  },
  done: {
    icon: CheckCircle,
    label: 'Done',
    color: 'text-green-500 bg-green-500/10',
  },
};

export function TaskDetailContainer() {
  const { t } = useLanguage();
  const { taskId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const initialPrompt = state?.prompt || '';
  const initialSessionId = state?.sessionId;
  const initialAttachments = state?.attachments;

  const {
    taskId: activeTaskId,
    messages,
    setMessages,
    isRunning,
    stopAgent,
    runAgent,
    continueConversation,
    loadTask,
    loadMessages,
    phase,
    approvePlan,
    rejectPlan,
    sessionFolder,
  } = useAgent();
  const { toggleLeft } = useSidebar();
  const [hasStarted, setHasStarted] = useState(false);
  const isInitializingRef = useRef(false);
  const initializedTaskIdRef = useRef<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const useCliSession = Boolean(task?.cli_tool_id);
  const [pipelineTemplate, setPipelineTemplate] =
    useState<PipelineTemplate | null>(null);
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([]);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editCliToolId, setEditCliToolId] = useState('');
  const [editPipelineTemplateId, setEditPipelineTemplateId] = useState('');
  const [pipelineTemplates, setPipelineTemplates] = useState<PipelineTemplate[]>([]);
  const [pipelineStageIndex, setPipelineStageIndex] = useState(0);
  const [pipelineStatus, setPipelineStatus] = useState<
    'idle' | 'running' | 'waiting_approval' | 'failed' | 'completed'
  >('idle');
  const [pipelineStageMessageStart, setPipelineStageMessageStart] = useState(0);
  const cliSessionRef = useRef<CLISessionHandle>(null);
  const [cliStatus, setCliStatus] = useState<
    'idle' | 'running' | 'stopped' | 'error'
  >('idle');
  const initialAttachmentsRef = useRef<MessageAttachment[] | undefined>(
    initialAttachments
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevTaskIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(true);
  const lastAutoRunWorkNodeIdRef = useRef<string | null>(null);

  // Workflow state for review panel
  const [currentWorkNode, setCurrentWorkNode] = useState<{
    id: string;
    name: string;
    status: 'todo' | 'in_progress' | 'in_review' | 'done';
  } | null>(null);
  const [workflowNodes, setWorkflowNodes] = useState<Array<{
    id: string;
    work_node_template_id: string;
    template_node_id?: string | null;
    node_order: number;
    status: 'todo' | 'in_progress' | 'in_review' | 'done';
    name?: string;
    prompt?: string;
  }>>([]);
  const [workflowCurrentNode, setWorkflowCurrentNode] = useState<{
    id: string;
    templateId: string;
    status: 'todo' | 'in_progress' | 'in_review' | 'done';
    index: number;
  } | null>(null);

  // Panel visibility state - default to visible for new layout
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  // Track if user has manually scrolled up (to disable auto-scroll)
  const userScrolledUpRef = useRef(false);
  // Track last scroll position to detect scroll direction
  const lastScrollTopRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);

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

  const baseTaskPrompt = useMemo(
    () => task?.prompt || initialPrompt || '',
    [initialPrompt, task?.prompt]
  );

  const buildCliPrompt = useCallback(
    (nodePrompt?: string) => {
      const trimmedNode = nodePrompt?.trim();
      if (trimmedNode) {
        return baseTaskPrompt
          ? `${baseTaskPrompt}\n\n${trimmedNode}`
          : trimmedNode;
      }
      return baseTaskPrompt;
    },
    [baseTaskPrompt]
  );

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
        const workflow = await db.getWorkflowByTaskId(taskId) as {
          id: string;
        } | null;
        if (!workflow) return '';

        const nodes = await db.getWorkNodesByWorkflowId(workflow.id) as Array<{
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

  // Artifact state
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null
  );

  // Working directory state - prioritize task.worktree_path (project directory)
  // Fallback to sessionFolder for backward compatibility
  const workingDir = useMemo(() => {
    // Use task's workspace path if available (actual project directory)
    if (task?.workspace_path) {
      return task.workspace_path;
    }

    if (task?.worktree_path) {
      return task.worktree_path;
    }

    // Fallback to sessionFolder from useAgent
    if (sessionFolder) {
      return sessionFolder;
    }

    // Try to extract session directory from artifact paths
    for (const artifact of artifacts) {
      if (artifact.path && artifact.path.includes('/sessions/')) {
        const sessionMatch = artifact.path.match(/^(.+\/sessions\/[^/]+)/);
        if (sessionMatch) {
          return sessionMatch[1];
        }
      }
    }

    return '';
  }, [artifacts, sessionFolder, task?.workspace_path, task?.worktree_path]);

  // Live preview state
  const {
    previewUrl: livePreviewUrl,
    status: livePreviewStatus,
    error: livePreviewError,
    startPreview,
    stopPreview,
  } = useVitePreview(taskId || null);

  // Handle starting live preview
  const handleStartLivePreview = useCallback(() => {
    if (workingDir) {
      console.log(
        '[TaskDetail] Starting live preview with workingDir:',
        workingDir
      );
      startPreview(workingDir);
    } else {
      console.warn('[TaskDetail] Cannot start live preview: no workingDir');
    }
  }, [workingDir, startPreview]);

  // Handle stopping live preview
  const handleStopLivePreview = useCallback(() => {
    console.log('[TaskDetail] Stopping live preview');
    stopPreview();
  }, [stopPreview]);

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
      if (updatedTask) {
        setTask(updatedTask);
      }
      setIsEditOpen(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }, [
    editCliToolId,
    editPipelineTemplateId,
    editPrompt,
    taskId,
  ]);

  const handleDeleteTask = useCallback(async () => {
    if (!taskId) return;
    try {
      await db.deleteTask(taskId);
      setIsDeleteOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [taskId, navigate]);

  // Handle artifact selection - opens preview
  const handleSelectArtifact = useCallback((artifact: Artifact | null) => {
    setSelectedArtifact(artifact);
    if (artifact) {
      setIsPreviewVisible(true);
    }
  }, []);

  // Handle closing preview
  const handleClosePreview = useCallback(() => {
    setSelectedArtifact(null);
  }, []);

  // Selected tool operation index for syncing with virtual computer
  const [selectedToolIndex, setSelectedToolIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    initialAttachmentsRef.current = initialAttachments;
  }, [initialAttachments]);

  // Calculate total tool count for auto-selection
  const toolCount = useMemo(() => {
    return messages.filter((m) => m.type === 'tool_use').length;
  }, [messages]);

  // Auto-select the latest tool when running
  useEffect(() => {
    if (isRunning && toolCount > 0) {
      setSelectedToolIndex(toolCount - 1);
    }
  }, [toolCount, isRunning]);

  // Tool selection context value
  const toolSelectionValue = useMemo(
    () => ({
      selectedToolIndex,
      setSelectedToolIndex,
      showComputer: () => {}, // No-op since we removed the separate computer panel
    }),
    [selectedToolIndex]
  );

  // Extract artifacts from messages AND load from database
  useEffect(() => {
    const loadArtifacts = async () => {
      const extractedArtifacts: Artifact[] = [];
      const seenPaths = new Set<string>();

      // 1. Extract from Write tool messages (in-memory content)
      messages.forEach((msg) => {
        if (msg.type === 'tool_use' && msg.name === 'Write') {
          const input = msg.input as Record<string, unknown> | undefined;
          const filePath = input?.file_path as string | undefined;
          const content = input?.content as string | undefined;

          if (filePath && !seenPaths.has(filePath)) {
            seenPaths.add(filePath);
            const filename = filePath.split('/').pop() || filePath;
            const ext = filename.split('.').pop()?.toLowerCase();

            extractedArtifacts.push({
              id: filePath,
              name: filename,
              type: getArtifactTypeFromExt(ext),
              content,
              path: filePath,
            });
          }
        }

        // Extract WebSearch results as artifacts
        if (msg.type === 'tool_use' && msg.name === 'WebSearch') {
          const input = msg.input as Record<string, unknown> | undefined;
          const query = input?.query as string | undefined;
          const toolUseId = msg.id;
          if (query) {
            // Find the corresponding tool_result by toolUseId or by position
            let output = '';
            if (toolUseId) {
              const resultMsg = messages.find(
                (m) => m.type === 'tool_result' && m.toolUseId === toolUseId
              );
              output = resultMsg?.output || '';
            }
            // Fallback: find the next tool_result after this tool_use
            if (!output) {
              const msgIndex = messages.indexOf(msg);
              for (let i = msgIndex + 1; i < messages.length; i++) {
                if (messages[i].type === 'tool_result') {
                  output = messages[i].output || '';
                  break;
                }
                if (messages[i].type === 'tool_use') break; // Stop at next tool_use
              }
            }

            const artifactId = `websearch-${query}`;
            // Only add websearch artifact if it has valid search results
            if (
              !seenPaths.has(artifactId) &&
              output &&
              hasValidSearchResults(output)
            ) {
              seenPaths.add(artifactId);
              extractedArtifacts.push({
                id: artifactId,
                name: `Search: ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}`,
                type: 'websearch',
                content: output,
              });
            }
          }
        }
      });

      // 1.5. Extract files mentioned in tool_result messages and text messages
      const filePatterns = [
        // Match paths in backticks
        /`([^`]+\.(?:pptx|xlsx|docx|pdf))`/gi,
        // Match absolute paths
        /(\/[^\s"'`\n]+\.(?:pptx|xlsx|docx|pdf))/gi,
        // Match Chinese/unicode paths
        /(\/[^\s"'\n]*[\u4e00-\u9fff][^\s"'\n]*\.(?:pptx|xlsx|docx|pdf))/gi,
      ];

      messages.forEach((msg) => {
        // Check tool_result outputs and text message content
        const textToSearch =
          msg.type === 'tool_result'
            ? msg.output
            : msg.type === 'text'
              ? msg.content
              : null;

        if (textToSearch) {
          for (const pattern of filePatterns) {
            const matches = textToSearch.matchAll(pattern);
            for (const match of matches) {
              const filePath = match[1] || match[0];
              if (filePath && !seenPaths.has(filePath)) {
                seenPaths.add(filePath);
                const filename = filePath.split('/').pop() || filePath;
                const ext = filename.split('.').pop()?.toLowerCase();

                extractedArtifacts.push({
                  id: filePath,
                  name: filename,
                  type: getArtifactTypeFromExt(ext),
                  path: filePath,
                });
              }
            }
          }
        }
      });

      setArtifacts(extractedArtifacts);
    };

    loadArtifacts();
  }, [messages, taskId]);

  // Auto scroll to bottom when new output arrives unless user scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Check scroll position to show/hide scroll button and detect manual scroll
  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Detect if user scrolled up (scroll position decreased)
    if (scrollTop < lastScrollTopRef.current && distanceFromBottom > 100) {
      userScrolledUpRef.current = true;
    }

    // If user scrolled to near bottom, re-enable auto-scroll
    if (distanceFromBottom < 50) {
      userScrolledUpRef.current = false;
    }

    lastScrollTopRef.current = scrollTop;

  }, []);

  // Add scroll listener to messages container
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollPosition);
    // Initial check
    checkScrollPosition();

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
    };
  }, [checkScrollPosition]);

  // Re-check scroll position when messages load or loading state changes
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        checkScrollPosition();
      });
    }
  }, [isLoading, messages.length, checkScrollPosition]);

  // Reset UI state when taskId changes (but don't touch agent/task state - let loadTask handle that)
  useEffect(() => {
    if (prevTaskIdRef.current !== taskId) {
      if (prevTaskIdRef.current !== undefined) {
        // Only reset UI state here - loadTask will handle task switching
        setTask(null);
        setHasStarted(false);
        setHasStartedOnce(false);
        isInitializingRef.current = false; // Reset for new task
        setCliStatus('idle');
        userScrolledUpRef.current = false;
        lastScrollTopRef.current = 0;

        // Reset preview and artifact state
        setIsPreviewVisible(false);
        setSelectedArtifact(null);
        setArtifacts([]);
        setSelectedToolIndex(null);
        setCurrentWorkNode(null);
        setWorkflowNodes([]);
        setWorkflowCurrentNode(null);
        lastAutoRunWorkNodeIdRef.current = null;

        // Stop live preview if running
        stopPreview();
      }
      prevTaskIdRef.current = taskId;
    }
  }, [taskId, stopPreview]);

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
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [taskId]);

  // Load existing task or start new one
  useEffect(() => {
    async function initialize() {
      if (!taskId) {
        setIsLoading(false);
        return;
      }

      if (initializedTaskIdRef.current === taskId) {
        return;
      }

      // Prevent double initialization in React Strict Mode
      if (isInitializingRef.current) {
        return;
      }
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

          const sessionId = initialSessionId || newUuid();

          try {
            const settings = getSettings();
            const createdTask = await db.createTask({
              id: taskId,
              session_id: sessionId,
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

    initialize();
  }, [
    taskId,
    loadMessages,
    loadTask,
    initialPrompt,
    initialSessionId,
    hasStarted,
    setMessages,
  ]);

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

    loadTemplate();
    return () => {
      active = false;
    };
  }, [task?.pipeline_template_id]);

  const loadWorkflowStatus = useCallback(async () => {
    if (!taskId) return;
    try {
      const workflow = await db.getWorkflowByTaskId(taskId) as {
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

      const nodes = await db.getWorkNodesByWorkflowId(workflow.id) as Array<{
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
          n => n.id === (currentNode.work_node_template_id || currentNode.template_node_id)
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
  }, [pipelineTemplate, taskId, t.task.stageLabel, useCliSession]);

  // Load workflow instance and current work node status
  useEffect(() => {
    if (!taskId) return;

    let active = true;
    const run = async () => {
      if (!active) return;
      await loadWorkflowStatus();
    };

    void run();
    // Poll for updates every 2 seconds when task is running
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

  useEffect(() => {
    if (!isEditOpen) return;
    let active = true;

    const loadTemplates = async () => {
      if (!task?.project_id) {
        setPipelineTemplates([]);
        return;
      }
      try {
        const templates = await db.getWorkflowTemplatesByProject(task.project_id);
        if (active) {
          setPipelineTemplates(templates as PipelineTemplate[]);
        }
      } catch (error) {
        console.error('Failed to load pipeline templates:', error);
        if (active) {
          setPipelineTemplates([]);
        }
      }
    };

    loadTemplates();
    return () => {
      active = false;
    };
  }, [isEditOpen, task?.project_id]);

  useEffect(() => {
    let active = true;
    const loadCliTools = async () => {
      try {
        const result =
          (await window.api?.cliTools?.getAll?.()) ||
          (await window.api?.cliTools?.detectAll?.());
        const tools = Array.isArray(result)
          ? (result as CLIToolInfo[])
          : [];
        if (active) {
          setCliTools(tools);
        }
      } catch (error) {
        console.error('Failed to load CLI tools:', error);
        if (active) {
          setCliTools([]);
        }
      }
    };

    loadCliTools();
    return () => {
      active = false;
    };
  }, []);

  const resolveCurrentExecutionId = useCallback(async () => {
    if (!taskId) return null;
    try {
      const workflow = await db.getWorkflowByTaskId(taskId) as {
        id: string;
        current_node_index: number;
      } | null;
      if (!workflow) return null;

      const nodes = await db.getWorkNodesByWorkflowId(workflow.id) as Array<{
        id: string;
      }>;
      const currentNode = nodes[workflow.current_node_index];
      if (!currentNode) return null;

      const latestExecution = await db.getLatestAgentExecution(currentNode.id) as {
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

  const handleCliStatusChange = useCallback((status: 'idle' | 'running' | 'stopped' | 'error') => {
    setCliStatus(status);
    if (!taskId) return;
    if (status === 'running') {
      void markExecutionRunning();
    } else if (status === 'stopped') {
      void markExecutionCompleted();
      void loadWorkflowStatus();
      void (async () => {
        try {
          const workflow = await db.getWorkflowByTaskId(taskId);
          if (!workflow) {
            const updatedTask = await db.updateTask(taskId, { status: 'in_review' });
            if (updatedTask) {
              setTask(updatedTask);
            }
          }
        } catch (error) {
          console.error('[TaskDetail] Failed to sync task status on CLI completion:', error);
        }
      })();
    }
  }, [loadWorkflowStatus, markExecutionCompleted, markExecutionRunning, taskId]);

  const runCliPrompt = useCallback(async (prompt?: string) => {
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
  }, [cliStatus, task?.session_id]);

  const appendCliLog = useCallback((content: string, type: 'user_message' | 'system_message') => {
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
    window.api.cliSession.appendLog(
      sessionId,
      {
        type: 'normalized',
        entry,
        timestamp,
        task_id: taskId ?? sessionId,
        session_id: sessionId,
      },
      task?.project_id ?? null
    ).catch((error: unknown) => {
      console.error('[TaskDetail] Failed to append CLI log:', error);
    });
  }, [task?.project_id, task?.session_id, taskId]);

  const appendCliUserLog = useCallback((content: string) => {
    appendCliLog(content, 'user_message');
  }, [appendCliLog]);

  const appendCliSystemLog = useCallback((content: string) => {
    appendCliLog(content, 'system_message');
  }, [appendCliLog]);

  useEffect(() => {
    if (!useCliSession) return;
    if (!workflowCurrentNode) return;
    if (workflowCurrentNode.status !== 'in_progress') return;
    if (cliStatus === 'running') return;
    if (lastAutoRunWorkNodeIdRef.current === workflowCurrentNode.id) return;
    let active = true;
    const run = async () => {
      const sessionId = task?.session_id;
      if (sessionId && window.api?.cliSession?.getSession) {
        try {
          const existingSession = await window.api.cliSession.getSession(sessionId);
          if (!active) return;
          if (existingSession) {
            if (existingSession.status && existingSession.status !== cliStatus) {
              setCliStatus(existingSession.status);
            }
            if (existingSession.status === 'running') {
              return;
            }
          }
        } catch (error) {
          console.error('[TaskDetail] Failed to check existing CLI session:', error);
        }
      }

      try {
        const latestExecution = await db.getLatestAgentExecution(workflowCurrentNode.id) as {
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
    buildCliPrompt,
    cliStatus,
    appendCliUserLog,
    pipelineTemplate,
    resolveWorkNodePrompt,
    runCliPrompt,
    task?.session_id,
    useCliSession,
    workflowCurrentNode,
  ]);

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

      // 如果使用 CLI 工具，使用 CLI session
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

      const sessionInfo = task?.session_id
        ? { sessionId: task.session_id }
        : undefined;

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
      appendPipelineNotice,
      continueConversation,
      buildCliPrompt,
      messages.length,
      pipelineTemplate,
      resolveWorkNodePrompt,
      runAgent,
      task?.session_id,
      taskId,
      t.task.pipelineApprovalNotePrefix,
      t.task.pipelineCompleted,
      runCliPrompt,
      workingDir,
      useCliSession,
      appendCliUserLog,
    ]
  );

  const startNextPipelineStage = useCallback(
    async (approvalNote?: string) => {
      await startPipelineStage(pipelineStageIndex + 1, approvalNote);
    },
    [pipelineStageIndex, startPipelineStage]
  );

  useEffect(() => {
    if (!pipelineTemplate || pipelineStatus !== 'idle' || isRunning) return;
    if (useCliSession && cliStatus === 'running') return;
    if (!taskId || messages.length > 0) return;
    if (normalizedTaskStatus !== 'in_progress') return;

    let active = true;
    const maybeStart = async () => {
      try {
        const workflow = await db.getWorkflowByTaskId(taskId) as {
          id: string;
          current_node_index: number;
        } | null;

        if (workflow) {
          const nodes = await db.getWorkNodesByWorkflowId(workflow.id) as Array<{
            id: string;
          }>;
          const currentNode = nodes[workflow.current_node_index];
          if (!currentNode) return;

          const latestExecution = await db.getLatestAgentExecution(currentNode.id) as {
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
    let outcome: typeof stageMessages[number] | undefined;
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
      // Keep in_progress status on failure - user can retry
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

  // Handle reply submission from ChatInput
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
            const session = cliSessionRef.current;
            if (!session) {
              throw new Error('CLI session not initialized');
            }
            if (cliStatus === 'running') {
              await session.sendInput(content);
            } else if (content) {
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
      isRunning,
      taskId,
      useCliSession,
      setMessages,
      loadMessages,
      continueConversation,
      appendCliSystemLog,
      appendCliUserLog,
      cliStatus,
      runCliPrompt,
      pipelineTemplate,
      pipelineStatus,
      startNextPipelineStage,
      task?.status,
      t.common.errors.serverNotRunning,
      workingDir,
    ]
  );

  const handleStartTask = useCallback(async () => {
    if (!taskId) return;

    setHasStartedOnce(true);
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

    const sessionInfo = task?.session_id
      ? { sessionId: task.session_id }
      : undefined;

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
    initialPrompt,
    isRunning,
    runCliPrompt,
    pipelineStatus,
    pipelineTemplate,
    runAgent,
    startPipelineStage,
    task?.prompt,
    task?.pipeline_template_id,
    task?.session_id,
    taskId,
    t.common.errors.serverNotRunning,
    useCliSession,
    workingDir,
    appendCliUserLog,
    appendCliSystemLog,
    buildCliPrompt,
    resolveWorkNodePrompt,
    task?.workflow_template_id,
    workflowCurrentNode,
  ]);

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
  }, [currentWorkNode, loadWorkflowStatus, taskId]);

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
  }, [taskId]);

  const handleStopExecution = useCallback(async () => {
    if (useCliSession) {
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
      return;
    }
    await stopAgent();
  }, [stopAgent, task?.session_id, useCliSession]);

  const replyIsRunning = useMemo(() => {
    if (useCliSession) {
      return cliStatus === 'running';
    }
    return isRunning;
  }, [cliStatus, isRunning, useCliSession]);

  const displayTitle = task?.title || task?.prompt || initialPrompt;
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
    pipelineTemplate,
    pipelineStageIndex,
    pipelineStatus,
    t.task.pipelineCompleted,
    t.task.pipelineStageCompleted,
    t.task.pipelineStageFailed,
    t.task.stageLabel,
  ]);
  const cliToolName = useMemo(() => {
    if (!task?.cli_tool_id) return null;
    const match = cliTools.find((tool) => tool.id === task.cli_tool_id);
    return (
      match?.displayName ||
      match?.name ||
      task.cli_tool_id
    );
  }, [cliTools, task?.cli_tool_id]);
  const cliToolLabel = cliToolName || t.task.detailCli || 'CLI';
  const cliSessionId = task?.session_id || '';
  const cliToolId = task?.cli_tool_id || '';
  const taskPrompt = task?.prompt || initialPrompt;

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
  const handleAction = isCliTaskReviewPending ? handleApproveCliTask : handleStartTask;

  const displayStatus = useMemo<PipelineDisplayStatus | null>(() => {
    if (!task?.status) return null;
    return normalizedTaskStatus;
  }, [normalizedTaskStatus, task?.status]);

  const statusInfo = displayStatus ? statusConfig[displayStatus] : null;
  const StatusIcon = statusInfo?.icon || Clock;
  const executionStatus = useMemo<'idle' | 'running' | 'stopped' | 'error'>(() => {
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
    const map = new Map<string, WorkNodeTemplate>();
    pipelineTemplate?.nodes?.forEach((node) => {
      map.set(node.id, node);
    });
    return map;
  }, [pipelineTemplate?.nodes]);
  const workflowNodesForDisplay = useMemo<WorkflowDisplayNode[]>(() => {
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

  return (
    <ToolSelectionContext.Provider value={toolSelectionValue}>
      <div className="bg-sidebar flex h-screen overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar />

        {/* Main Content Area with Responsive Layout */}
        <div
          ref={containerRef}
          className="bg-background my-2 mr-2 flex min-w-0 flex-1 overflow-hidden rounded-2xl shadow-sm"
        >
          {/* Left Panel - Agent Chat (flex-1 to fill available space) */}
          <div
            className={cn(
              'bg-background flex min-w-0 flex-col overflow-hidden transition-all duration-200',
              !isPreviewVisible && 'rounded-2xl',
              isPreviewVisible && 'rounded-l-2xl'
            )}
            style={{
              flex: isPreviewVisible ? '0 0 auto' : '1 1 0%',
              width: isPreviewVisible ? 'clamp(320px, 40%, 500px)' : undefined,
              minWidth: '320px',
              maxWidth: isPreviewVisible ? '500px' : undefined,
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              {/* Task Card */}
              <TaskCard
                t={t}
                title={displayTitle || `Task ${taskId}`}
                metaRows={visibleMetaRows}
                showActionButton={showActionButton}
                actionDisabled={actionDisabled}
                actionLabel={actionLabel}
                onAction={handleAction}
                onToggleSidebar={toggleLeft}
                onEdit={handleOpenEdit}
                onDelete={() => setIsDeleteOpen(true)}
                canEdit={task?.status === 'todo'}
              />

              {/* Workflow Card */}
              {showWorkflowCard && (
                <WorkflowCard
                  t={t}
                  nodes={workflowNodesForDisplay}
                  templateNodeMap={workflowTemplateNodeMap}
                  currentWorkNode={currentWorkNode}
                  onApproveCurrent={handleApproveWorkNode}
                />
              )}

              {/* Agent CLI Execution Card */}
              <ExecutionPanel
                t={t}
                isLoading={isLoading}
                pipelineBanner={pipelineBanner}
                useCliSession={useCliSession}
                cliStatus={cliStatus}
                cliStatusInfo={cliStatusInfo}
                cliToolLabel={cliToolLabel}
                messages={messages}
                phase={phase}
                onApprovePlan={approvePlan}
                onRejectPlan={rejectPlan}
                isRunning={isRunning}
                sessionId={cliSessionId}
                toolId={cliToolId}
                workingDir={workingDir}
                prompt={taskPrompt}
                cliSessionRef={cliSessionRef}
                onCliStatusChange={handleCliStatusChange}
                messagesContainerRef={messagesContainerRef}
                messagesEndRef={messagesEndRef}
              />

              {/* Reply Card */}
              <ReplyCard
                t={t}
                isRunning={replyIsRunning}
                onStop={handleStopExecution}
                onSubmit={handleReply}
              />
            </div>
          </div>

          {/* Divider between chat and preview */}
          {isPreviewVisible && <div className="bg-border/50 w-px shrink-0" />}

          {/* Right Panel - Multi-function area */}
          <RightPanelSection
            isVisible={isPreviewVisible}
            workingDir={workingDir}
            branchName={task?.branch_name || null}
            baseBranch={task?.base_branch || null}
            selectedArtifact={selectedArtifact}
            artifacts={artifacts}
            onSelectArtifact={handleSelectArtifact}
            livePreviewUrl={livePreviewUrl}
            livePreviewStatus={livePreviewStatus}
            livePreviewError={livePreviewError}
            onStartLivePreview={workingDir ? handleStartLivePreview : undefined}
            onStopLivePreview={handleStopLivePreview}
            onClosePreview={handleClosePreview}
          />
        </div>
      </div>

      <TaskDialogs
        t={t}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editPrompt={editPrompt}
        setEditPrompt={setEditPrompt}
        editCliToolId={editCliToolId}
        setEditCliToolId={setEditCliToolId}
        editPipelineTemplateId={editPipelineTemplateId}
        setEditPipelineTemplateId={setEditPipelineTemplateId}
        cliTools={cliTools}
        pipelineTemplates={pipelineTemplates}
        onSaveEdit={handleSaveEdit}
        isDeleteOpen={isDeleteOpen}
        setIsDeleteOpen={setIsDeleteOpen}
        onDelete={handleDeleteTask}
      />
    </ToolSelectionContext.Provider>
  );
}

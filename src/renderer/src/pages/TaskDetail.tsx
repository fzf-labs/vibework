import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db, type Task } from '@/data';
import {
  useAgent,
  type MessageAttachment,
} from '@/hooks/useAgent';
import { useVitePreview } from '@/hooks/useVitePreview';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  Clock,
  PanelLeft,
  Play,
  Square,
  XCircle,
} from 'lucide-react';

import {
  ArtifactPreview,
  hasValidSearchResults,
  type Artifact,
} from '@/components/artifacts';
import { LeftSidebar, SidebarProvider, useSidebar } from '@/components/layout';
import { ChatInput } from '@/components/shared/ChatInput';
import {
  ToolSelectionContext,
  useToolSelection,
  getArtifactTypeFromExt,
  RightPanel,
  MessageList,
  RunningIndicator,
} from '@/components/task';

// Re-export useToolSelection for external use
export { useToolSelection };

interface LocationState {
  prompt?: string;
  sessionId?: string;
  taskIndex?: number;
  attachments?: MessageAttachment[];
}

interface PipelineTemplateStage {
  id: string;
  name: string;
  prompt: string;
  stage_order: number;
  requires_approval: boolean;
  continue_on_error: boolean;
}

interface PipelineTemplate {
  id: string;
  name: string;
  stages: PipelineTemplateStage[];
}

interface CLIToolInfo {
  id: string;
  name?: string;
  displayName?: string;
}

const statusConfig: Record<
  Task['status'],
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
  running: {
    icon: Play,
    label: 'Running',
    color: 'text-blue-500 bg-blue-500/10',
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    color: 'text-green-500 bg-green-500/10',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    color: 'text-red-500 bg-red-500/10',
  },
  stopped: {
    icon: Square,
    label: 'Stopped',
    color: 'text-zinc-500 bg-zinc-500/10',
  },
};

export function TaskDetailPage() {
  return (
    <SidebarProvider>
      <TaskDetailContent />
    </SidebarProvider>
  );
}

function TaskDetailContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { taskId } = useParams();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const initialPrompt = state?.prompt || '';
  const initialSessionId = state?.sessionId;
  const initialTaskIndex = state?.taskIndex || 1;
  const initialAttachments = state?.attachments;

  const {
    messages,
    isRunning,
    runAgent,
    continueConversation,
    stopAgent,
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
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pipelineTemplate, setPipelineTemplate] =
    useState<PipelineTemplate | null>(null);
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([]);
  const [isMetaCollapsed, setIsMetaCollapsed] = useState(false);
  const [pipelineStageIndex, setPipelineStageIndex] = useState(0);
  const [pipelineStatus, setPipelineStatus] = useState<
    'idle' | 'running' | 'waiting_approval' | 'failed' | 'completed'
  >('idle');
  const [pipelineStageMessageStart, setPipelineStageMessageStart] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevTaskIdRef = useRef<string | undefined>(undefined);

  // Panel visibility state - default to visible for new layout
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  // Track if user has manually scrolled up (to disable auto-scroll)
  const userScrolledUpRef = useRef(false);
  // Track last scroll position to detect scroll direction
  const lastScrollTopRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [task?.worktree_path, sessionFolder, artifacts]);

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

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    const currentTitle = task?.title || task?.prompt || initialPrompt;
    setEditedTitle(currentTitle);
    setIsEditingTitle(true);
  }, [task?.title, task?.prompt, initialPrompt]);

  // Handle title save
  const handleTitleSave = useCallback(async () => {
    if (!taskId || !editedTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle !== (task?.title || task?.prompt || initialPrompt)) {
      try {
        const updatedTask = await db.updateTask(taskId, { title: trimmedTitle });
        if (updatedTask) {
          setTask(updatedTask);
        }
      } catch (error) {
        console.error('Failed to update task title:', error);
      }
    }
    setIsEditingTitle(false);
  }, [taskId, editedTitle, task?.title, task?.prompt, initialPrompt]);

  // Handle title input key down
  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleTitleSave();
      } else if (e.key === 'Escape') {
        setIsEditingTitle(false);
      }
    },
    [handleTitleSave]
  );

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Handle artifact selection - opens preview
  const handleSelectArtifact = useCallback((artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setIsPreviewVisible(true);
  }, []);

  // Handle closing preview
  const handleClosePreview = useCallback(() => {
    setIsPreviewVisible(false);
    setSelectedArtifact(null);
  }, []);

  // Selected tool operation index for syncing with virtual computer
  const [selectedToolIndex, setSelectedToolIndex] = useState<number | null>(
    null
  );

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
      // Auto-select first artifact if none selected
      if (extractedArtifacts.length > 0 && !selectedArtifact) {
        setSelectedArtifact(extractedArtifacts[0]);
      }
    };

    loadArtifacts();
  }, [messages, taskId]);

  // Auto scroll to bottom only when task is running AND user hasn't scrolled up
  useEffect(() => {
    if (isRunning && !userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isRunning]);

  // Reset userScrolledUp when task stops running
  useEffect(() => {
    if (!isRunning) {
      userScrolledUpRef.current = false;
    }
  }, [isRunning]);

  // Check scroll position to show/hide scroll button and detect manual scroll
  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Detect if user scrolled up (scroll position decreased)
    if (
      isRunning &&
      scrollTop < lastScrollTopRef.current &&
      distanceFromBottom > 100
    ) {
      userScrolledUpRef.current = true;
    }

    // If user scrolled to near bottom, re-enable auto-scroll
    if (distanceFromBottom < 50) {
      userScrolledUpRef.current = false;
    }

    lastScrollTopRef.current = scrollTop;

  }, [isRunning]);

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
        isInitializingRef.current = false; // Reset for new task

        // Reset preview and artifact state
        setIsPreviewVisible(false);
        setSelectedArtifact(null);
        setArtifacts([]);
        setSelectedToolIndex(null);
        setIsMetaCollapsed(false);

        // Stop live preview if running
        stopPreview();
      }
      prevTaskIdRef.current = taskId;
    }
  }, [taskId, stopPreview]);

  // Load existing task or start new one
  useEffect(() => {
    async function initialize() {
      if (!taskId) {
        setIsLoading(false);
        return;
      }

      // Prevent double initialization in React Strict Mode
      if (isInitializingRef.current) {
        return;
      }
      isInitializingRef.current = true;

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

        // Pass session info if available
        const sessionInfo = initialSessionId
          ? { sessionId: initialSessionId, taskIndex: initialTaskIndex }
          : undefined;
        await runAgent(
          initialPrompt,
          taskId,
          sessionInfo,
          initialAttachments,
          workingDir || undefined
        );
        const newTask = await loadTask(taskId);
        setTask(newTask);
      } else {
        setIsLoading(false);
      }

      isInitializingRef.current = false;
    }

    initialize();
  }, [taskId]);

  useEffect(() => {
    if (!task?.pipeline_template_id) {
      setPipelineTemplate(null);
      setPipelineStatus('idle');
      return;
    }

    let active = true;
    const loadTemplate = async () => {
      try {
        const template = (await db.getPipelineTemplate(
          task.pipeline_template_id
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

  const appendPipelineNotice = useCallback(
    async (content: string) => {
      if (!taskId) return;
      setMessages((prev) => [...prev, { type: 'text', content }]);
      try {
        await db.createMessage({
          task_id: taskId,
          type: 'text',
          content,
        });
      } catch (error) {
        console.error('Failed to save pipeline notice:', error);
      }
    },
    [taskId]
  );

  const startPipelineStage = useCallback(
    async (index: number, approvalNote?: string) => {
      if (!pipelineTemplate || !taskId) return;
      const stage = pipelineTemplate.stages[index];
      if (!stage) {
        setPipelineStatus('completed');
        try {
          await db.updateTask(taskId, { status: 'completed' });
        } catch (error) {
          console.error('Failed to update task status:', error);
        }
        await appendPipelineNotice(t.task.pipelineCompleted);
        return;
      }

      const prompt = approvalNote
        ? `${stage.prompt}\n\n${t.task.pipelineApprovalNotePrefix}: ${approvalNote}`
        : stage.prompt;

      setPipelineStageIndex(index);
      setPipelineStatus('running');
      setPipelineStageMessageStart(messages.length);
      try {
        await db.updateTask(taskId, { status: 'running' });
      } catch (error) {
        console.error('Failed to update task status:', error);
      }

      const sessionInfo =
        task?.session_id && task?.task_index
          ? { sessionId: task.session_id, taskIndex: task.task_index }
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
      messages.length,
      pipelineTemplate,
      runAgent,
      task?.session_id,
      task?.task_index,
      taskId,
      t.task.pipelineApprovalNotePrefix,
      t.task.pipelineCompleted,
      workingDir,
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
    if (!taskId || messages.length > 0) return;
    startPipelineStage(0).catch((error) => {
      console.error('Failed to start pipeline stage:', error);
    });
  }, [pipelineTemplate, pipelineStatus, isRunning, taskId, messages.length, startPipelineStage]);

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

    const stage = pipelineTemplate.stages[pipelineStageIndex];
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
      db.updateTask(taskId, { status: 'error' }).catch((error) => {
        console.error('Failed to update task status:', error);
      });
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
      if (
        (text.trim() ||
          (messageAttachments && messageAttachments.length > 0)) &&
        !isRunning &&
        taskId
      ) {
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
            try {
              await db.createMessage({
                task_id: taskId,
                type: 'user',
                content: approvalNote,
              });
            } catch (error) {
              console.error('Failed to save approval note:', error);
            }
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
      isRunning,
      taskId,
      continueConversation,
      pipelineTemplate,
      pipelineStatus,
      startNextPipelineStage,
      workingDir,
    ]
  );

  const displayTitle = task?.title || task?.prompt || initialPrompt;
  const pipelineBanner = useMemo(() => {
    if (!pipelineTemplate) return null;
    const stage = pipelineTemplate.stages[pipelineStageIndex];
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

  const pipelineName = useMemo(() => {
    if (pipelineTemplate?.name) return pipelineTemplate.name;
    if (task?.pipeline_template_id) return t.common.loading;
    return null;
  }, [pipelineTemplate?.name, task?.pipeline_template_id, t.common.loading]);

  const metaRows = useMemo(
    () => [
      {
        key: 'cli',
        label: t.task.detailCli || 'CLI',
        value: cliToolName ? (
          <span className="text-foreground text-xs font-medium">
            {cliToolName}
          </span>
        ) : null,
        primary: true,
        visible: Boolean(cliToolName),
      },
      {
        key: 'pipeline',
        label: t.task.detailPipeline || 'Pipeline',
        value: pipelineName ? (
          <span className="text-foreground text-xs font-medium">
            {pipelineName}
          </span>
        ) : null,
        primary: false,
        visible: Boolean(pipelineName),
      },
      {
        key: 'branch',
        label: t.task.detailBranch || 'Branch',
        value: task?.branch_name ? (
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
            {task.branch_name}
          </code>
        ) : null,
        primary: false,
        visible: Boolean(task?.branch_name),
      },
    ],
    [
      cliToolName,
      pipelineName,
      task?.branch_name,
      t.task.detailCli,
      t.task.detailPipeline,
      t.task.detailBranch,
    ]
  );

  const visibleMetaRows = metaRows.filter((row) => row.visible);
  const primaryMetaRows = visibleMetaRows.filter((row) => row.primary);
  const secondaryMetaRows = visibleMetaRows.filter((row) => !row.primary);
  const showMetaToggle =
    primaryMetaRows.length > 0 && secondaryMetaRows.length > 0;
  const metaRowsToShow =
    primaryMetaRows.length === 0
      ? visibleMetaRows
      : isMetaCollapsed
        ? primaryMetaRows
        : [...primaryMetaRows, ...secondaryMetaRows];
  const statusInfo = task ? statusConfig[task.status] : null;
  const StatusIcon = statusInfo?.icon || Clock;

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
            {/* Top Section - Task Details */}
            <div className="border-border/50 bg-background z-10 shrink-0 border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/board')}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex cursor-pointer items-center justify-center rounded-lg p-2 transition-colors duration-200"
                  title="返回看板"
                >
                  <ArrowLeft className="size-4" />
                </button>

                <button
                  onClick={toggleLeft}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex cursor-pointer items-center justify-center rounded-lg p-2 transition-colors duration-200 md:hidden"
                >
                  <PanelLeft className="size-4" />
                </button>

                <div className="min-w-0 flex-1">
                  {isEditingTitle ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={handleTitleKeyDown}
                      className="text-foreground border-primary/50 focus:border-primary focus:ring-primary/30 max-w-full rounded-md border bg-transparent px-2 py-1 text-sm font-normal outline-none focus:ring-1"
                      style={{
                        width: `${Math.min(
                          Math.max(editedTitle.length + 2, 20),
                          50
                        )}ch`,
                      }}
                    />
                  ) : (
                    <h1
                      onClick={handleTitleClick}
                      className="text-foreground hover:bg-accent/50 inline-block max-w-full cursor-pointer truncate rounded-md px-2 py-1 text-sm font-normal transition-colors"
                      title="Click to edit title"
                    >
                      {displayTitle.slice(0, 40) || `Task ${taskId}`}
                      {displayTitle.length > 40 && '...'}
                    </h1>
                  )}
                </div>

                {task && (
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                      statusInfo?.color
                    )}
                  >
                    <StatusIcon className="size-3" />
                    {statusInfo?.label || task.status}
                  </span>
                )}

                {isRunning && (
                  <span className="text-primary flex items-center gap-2 text-sm">
                    <span className="bg-primary size-2 animate-pulse rounded-full" />
                  </span>
                )}
              </div>

              {visibleMetaRows.length > 0 && (
                <div className="bg-muted/40 mt-2 space-y-1.5 rounded-lg px-2.5 py-2">
                  {metaRowsToShow.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-muted-foreground shrink-0">
                        {row.label}
                      </span>
                      <div className="min-w-0 flex-1 truncate text-right">
                        {row.value}
                      </div>
                    </div>
                  ))}

                  {showMetaToggle && (
                    <button
                      type="button"
                      onClick={() => setIsMetaCollapsed((prev) => !prev)}
                      className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 pt-1 text-xs transition-colors"
                    >
                      <ChevronDown
                        className={cn(
                          'size-3 transition-transform',
                          !isMetaCollapsed && 'rotate-180'
                        )}
                      />
                      {isMetaCollapsed
                        ? t.task.detailExpand || 'Expand'
                        : t.task.detailCollapse || 'Collapse'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Output / Conversation Area */}
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

                  {messages.length === 0 && !isRunning ? (
                    <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                      {t.task.waitingForTask}
                    </div>
                  ) : (
                    <>
                      <MessageList
                        messages={messages}
                        phase={phase}
                        onApprovePlan={approvePlan}
                        onRejectPlan={rejectPlan}
                      />
                      {isRunning && <RunningIndicator messages={messages} />}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t bg-background shrink-0 py-2">
              <ChatInput
                variant="reply"
                placeholder={t.home.reply}
                isRunning={isRunning}
                onSubmit={handleReply}
                onStop={stopAgent}
                className="rounded-none border-0 shadow-none"
              />
            </div>
          </div>

          {/* Divider between chat and preview */}
          {isPreviewVisible && <div className="bg-border/50 w-px shrink-0" />}

          {/* Right Panel - Multi-function area */}
          {isPreviewVisible && (
            <div className="bg-muted/10 flex min-w-0 flex-1 flex-col overflow-hidden">
              <RightPanel
                workingDir={workingDir}
                selectedArtifact={selectedArtifact}
                onSelectArtifact={handleSelectArtifact}
                livePreviewUrl={livePreviewUrl}
                livePreviewStatus={livePreviewStatus}
                livePreviewError={livePreviewError}
                onStartLivePreview={workingDir ? handleStartLivePreview : undefined}
                onStopLivePreview={handleStopLivePreview}
                renderFilePreview={() => (
                  <ArtifactPreview
                    artifact={selectedArtifact}
                    onClose={handleClosePreview}
                    allArtifacts={artifacts}
                    livePreviewUrl={livePreviewUrl}
                    livePreviewStatus={livePreviewStatus}
                    livePreviewError={livePreviewError}
                    onStartLivePreview={workingDir ? handleStartLivePreview : undefined}
                    onStopLivePreview={handleStopLivePreview}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>
    </ToolSelectionContext.Provider>
  );
}

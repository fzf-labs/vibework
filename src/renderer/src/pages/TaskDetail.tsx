import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { db, type LibraryFile, type Task } from '@/data';
import {
  useAgent,
  type MessageAttachment,
} from '@/hooks/useAgent';
import { useVitePreview } from '@/hooks/useVitePreview';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import { ArrowDown, PanelLeft } from 'lucide-react';

import {
  ArtifactPreview,
  hasValidSearchResults,
  type Artifact,
} from '@/components/artifacts';
import { LeftSidebar, SidebarProvider, useSidebar } from '@/components/layout';
import { ChatInput } from '@/components/shared/ChatInput';
import {
  QuestionInput,
  RightSidebar,
  ToolSelectionContext,
  useToolSelection,
  MessageList,
  RunningIndicator,
  UserMessage,
  convertFileType,
  getArtifactTypeFromExt,
} from '@/components/task';

// Re-export useToolSelection for external use
export { useToolSelection };

interface LocationState {
  prompt?: string;
  sessionId?: string;
  taskIndex?: number;
  attachments?: MessageAttachment[];
}

export function TaskDetailPage() {
  return (
    <SidebarProvider>
      <TaskDetailContent />
    </SidebarProvider>
  );
}

function TaskDetailContent() {
  const { t } = useLanguage();
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
    plan: _plan,
    approvePlan,
    rejectPlan,
    pendingQuestion,
    respondToQuestion,
    sessionFolder,
    filesVersion,
  } = useAgent();
  const { toggleLeft, setLeftOpen } = useSidebar();
  const [hasStarted, setHasStarted] = useState(false);
  const isInitializingRef = useRef(false);
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevTaskIdRef = useRef<string | undefined>(undefined);

  // Panel visibility state - default to collapsed, auto-expand when content is available
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  // Scroll to bottom button state
  const [showScrollButton, setShowScrollButton] = useState(false);
  // Track if user has manually scrolled up (to disable auto-scroll)
  const userScrolledUpRef = useRef(false);
  // Track last scroll position to detect scroll direction
  const lastScrollTopRef = useRef(0);

  // Auto-collapse left sidebar only when preview panel opens
  useEffect(() => {
    if (isPreviewVisible) {
      setLeftOpen(false);
    }
  }, [isPreviewVisible, setLeftOpen]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Artifact state
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null
  );

  // Working directory state - use sessionFolder (show full session directory tree)
  // Only depend on sessionFolder and artifacts, not messages (to avoid frequent recalculations)
  const workingDir = useMemo(() => {
    // Use sessionFolder from useAgent if available
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
  }, [sessionFolder, artifacts]);

  // Track if sidebar has been auto-expanded (to avoid re-opening after manual close)
  const hasAutoExpandedRef = useRef(false);

  // Reset right sidebar state when switching tasks
  useEffect(() => {
    if (taskId !== prevTaskIdRef.current) {
      // Reset auto-expand flag for new task
      hasAutoExpandedRef.current = false;
      // Close right sidebar when switching to a new task
      setIsRightSidebarVisible(false);
      // Set loading to true immediately to prevent auto-expand effect
      // from using stale data from the previous task
      setIsLoading(true);
    }
  }, [taskId]);

  // Auto-expand right sidebar when there is actual content (only once)
  // Content includes: artifacts, working files, MCP tools, or skills
  useEffect(() => {
    // Skip if still loading - wait for task data to be ready
    if (isLoading) return;

    // Skip if task data not loaded yet or task doesn't match current taskId
    // This prevents using stale data from the previous task during task switching
    if (!task || task.id !== taskId) return;

    // Skip if already auto-expanded
    if (hasAutoExpandedRef.current) return;

    // Check if there's actual content to display
    const hasArtifacts = artifacts.length > 0;
    const hasWorkspace = !!workingDir;
    const hasFileOps = messages.some(
      (m) =>
        m.type === 'tool_use' &&
        ['Read', 'Write', 'Edit', 'Bash', 'Glob'].includes(m.name || '')
    );
    const hasMcpTools = messages.some(
      (m) => m.type === 'tool_use' && m.name?.startsWith('mcp__')
    );
    const hasSkills = messages.some(
      (m) => m.type === 'tool_use' && m.name === 'Skill'
    );

    const hasContent =
      hasArtifacts || (hasWorkspace && hasFileOps) || hasMcpTools || hasSkills;

    // Auto-expand when content becomes available (only once)
    if (hasContent) {
      setIsRightSidebarVisible(true);
      hasAutoExpandedRef.current = true;
    }
    // If no content, ensure sidebar stays collapsed (don't auto-expand)
    // The sidebar starts collapsed by default and should stay that way for empty sessions
  }, [artifacts.length, messages, workingDir, isLoading, task, taskId]);

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

  // Tool search
  const [toolSearchQuery] = useState('');

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    const currentTitle = task?.prompt || initialPrompt;
    setEditedTitle(currentTitle);
    setIsEditingTitle(true);
  }, [task?.prompt, initialPrompt]);

  // Handle title save
  const handleTitleSave = useCallback(async () => {
    if (!taskId || !editedTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle !== (task?.prompt || initialPrompt)) {
      try {
        const updatedTask = await db.updateTask(taskId, { prompt: trimmedTitle });
        if (updatedTask) {
          setTask(updatedTask);
        }
      } catch (error) {
        console.error('Failed to update task title:', error);
      }
    }
    setIsEditingTitle(false);
  }, [taskId, editedTitle, task?.prompt, initialPrompt]);

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

      // 2. Load files from database (includes files from Skill tool, etc.)
      if (taskId) {
        try {
          const dbFiles = await db.getFilesByTaskId(taskId);
          dbFiles.forEach((file: LibraryFile) => {
            // Skip websearch - we extract these from messages with full output content
            // Check both type and path pattern (search:// is used for WebSearch results)
            if (file.type === 'websearch' || file.path?.startsWith('search://'))
              return;
            // Skip if we already have this file from Write tool
            if (file.path && !seenPaths.has(file.path)) {
              seenPaths.add(file.path);
              extractedArtifacts.push({
                id: file.path || `file-${file.id}`,
                name: file.name,
                type: convertFileType(file.type),
                content: file.preview || undefined,
                path: file.path,
              });
            }
          });
        } catch (error) {
          console.error('Failed to load files from database:', error);
        }
      }

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

    // Show button if more than 200px from bottom
    setShowScrollButton(distanceFromBottom > 200);
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

  // Scroll to bottom handler - also re-enables auto-scroll
  const scrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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

        // Reset right sidebar state
        setIsRightSidebarVisible(false);
        hasAutoExpandedRef.current = false;

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
        await runAgent(initialPrompt, taskId, sessionInfo, initialAttachments);
        const newTask = await loadTask(taskId);
        setTask(newTask);
      } else {
        setIsLoading(false);
      }

      isInitializingRef.current = false;
    }

    initialize();
  }, [taskId]);

  // Handle reply submission from ChatInput
  const handleReply = useCallback(
    async (text: string, messageAttachments?: MessageAttachment[]) => {
      if (
        (text.trim() ||
          (messageAttachments && messageAttachments.length > 0)) &&
        !isRunning &&
        taskId
      ) {
        await continueConversation(text.trim(), messageAttachments);
      }
    },
    [isRunning, taskId, continueConversation]
  );

  const displayPrompt = task?.prompt || initialPrompt;

  // Get attachments for the initial user message:
  // 1. From navigation state (first navigation from home page)
  // 2. Or from the first user message in messages (when reloading/re-entering)
  const displayAttachments = useMemo(() => {
    console.log('[TaskDetail] Computing displayAttachments:');
    console.log('  - initialAttachments:', initialAttachments?.length || 0);
    if (initialAttachments && initialAttachments.length > 0) {
      initialAttachments.forEach((a, i) => {
        console.log(
          `  - initialAttachment ${i}: type=${a.type}, hasData=${!!a.data}, dataLength=${a.data?.length || 0}`
        );
      });
      return initialAttachments;
    }
    // Find the first user message in messages array
    const firstUserMessage = messages.find((m) => m.type === 'user');
    console.log('  - firstUserMessage found:', !!firstUserMessage);
    if (firstUserMessage?.attachments) {
      console.log(
        '  - firstUserMessage.attachments:',
        firstUserMessage.attachments.length
      );
    }
    return firstUserMessage?.attachments;
  }, [initialAttachments, messages]);

  // Check if we should skip showing the first user message separately
  // (to avoid duplication when messages array already includes it)
  const firstMessageIsUserWithSameContent = useMemo(() => {
    const firstMessage = messages[0];
    return (
      firstMessage?.type === 'user' && firstMessage?.content === displayPrompt
    );
  }, [messages, displayPrompt]);

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
              !isPreviewVisible && !isRightSidebarVisible && 'rounded-2xl',
              !isPreviewVisible && isRightSidebarVisible && 'rounded-l-2xl',
              isPreviewVisible && 'rounded-l-2xl'
            )}
            style={{
              flex: isPreviewVisible ? '0 0 auto' : '1 1 0%',
              width: isPreviewVisible ? 'clamp(320px, 40%, 500px)' : undefined,
              minWidth: '320px',
              maxWidth: isPreviewVisible ? '500px' : undefined,
            }}
          >
            {/* Header - Full width */}
            <header className="border-border/50 bg-background z-10 flex shrink-0 items-center gap-2 border-none px-4 py-3">
              <button
                onClick={toggleLeft}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex cursor-pointer items-center justify-center rounded-lg p-2 transition-colors duration-200 md:hidden"
              >
                <PanelLeft className="size-5" />
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
                    {displayPrompt.slice(0, 40) || `Task ${taskId}`}
                    {displayPrompt.length > 40 && '...'}
                  </h1>
                )}
              </div>

              {isRunning && (
                <span className="text-primary flex items-center gap-2 text-sm">
                  <span className="bg-primary size-2 animate-pulse rounded-full" />
                </span>
              )}

              {/* Toggle right sidebar button */}
              <button
                onClick={() => setIsRightSidebarVisible(!isRightSidebarVisible)}
                className={cn(
                  'text-muted-foreground hover:bg-accent hover:text-foreground flex cursor-pointer items-center justify-center rounded-lg p-2 transition-colors',
                  isRightSidebarVisible && 'bg-accent/50'
                )}
                title={isRightSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
              >
                <PanelLeft className="size-4 rotate-180" />
              </button>
            </header>

            {/* Messages Area - Centered content when sidebar hidden */}
            <div
              ref={messagesContainerRef}
              className={cn(
                'relative flex-1 overflow-x-hidden overflow-y-auto',
                !isPreviewVisible &&
                  !isRightSidebarVisible &&
                  'flex justify-center'
              )}
            >
              <div
                className={cn(
                  'w-full px-6 pt-4 pb-24',
                  !isPreviewVisible && !isRightSidebarVisible && 'max-w-[800px]'
                )}
              >
                {isLoading ? (
                  <div className="flex min-h-[200px] items-center justify-center py-12">
                    <div className="text-muted-foreground flex items-center gap-3">
                      <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>{t.common.loading}</span>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-full min-w-0 space-y-4">
                    {displayPrompt && !firstMessageIsUserWithSameContent && (
                      <UserMessage
                        content={displayPrompt}
                        attachments={displayAttachments}
                      />
                    )}

                    <MessageList
                      messages={messages}
                      isRunning={isRunning}
                      searchQuery={toolSearchQuery}
                      phase={phase}
                      onApprovePlan={approvePlan}
                      onRejectPlan={rejectPlan}
                    />

                    {isRunning && <RunningIndicator messages={messages} />}

                    {/* Question Input UI - shown when agent asks questions */}
                    {pendingQuestion && (
                      <QuestionInput
                        pendingQuestion={pendingQuestion}
                        onSubmit={respondToQuestion}
                      />
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Reply Input - Centered when sidebar hidden */}
            <div
              className={cn(
                'border-border/50 bg-background relative shrink-0 border-none',
                !isPreviewVisible &&
                  !isRightSidebarVisible &&
                  'flex justify-center'
              )}
            >
              {/* Scroll to bottom button - fixed above input */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="bg-background hover:bg-accent border-border absolute -top-12 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border p-2 shadow-lg transition-all"
                  title={t.common.scrollToBottom || 'Scroll to bottom'}
                >
                  <ArrowDown className="size-4" />
                </button>
              )}
              <div
                className={cn(
                  'w-full px-4 py-3',
                  !isPreviewVisible && !isRightSidebarVisible && 'max-w-[800px]'
                )}
              >
                <ChatInput
                  variant="reply"
                  placeholder={t.home.reply}
                  isRunning={isRunning}
                  onSubmit={handleReply}
                  onStop={stopAgent}
                />
              </div>
            </div>
          </div>

          {/* Divider between chat and preview */}
          {isPreviewVisible && <div className="bg-border/50 w-px shrink-0" />}

          {/* Middle Panel - Artifact Preview (only shown when artifact selected) */}
          {isPreviewVisible && (
            <div className="bg-muted/10 flex min-w-0 flex-1 flex-col overflow-hidden">
              <ArtifactPreview
                artifact={selectedArtifact}
                onClose={handleClosePreview}
                allArtifacts={artifacts}
                livePreviewUrl={livePreviewUrl}
                livePreviewStatus={livePreviewStatus}
                livePreviewError={livePreviewError}
                onStartLivePreview={
                  workingDir ? handleStartLivePreview : undefined
                }
                onStopLivePreview={handleStopLivePreview}
              />
            </div>
          )}

          {/* Divider between preview/chat and sidebar */}
          <div
            className={cn(
              'bg-border/50 shrink-0 transition-all duration-300',
              isRightSidebarVisible ? 'w-px' : 'w-0'
            )}
          />

          {/* Right Panel - Progress, Artifacts, Context (fixed width) */}
          <div
            className={cn(
              'bg-background flex shrink-0 flex-col overflow-hidden rounded-r-2xl transition-all duration-300',
              isRightSidebarVisible ? 'w-[280px]' : 'w-0'
            )}
          >
            <RightSidebar
              messages={messages}
              isRunning={isRunning}
              artifacts={artifacts}
              selectedArtifact={selectedArtifact}
              onSelectArtifact={handleSelectArtifact}
              workingDir={workingDir}
              sessionFolder={sessionFolder || undefined}
              filesVersion={filesVersion}
            />
          </div>
        </div>
      </div>
    </ToolSelectionContext.Provider>
  );
}

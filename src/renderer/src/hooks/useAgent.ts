import { useCallback, useEffect, useRef, useState } from 'react';
import { API_PORT } from '@/config';
import { db, type Task } from '@/data';
import { getSettings } from '@/data/settings';
import {
  addBackgroundTask,
  getBackgroundTask,
  removeBackgroundTask,
  subscribeToBackgroundTasks,
  updateBackgroundTaskStatus,
  type BackgroundTask,
} from '@/lib/background-tasks';
import { newUlid } from '@/lib/ids';
import { getAppDataDir } from '@/lib/paths';

// Import from agent modules
import {
  AGENT_SERVER_URL,
  getModelConfig,
  getSandboxConfig,
  getSkillsConfig,
  getMcpConfig,
  formatFetchError,
  fetchWithRetry,
  buildConversationHistory,
  type PermissionRequest,
  type AgentQuestion,
  type PendingQuestion,
  type MessageAttachment,
  type AgentMessage,
  type TaskPlan,
  type AgentPhase,
  type SessionInfo,
} from './agent';

type ContentLike =
  | string
  | number
  | boolean
  | null
  | undefined
  | ContentLike[]
  | Record<string, unknown>;

function stringifyContentPart(part: ContentLike): string {
  if (part === null || part === undefined) return '';
  if (typeof part === 'string') return part;
  if (typeof part === 'number' || typeof part === 'boolean') {
    return String(part);
  }
  if (Array.isArray(part)) {
    return part.map(stringifyContentPart).join('');
  }
  if (typeof part === 'object') {
    const record = part as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
    if (typeof record.value === 'string') return record.value;
    if (Array.isArray(record.content)) {
      return record.content
        .map((item) => stringifyContentPart(item as ContentLike))
        .join('');
    }
    try {
      return JSON.stringify(part);
    } catch {
      return String(part);
    }
  }
  return String(part);
}

function normalizeMessageContent(content: unknown): string | undefined {
  if (content === null || content === undefined) return undefined;
  if (typeof content === 'string') return content;
  return stringifyContentPart(content as ContentLike);
}

function normalizeAgentMessage(message: AgentMessage): AgentMessage {
  const normalizedContent = normalizeMessageContent(message.content);
  const normalizedOutput = normalizeMessageContent(message.output);
  const normalizedErrorMessage = normalizeMessageContent(message.message);
  const contentUnchanged = normalizedContent === message.content;
  const outputUnchanged = normalizedOutput === message.output;
  const messageUnchanged = normalizedErrorMessage === message.message;
  if (contentUnchanged && outputUnchanged && messageUnchanged) return message;
  return {
    ...message,
    content: normalizedContent,
    output: normalizedOutput,
    message: normalizedErrorMessage,
  };
}

console.log(
  `[API] Environment: ${import.meta.env.PROD ? 'production' : 'development'}, Port: ${API_PORT}`
);

// Re-export types for backward compatibility
export type {
  PermissionRequest,
  QuestionOption,
  AgentQuestion,
  PendingQuestion,
  MessageAttachment,
  AgentMessage,
  PlanStep,
  TaskPlan,
  ConversationMessage,
  AgentPhase,
  SessionInfo,
} from './agent';

export interface UseAgentReturn {
  messages: AgentMessage[];
  isRunning: boolean;
  taskId: string | null;
  sessionId: string | null;
  taskIndex: number;
  sessionFolder: string | null;
  taskFolder: string | null; // Full path to current task folder (sessionFolder/task-XX)
  pendingPermission: PermissionRequest | null;
  pendingQuestion: PendingQuestion | null;
  // Two-phase planning
  phase: AgentPhase;
  plan: TaskPlan | null;
  runAgent: (
    prompt: string,
    existingTaskId?: string,
    sessionInfo?: SessionInfo,
    attachments?: MessageAttachment[],
    workDirOverride?: string
  ) => Promise<string>;
  approvePlan: () => Promise<void>;
  rejectPlan: () => void;
  continueConversation: (
    reply: string,
    attachments?: MessageAttachment[],
    workDirOverride?: string
  ) => Promise<void>;
  stopAgent: () => Promise<void>;
  clearMessages: () => void;
  loadTask: (taskId: string) => Promise<Task | null>;
  loadMessages: (taskId: string) => Promise<void>;
  respondToPermission: (
    permissionId: string,
    approved: boolean
  ) => Promise<void>;
  respondToQuestion: (
    questionId: string,
    answers: Record<string, string>
  ) => Promise<void>;
  setSessionInfo: (sessionId: string, taskIndex: number) => void;
  // Background tasks
  backgroundTasks: BackgroundTask[];
  runningBackgroundTaskCount: number;
}

export function useAgent(): UseAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string>('');
  const [pendingPermission, setPendingPermission] =
    useState<PermissionRequest | null>(null);
  const [pendingQuestion, setPendingQuestion] =
    useState<PendingQuestion | null>(null);
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  // Session management
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(1);
  const [sessionFolder, setSessionFolder] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null); // Backend session ID for API calls
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeTaskIdRef = useRef<string | null>(null); // Track which task is currently active (for message isolation)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null); // For polling messages when restored from background
  // Use refs to track current values for callbacks (to avoid stale closures)
  const taskIdRef = useRef<string | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const initialPromptRef = useRef<string>('');

  // Keep refs in sync with state (for use in callbacks to avoid stale closures)
  useEffect(() => {
    taskIdRef.current = taskId;
  }, [taskId]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    initialPromptRef.current = initialPrompt;
  }, [initialPrompt]);

  // Helper to set session info
  const setSessionInfo = useCallback((sessionId: string, taskIndex: number) => {
    setCurrentSessionId(sessionId);
    setCurrentTaskIndex(taskIndex);
  }, []);

  // Load existing task from database
  // This function handles task switching (moving running task to background)
  // and loading task metadata. Message loading and background restoration is done by loadMessages.
  const loadTask = useCallback(async (id: string): Promise<Task | null> => {
    // If there's a running task, move it to background instead of aborting
    // Use refs to get current values (avoid stale closures)
    const currentTaskId = taskIdRef.current;
    const currentIsRunning = isRunningRef.current;
    const currentPrompt = initialPromptRef.current;

    if (
      abortControllerRef.current &&
      currentTaskId &&
      currentIsRunning &&
      currentTaskId !== id
    ) {
      console.log('[useAgent] Moving task to background:', currentTaskId);
      addBackgroundTask({
        taskId: currentTaskId,
        sessionId: sessionIdRef.current || '',
        abortController: abortControllerRef.current,
        isRunning: true,
        prompt: currentPrompt,
      });
      // Clear refs but don't abort - task continues in background
      abortControllerRef.current = null;
      sessionIdRef.current = null;

      // Clear UI state for the old task
      setMessages([]);
      setPendingPermission(null);
      setPendingQuestion(null);
      setPlan(null);
    }

    // Stop any existing polling from previous task
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Set this as the active task
    activeTaskIdRef.current = id;

    // Note: Background restoration and running state is handled by loadMessages
    // Don't set isRunning here - let loadMessages determine the correct state

    try {
      const task = await db.getTask(id);
      if (task) {
        setInitialPrompt(task.prompt);

        // Set session info if available from the task
        if (task.session_id) {
          setCurrentSessionId(task.session_id);
          setCurrentTaskIndex(task.task_index || 1);

          // Compute and set session folder
          try {
            const appDir = await getAppDataDir();
            const computedSessionFolder = `${appDir}/sessions/${task.session_id}`;
            setSessionFolder(computedSessionFolder);
            console.log(
              '[useAgent] Loaded sessionFolder from task:',
              computedSessionFolder
            );
          } catch (error) {
            console.error('Failed to compute session folder:', error);
          }
        }
      }
      return task;
    } catch (error) {
      console.error('Failed to load task:', error);
      return null;
    }
  }, []);

  // Load existing messages from database
  const loadMessages = useCallback(async (id: string): Promise<void> => {
    // Note: Task switching logic is handled by loadTask, not here
    // This function just loads messages for the specified task

    // Check if the task we're loading is running in background
    const backgroundTask = getBackgroundTask(id);
    const isRestoringFromBackground =
      backgroundTask && backgroundTask.isRunning;

    if (isRestoringFromBackground) {
      console.log(
        '[useAgent] Task is running in background (loadMessages), restoring:',
        id
      );
      abortControllerRef.current = backgroundTask.abortController;
      sessionIdRef.current = backgroundTask.sessionId;

      // Check if the abort controller is still valid (stream still running)
      if (abortControllerRef.current.signal.aborted) {
        console.log('[useAgent] Background task was already completed/aborted');
        setIsRunning(false);
        setPhase('idle');
        abortControllerRef.current = null;
        removeBackgroundTask(id);
      } else {
        setIsRunning(true);
        setPhase('executing'); // Note: might not be accurate if task was in planning phase
        removeBackgroundTask(id);

        // Start polling for new messages (messages will be loaded immediately below)
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
        const pollingTaskId = id;
        let lastMessageCount = 0;
        let stuckCount = 0; // Count how many polls without new messages
        // Long timeout for stuck detection - tools like Bash can take minutes
        const MAX_STUCK_COUNT = 300; // Stop after 5 minutes of no progress

        refreshIntervalRef.current = setInterval(async () => {
          const isStillActive = activeTaskIdRef.current === pollingTaskId;

          // Check abort signal
          if (
            !abortControllerRef.current ||
            abortControllerRef.current.signal.aborted
          ) {
            if (refreshIntervalRef.current) {
              clearInterval(refreshIntervalRef.current);
              refreshIntervalRef.current = null;
            }
            if (isStillActive) {
              setIsRunning(false);
              setPhase('idle');
            }
            return;
          }

          // Also check task status in database - it might have completed
          try {
            const taskStatus = await db.getTask(pollingTaskId);
            if (
              taskStatus &&
              ['completed', 'error', 'stopped'].includes(taskStatus.status)
            ) {
              console.log(
                '[useAgent] Task completed in database, stopping poll:',
                taskStatus.status
              );
              if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
              }
              if (isStillActive) {
                setIsRunning(false);
                setPhase('idle');
              }
              return;
            }
          } catch (error) {
            console.error('[useAgent] Failed to check task status:', error);
          }

          if (isStillActive) {
            // Refresh messages from database
            try {
              const dbMessages = await db.getMessagesByTaskId(pollingTaskId);
              const agentMessages: AgentMessage[] = dbMessages.map((msg) => ({
                type: msg.type as AgentMessage['type'],
                content: normalizeMessageContent(msg.content) || undefined,
                name: msg.tool_name || undefined,
                input: msg.tool_input ? JSON.parse(msg.tool_input) : undefined,
                output: normalizeMessageContent(msg.tool_output) || undefined,
                toolUseId: msg.tool_use_id || undefined,
                subtype: msg.subtype as AgentMessage['subtype'],
                message:
                  normalizeMessageContent(msg.error_message) || undefined,
              }));
              setMessages(agentMessages);

              // Check if there are pending tools (tool_use without matching tool_result)
              const toolUseIds = new Set<string>();
              const toolResultIds = new Set<string>();
              for (const msg of dbMessages) {
                if (msg.type === 'tool_use' && msg.tool_use_id) {
                  toolUseIds.add(msg.tool_use_id);
                } else if (msg.type === 'tool_result' && msg.tool_use_id) {
                  toolResultIds.add(msg.tool_use_id);
                }
              }
              const hasPendingTools = [...toolUseIds].some(
                (id) => !toolResultIds.has(id)
              );

              // Check if we're stuck (no new messages for too long AND no pending tools)
              if (dbMessages.length === lastMessageCount) {
                // Only count as stuck if there are no pending tools
                if (!hasPendingTools) {
                  stuckCount++;
                  if (stuckCount >= MAX_STUCK_COUNT) {
                    console.log(
                      '[useAgent] Task appears stuck, stopping poll after',
                      MAX_STUCK_COUNT,
                      'seconds'
                    );
                    if (refreshIntervalRef.current) {
                      clearInterval(refreshIntervalRef.current);
                      refreshIntervalRef.current = null;
                    }
                    setIsRunning(false);
                    setPhase('idle');
                    return;
                  }
                } else {
                  // Tools are pending, reset stuck counter
                  stuckCount = 0;
                }
              } else {
                // Got new messages, reset stuck counter
                stuckCount = 0;
                lastMessageCount = dbMessages.length;
              }
            } catch (error) {
              console.error('[useAgent] Failed to refresh messages:', error);
            }
          }
        }, 1000);
      }
    } else {
      // Task is NOT running in background - it's a completed/stopped task
      // Reset running state to ensure we don't show running indicators
      console.log('[useAgent] Loading messages for completed task:', id);
      setIsRunning(false);
      setPhase('idle');
      abortControllerRef.current = null;

      // Stop any existing polling
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    // Set this as the active task
    activeTaskIdRef.current = id;

    try {
      const dbMessages = await db.getMessagesByTaskId(id);

      // Build agent messages
      const agentMessages: AgentMessage[] = [];
      for (let i = 0; i < dbMessages.length; i++) {
        const msg = dbMessages[i];
        if (msg.type === 'user') {
          agentMessages.push({
            type: 'user' as const,
            content: normalizeMessageContent(msg.content) || undefined,
          });
        } else if (msg.type === 'text') {
          agentMessages.push({
            type: 'text' as const,
            content: normalizeMessageContent(msg.content) || undefined,
          });
        } else if (msg.type === 'tool_use') {
          agentMessages.push({
            type: 'tool_use' as const,
            name: msg.tool_name || undefined,
            input: msg.tool_input ? JSON.parse(msg.tool_input) : undefined,
          });
        } else if (msg.type === 'tool_result') {
          agentMessages.push({
            type: 'tool_result' as const,
            toolUseId: msg.tool_use_id || undefined,
            output: normalizeMessageContent(msg.tool_output) || undefined,
          });
        } else if (msg.type === 'result') {
          agentMessages.push({
            type: 'result' as const,
            subtype: msg.subtype || undefined,
          });
        } else if (msg.type === 'error') {
          agentMessages.push({
            type: 'error' as const,
            message: normalizeMessageContent(msg.error_message) || undefined,
          });
        } else if (msg.type === 'plan') {
          // Restore plan message with parsed plan data
          try {
            const planData =
              typeof msg.content === 'string'
                ? (JSON.parse(msg.content) as TaskPlan)
                : (msg.content as TaskPlan | undefined);
            if (planData) {
              // Only mark steps as completed if task is NOT running
              // For running tasks (restored from background), keep original status
              const restoredPlan: TaskPlan = isRestoringFromBackground
                ? planData
                : {
                    ...planData,
                    steps: planData.steps.map((s) => ({
                      ...s,
                      status: 'completed' as const,
                    })),
                  };
              agentMessages.push({
                type: 'plan' as const,
                plan: restoredPlan,
              });
            }
          } catch {
            // Ignore parse errors
          }
        } else {
          agentMessages.push({ type: msg.type as AgentMessage['type'] });
        }
      }

      // Set messages immediately
      setMessages(agentMessages);
      setTaskId(id);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, []);

  // Process SSE stream
  const processStream = useCallback(
    async (
      response: Response,
      currentTaskId: string,
      _abortController: AbortController
    ) => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // Track tool execution progress for updating plan steps
      let completedToolCount = 0;
      let totalToolCount = 0;

      // Helper to check if this stream is still for the active task
      const isActiveTask = () => activeTaskIdRef.current === currentTaskId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Note: We no longer cancel the reader when task switches.
        // Background tasks continue to process the stream and save to database.
        // UI updates are skipped for inactive tasks via isActiveTask() checks below.

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as AgentMessage;
              const normalizedData = normalizeAgentMessage(data);

              // Check if this is the active task for UI updates
              const isActive = isActiveTask();

              if (normalizedData.type === 'session') {
                if (isActive) {
                  sessionIdRef.current = normalizedData.sessionId || null;
                }
              } else if (normalizedData.type === 'done') {
                // Update background task status (always, even if not active)
                updateBackgroundTaskStatus(currentTaskId, false);

                // UI updates only for active task
                if (isActive) {
                  // Stream ended - mark all plan steps as completed
                  setPendingPermission(null);
                  setPlan((currentPlan) => {
                    if (!currentPlan) return currentPlan;
                    return {
                      ...currentPlan,
                      steps: currentPlan.steps.map((step) => ({
                        ...step,
                        status: 'completed' as const,
                      })),
                    };
                  });
                }
              } else if (normalizedData.type === 'permission_request') {
                // Handle permission request - only for active task
                if (isActive && normalizedData.permission) {
                  setPendingPermission(normalizedData.permission);
                  setMessages((prev) => [...prev, normalizedData]);
                }
              } else {
                // UI update only for active task
                if (isActive) {
                  setMessages((prev) => [...prev, normalizedData]);
                }

                // Track tool_use messages for plan progress
                if (normalizedData.type === 'tool_use' && normalizedData.name) {
                  const toolUseId =
                    (normalizedData as { id?: string }).id || `tool_${Date.now()}`;
                  totalToolCount++;

                  // Handle AskUserQuestion tool - show question UI and pause execution
                  // Only handle for active task to avoid affecting wrong task's UI
                  if (
                    isActive &&
                    normalizedData.name === 'AskUserQuestion' &&
                    normalizedData.input
                  ) {
                    const input = normalizedData.input as {
                      questions?: AgentQuestion[];
                    };
                    if (input.questions && Array.isArray(input.questions)) {
                      setPendingQuestion({
                        id: `question_${Date.now()}`,
                        toolUseId,
                        questions: input.questions,
                      });
                      // Stop agent execution and wait for user response
                      // The user's answer will be sent via continueConversation
                      console.log(
                        '[useAgent] AskUserQuestion detected, pausing execution'
                      );
                      setIsRunning(false);
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                        abortControllerRef.current = null;
                      }
                      // Also stop backend agent
                      if (sessionIdRef.current) {
                        fetch(
                          `${AGENT_SERVER_URL}/agent/stop/${sessionIdRef.current}`,
                          {
                            method: 'POST',
                          }
                        ).catch(() => {});
                      }
                      reader.cancel();
                      return; // Stop processing this stream
                    }
                  }
                }

                // When we get a tool_result, update plan progress
                if (
                  normalizedData.type === 'tool_result' &&
                  normalizedData.toolUseId
                ) {
                  // Update plan step progress
                  completedToolCount++;
                  setPlan((currentPlan) => {
                    if (!currentPlan || !currentPlan.steps.length)
                      return currentPlan;

                    const stepCount = currentPlan.steps.length;
                    // Calculate how many steps should be completed based on tool progress
                    // Use a heuristic: distribute tool completions across steps
                    const progressRatio =
                      completedToolCount /
                      Math.max(totalToolCount, stepCount * 2);
                    const completedSteps = Math.min(
                      Math.floor(progressRatio * stepCount),
                      stepCount - 1 // Keep at least one step as in_progress until done
                    );

                    const updatedSteps = currentPlan.steps.map(
                      (step, index) => {
                        if (index < completedSteps) {
                          return { ...step, status: 'completed' as const };
                        } else if (index === completedSteps) {
                          return { ...step, status: 'in_progress' as const };
                        }
                        return { ...step, status: 'pending' as const };
                      }
                    );

                    return { ...currentPlan, steps: updatedSteps };
                  });
                }

                // Save message to database
                try {
                  await db.createMessage({
                    task_id: currentTaskId,
                    type: normalizedData.type as
                      | 'text'
                      | 'tool_use'
                      | 'tool_result'
                      | 'result'
                      | 'error'
                      | 'user',
                    content: normalizedData.content,
                    tool_name: normalizedData.name,
                    tool_input: normalizedData.input
                      ? JSON.stringify(normalizedData.input)
                      : undefined,
                    tool_output: normalizedData.output,
                    tool_use_id: normalizedData.toolUseId,
                    subtype: normalizedData.subtype,
                    error_message: normalizedData.message,
                  });

                  // Update task status based on message
                  await db.updateTaskFromMessage(
                    currentTaskId,
                    normalizedData.type,
                    normalizedData.subtype,
                    normalizedData.cost,
                    normalizedData.duration
                  );
                } catch (dbError) {
                  console.error('Failed to save message:', dbError);
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    },
    []
  );

  const resolveTaskWorkDir = useCallback(
    async (
      taskIdValue?: string | null,
      sessionFolderValue?: string | null,
      override?: string
    ): Promise<string> => {
      if (override) return override;
      if (taskIdValue) {
        try {
          const task = await db.getTask(taskIdValue);
          if (task?.workspace_path) return task.workspace_path;
          if (task?.worktree_path) return task.worktree_path;
        } catch (error) {
          console.error('[useAgent] Failed to resolve task workDir:', error);
        }
      }
      if (sessionFolderValue) return sessionFolderValue;
      const settings = getSettings();
      return settings.workDir || (await getAppDataDir());
    },
    []
  );

  // Phase 1: Planning - get a plan from the agent
  const runAgent = useCallback(
    async (
      prompt: string,
      existingTaskId?: string,
      sessionInfo?: SessionInfo,
      attachments?: MessageAttachment[],
      workDirOverride?: string
    ): Promise<string> => {
      // If there's already a running task, move it to background
      if (isRunning && abortControllerRef.current && taskId) {
        console.log(
          '[useAgent] Moving current task to background before starting new:',
          taskId
        );
        addBackgroundTask({
          taskId: taskId,
          sessionId: sessionIdRef.current || '',
          abortController: abortControllerRef.current,
          isRunning: true,
          prompt: initialPrompt,
        });
        abortControllerRef.current = null;
        sessionIdRef.current = null;
      }

      setIsRunning(true);
      setMessages([]);
      setInitialPrompt(prompt);
      setPhase('planning');
      setPlan(null);

      // Handle session info
      const sessId = sessionInfo?.sessionId || currentSessionId || '';
      const taskIdx = sessionInfo?.taskIndex || currentTaskIndex;

      if (sessionInfo) {
        setCurrentSessionId(sessionInfo.sessionId);
        setCurrentTaskIndex(sessionInfo.taskIndex);
      }

      // Compute session folder path
      let computedSessionFolder: string | null = null;
      if (sessId) {
        try {
          const appDir = await getAppDataDir();
          computedSessionFolder = `${appDir}/sessions/${sessId}`;
          setSessionFolder(computedSessionFolder);
        } catch (error) {
          console.error('Failed to compute session folder:', error);
        }
      }

      // Create or use existing task
      const currentTaskId = existingTaskId || newUlid();
      setTaskId(currentTaskId);
      activeTaskIdRef.current = currentTaskId; // Set as active task for stream isolation

      // Save task to database - check if task exists first
      try {
        const existingTask = await db.getTask(currentTaskId);
        if (!existingTask) {
          const settings = getSettings();
          await db.createTask({
            id: currentTaskId,
            session_id: sessId,
            task_index: taskIdx,
            title: prompt,
            prompt,
            cli_tool_id: settings.defaultCliToolId || null,
          });
          console.log(
            '[useAgent] Created new task:',
            currentTaskId,
            'in session:',
            sessId
          );
        } else {
          console.log('[useAgent] Task already exists:', currentTaskId);
        }
      } catch (error) {
        console.error('Failed to create task:', error);
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Prepare images for API (only send image attachments with actual data)
      const images = attachments
        ?.filter((a) => a.type === 'image' && a.data && a.data.length > 0)
        .map((a) => ({
          data: a.data,
          mimeType: a.mimeType || 'image/png',
        }));

      const hasImages = images && images.length > 0;

      // Debug logging for image attachments
      if (attachments && attachments.length > 0) {
        console.log('[useAgent] Attachments received:', attachments.length);
        attachments.forEach((a, i) => {
          console.log(
            `[useAgent] Attachment ${i}: type=${a.type}, hasData=${!!a.data}, dataLength=${a.data?.length || 0}`
          );
        });
        console.log('[useAgent] Valid images for API:', images?.length || 0);
      }

      try {
        const modelConfig = getModelConfig();

        // If images are attached, use direct execution (skip planning)
        // because images need to be processed during execution, not planning
        if (hasImages) {
          console.log('[useAgent] Images attached, using direct execution');
          setPhase('executing');

          // Add user message with attachments to UI
          const userMessage: AgentMessage = {
            type: 'user',
            content: prompt,
            attachments: attachments,
          };
          setMessages([userMessage]);

          // Save user message to database (attachments are not persisted)
          try {
            await db.createMessage({
              task_id: currentTaskId,
              type: 'user',
              content: prompt,
            });
          } catch (error) {
            console.error('Failed to save user message:', error);
          }

          // Use session folder as workDir
          const taskWorkDir = await resolveTaskWorkDir(
            currentTaskId,
            computedSessionFolder,
            workDirOverride
          );
          const sandboxConfig = getSandboxConfig();
          const skillsConfig = getSkillsConfig();

          const mcpConfig = getMcpConfig();

          // Use direct execution endpoint with images
          const response = await fetchWithRetry(`${AGENT_SERVER_URL}/agent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt,
              workDir: taskWorkDir,
              taskId: currentTaskId,
              modelConfig,
              sandboxConfig,
              images,
              skillsConfig,
              mcpConfig,
            }),
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }

          await processStream(response, currentTaskId, abortController);
          return currentTaskId;
        }

        // Phase 1: Request planning (no images)
        const response = await fetchWithRetry(
          `${AGENT_SERVER_URL}/agent/plan`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt,
              modelConfig,
            }),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        // Process planning stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        // Helper to check if this stream is still for the active task
        const isActiveTask = () => activeTaskIdRef.current === currentTaskId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Note: We no longer cancel the reader when task switches.
          // Planning streams continue in background, UI updates are skipped for inactive tasks.

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as AgentMessage;
                const normalizedData = normalizeAgentMessage(data);
                const normalizedContent = normalizedData.content;

                // Check if this task is still active for UI updates
                const isActive = isActiveTask();

                if (normalizedData.type === 'session') {
                  if (isActive) {
                    sessionIdRef.current = normalizedData.sessionId || null;
                  }
                } else if (
                  normalizedData.type === 'direct_answer' &&
                  normalizedContent
                ) {
                  // Simple question - direct answer, no plan needed
                  console.log(
                    '[useAgent] Received direct answer, no plan needed'
                  );
                  // UI updates only for active task
                  if (isActive) {
                    setMessages((prev) => [
                      ...prev,
                      { type: 'text', content: normalizedContent },
                    ]);
                    setPlan(null); // Clear any plan when we get a direct answer
                    setPhase('idle');
                  }

                  // Save to database (always)
                  try {
                    await db.createMessage({
                      task_id: currentTaskId,
                      type: 'text',
                      content: normalizedContent,
                    });
                    const task = await db.getTask(currentTaskId);
                    if (task?.pipeline_template_id) {
                      await db.updateTask(currentTaskId, { status: 'in_review' });
                    } else {
                      await db.updateTask(currentTaskId, { status: 'completed' });
                    }
                  } catch (dbError) {
                    console.error('Failed to save direct answer:', dbError);
                  }
                } else if (normalizedData.type === 'plan' && normalizedData.plan) {
                  // Complex task - received the plan, wait for approval
                  // UI updates only for active task
                  if (isActive) {
                    setPlan(normalizedData.plan);
                    setPhase('awaiting_approval');
                    setMessages((prev) => [...prev, normalizedData]);
                  }
                } else if (normalizedData.type === 'text') {
                  if (isActive) {
                    setMessages((prev) => [...prev, normalizedData]);
                  }
                } else if (normalizedData.type === 'done') {
                  // Planning done
                } else if (normalizedData.type === 'error') {
                  if (isActive) {
                    setMessages((prev) => [...prev, normalizedData]);
                    setPhase('idle');
                  }
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          const errorMessage = formatFetchError(error, '/agent/plan');
          console.error('[useAgent] Request failed:', error);

          // UI updates only for active task
          if (activeTaskIdRef.current === currentTaskId) {
            setMessages((prev) => [
              ...prev,
              { type: 'error', message: errorMessage },
            ]);
            setPhase('idle');
          }

          // Save to database (always)
          try {
            await db.createMessage({
              task_id: currentTaskId,
              type: 'error',
              error_message: errorMessage,
            });
            await db.updateTask(currentTaskId, { status: 'error' });
          } catch (dbError) {
            console.error('Failed to save error:', dbError);
          }
        }
      } finally {
        // Only update running state if this is still the active task
        if (activeTaskIdRef.current === currentTaskId) {
          setIsRunning(false);
          abortControllerRef.current = null;
        }
      }

      return currentTaskId;
    },
    [isRunning, processStream, resolveTaskWorkDir]
  );

  // Phase 2: Execute the approved plan
  const approvePlan = useCallback(async (): Promise<void> => {
    if (!plan || !taskId || phase !== 'awaiting_approval') return;

    // Ensure this task is the active one before execution
    activeTaskIdRef.current = taskId;

    setIsRunning(true);
    setPhase('executing');

    // Initialize plan steps as pending in UI
    const updatedPlan: TaskPlan = {
      ...plan,
      steps: plan.steps.map((s) => ({ ...s, status: 'pending' as const })),
    };
    setPlan(updatedPlan);

    // Save the plan as a message to the database for persistence
    try {
      await db.createMessage({
        task_id: taskId,
        type: 'plan',
        content: JSON.stringify(plan),
      });
      console.log('[useAgent] Saved plan to database:', plan.id);
    } catch (error) {
      console.error('Failed to save plan to database:', error);
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const workDir = await resolveTaskWorkDir(taskId, sessionFolder);
      const modelConfig = getModelConfig();
      const sandboxConfig = getSandboxConfig();
      const skillsConfig = getSkillsConfig();
      const mcpConfig = getMcpConfig();

      const response = await fetchWithRetry(
        `${AGENT_SERVER_URL}/agent/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId: plan.id,
            prompt: initialPrompt,
            workDir,
            taskId,
            modelConfig,
            sandboxConfig,
            skillsConfig,
            mcpConfig,
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      await processStream(response, taskId, abortController);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const errorMessage = formatFetchError(error, '/agent/execute');
        console.error('[useAgent] Execute failed:', error);

        // UI updates only for active task
        if (activeTaskIdRef.current === taskId) {
          setMessages((prev) => [
            ...prev,
            { type: 'error', message: errorMessage },
          ]);
        }

        // Save to database (always)
        try {
          await db.createMessage({
            task_id: taskId,
            type: 'error',
            error_message: errorMessage,
          });
          await db.updateTask(taskId, { status: 'error' });
        } catch (dbError) {
          console.error('Failed to save error:', dbError);
        }
      }
    } finally {
      // Only update running state if this is still the active task
      if (activeTaskIdRef.current === taskId) {
        setIsRunning(false);
        setPhase('idle');
        abortControllerRef.current = null;

        // Reload messages from database to ensure all are displayed
        // (in case some were missed during streaming)
        try {
          const dbMessages = await db.getMessagesByTaskId(taskId);
          const agentMessages: AgentMessage[] = [];
              for (const msg of dbMessages) {
                if (msg.type === 'user') {
                  agentMessages.push({
                    type: 'user' as const,
                    content: normalizeMessageContent(msg.content) || undefined,
                  });
                } else if (msg.type === 'text') {
                  agentMessages.push({
                    type: 'text' as const,
                    content: normalizeMessageContent(msg.content) || undefined,
                  });
                } else if (msg.type === 'tool_use') {
                  agentMessages.push({
                    type: 'tool_use' as const,
                    name: msg.tool_name || undefined,
                    input: msg.tool_input ? JSON.parse(msg.tool_input) : undefined,
                  });
                } else if (msg.type === 'tool_result') {
                  agentMessages.push({
                    type: 'tool_result' as const,
                    toolUseId: msg.tool_use_id || undefined,
                    output: normalizeMessageContent(msg.tool_output) || undefined,
                  });
                } else if (msg.type === 'result') {
                  agentMessages.push({
                    type: 'result' as const,
                    subtype: msg.subtype || undefined,
                  });
                } else if (msg.type === 'error') {
                  agentMessages.push({
                    type: 'error' as const,
                    message:
                      normalizeMessageContent(msg.error_message) || undefined,
                  });
                } else if (msg.type === 'plan') {
              try {
                const planData =
                  typeof msg.content === 'string'
                    ? (JSON.parse(msg.content) as TaskPlan)
                    : (msg.content as TaskPlan | undefined);
                if (planData) {
                  const completedPlan: TaskPlan = {
                    ...planData,
                    steps: planData.steps.map((s) => ({
                      ...s,
                      status: 'completed' as const,
                    })),
                  };
                  agentMessages.push({
                    type: 'plan' as const,
                    plan: completedPlan,
                  });
                }
              } catch {
                // Ignore parse errors
              }
            } else {
              agentMessages.push({ type: msg.type as AgentMessage['type'] });
            }
          }
          setMessages(agentMessages);
        } catch (reloadError) {
          console.error(
            '[useAgent] Failed to reload messages after execution:',
            reloadError
          );
        }
      }
    }
  }, [
    plan,
    taskId,
    phase,
    initialPrompt,
    processStream,
    sessionFolder,
    resolveTaskWorkDir,
  ]);

  // Reject the plan
  const rejectPlan = useCallback((): void => {
    setPlan(null);
    setPhase('idle');
    setMessages((prev) => [...prev, { type: 'text', content: '计划已取消。' }]);
  }, []);

  // Continue conversation with context
  const continueConversation = useCallback(
    async (
      reply: string,
      attachments?: MessageAttachment[],
      workDirOverride?: string
    ): Promise<void> => {
      if (isRunning || !taskId) return;

      // Add user message to UI immediately (with attachments if any)
      const userMessage: AgentMessage = {
        type: 'user',
        content: reply,
        attachments:
          attachments && attachments.length > 0 ? attachments : undefined,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Save user message to database (attachments are not persisted)
      try {
        await db.createMessage({
          task_id: taskId,
          type: 'user',
          content: reply,
        });
      } catch (error) {
        console.error('Failed to save user message:', error);
      }

      setIsRunning(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Build conversation history including the new reply
        const currentMessages = [...messages, userMessage];
        const conversationHistory = buildConversationHistory(
          initialPrompt,
          currentMessages
        );

        const workDir = await resolveTaskWorkDir(
          taskId,
          sessionFolder,
          workDirOverride
        );
        const modelConfig = getModelConfig();
        const sandboxConfig = getSandboxConfig();
        const skillsConfig = getSkillsConfig();
        const mcpConfig = getMcpConfig();

        // Prepare images for API (only send image attachments with actual data)
        const images = attachments
          ?.filter((a) => a.type === 'image' && a.data && a.data.length > 0)
          .map((a) => ({
            data: a.data,
            mimeType: a.mimeType || 'image/png',
          }));

        // Debug logging for image attachments
        if (attachments && attachments.length > 0) {
          console.log(
            '[useAgent] continueConversation attachments:',
            attachments.length
          );
          attachments.forEach((att, i) => {
            console.log(
              `[useAgent] Attachment ${i}: type=${att.type}, hasData=${!!att.data}, dataLength=${att.data?.length || 0}`
            );
          });
          console.log('[useAgent] Valid images for API:', images?.length || 0);
        }

        // Send conversation with full history
        const response = await fetchWithRetry(`${AGENT_SERVER_URL}/agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: reply,
            conversation: conversationHistory,
            workDir,
            taskId,
            modelConfig,
            sandboxConfig,
            images: images && images.length > 0 ? images : undefined,
            skillsConfig,
            mcpConfig,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        await processStream(response, taskId, abortController);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          const errorMessage = formatFetchError(error, '/agent');
          console.error('[useAgent] Continue conversation failed:', error);

          // UI updates only for active task
          if (activeTaskIdRef.current === taskId) {
            setMessages((prev) => [
              ...prev,
              {
                type: 'error',
                message: errorMessage,
              },
            ]);
          }

          // Save error to database (always)
          try {
            await db.createMessage({
              task_id: taskId,
              type: 'error',
              error_message: errorMessage,
            });
            await db.updateTask(taskId, { status: 'error' });
          } catch (dbError) {
            console.error('Failed to save error:', dbError);
          }
        }
      } finally {
        // Only update running state if this is still the active task
        if (activeTaskIdRef.current === taskId) {
          setIsRunning(false);
          abortControllerRef.current = null;
        }
      }
    },
    [
      isRunning,
      taskId,
      messages,
      initialPrompt,
      processStream,
      sessionFolder,
      resolveTaskWorkDir,
    ]
  );

  const stopAgent = useCallback(async () => {
    // Stop polling if active
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Also tell the server to stop
    if (sessionIdRef.current) {
      try {
        await fetch(`${AGENT_SERVER_URL}/agent/stop/${sessionIdRef.current}`, {
          method: 'POST',
        });
      } catch {
        // Ignore errors
      }
    }

    // Update task status
    if (taskId) {
      try {
        await db.updateTask(taskId, { status: 'stopped' });
      } catch (error) {
        console.error('Failed to update task status:', error);
      }
    }

    setIsRunning(false);
  }, [taskId]);

  const clearMessages = useCallback(() => {
    // Stop polling if active
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // This function is for complete cleanup (e.g., starting fresh)
    // For task switching, use loadTask which handles moving to background
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setMessages([]);
    setTaskId(null);
    setInitialPrompt('');
    setPendingPermission(null);
    setPendingQuestion(null);
    setPhase('idle');
    setPlan(null);
    setIsRunning(false);
    sessionIdRef.current = null;
    activeTaskIdRef.current = null;
  }, []);

  // Respond to permission request
  const respondToPermission = useCallback(
    async (permissionId: string, approved: boolean): Promise<void> => {
      if (!sessionIdRef.current) {
        console.error('No active session to respond to permission');
        return;
      }

      try {
        const response = await fetch(`${AGENT_SERVER_URL}/agent/permission`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            permissionId,
            approved,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to respond to permission: ${response.status}`
          );
        }

        // Clear pending permission
        setPendingPermission(null);

        // Add response message to UI
        const responseMessage: AgentMessage = {
          type: 'text',
          content: approved
            ? 'Permission granted. Continuing...'
            : 'Permission denied. Operation cancelled.',
        };
        setMessages((prev) => [...prev, responseMessage]);
      } catch (error) {
        console.error('Failed to respond to permission:', error);
        setPendingPermission(null);
      }
    },
    []
  );

  // Respond to question from AskUserQuestion tool
  const respondToQuestion = useCallback(
    async (
      _questionId: string,
      answers: Record<string, string>
    ): Promise<void> => {
      if (!taskId || !pendingQuestion) {
        console.error('No active task or pending question');
        return;
      }

      // Format answers as a readable message
      const answerText = Object.entries(answers)
        .map(([question, answer]) => `${question}: ${answer}`)
        .join('\n');

      // Clear pending question first
      setPendingQuestion(null);

      // Add user response as a message
      const userMessage: AgentMessage = { type: 'user', content: answerText };
      setMessages((prev) => [...prev, userMessage]);

      // Continue the conversation with the answers
      await continueConversation(answerText);
    },
    [taskId, pendingQuestion, continueConversation]
  );

  // taskFolder is now the same as sessionFolder (no task subfolders)
  const taskFolder = sessionFolder;

  // Track background tasks
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);

  // Subscribe to background task changes
  useEffect(() => {
    const unsubscribe = subscribeToBackgroundTasks((tasks) => {
      setBackgroundTasks(tasks);
    });
    return unsubscribe;
  }, []);

  // Cleanup on unmount - move running task to background instead of abandoning it
  useEffect(() => {
    return () => {
      // Stop polling if active
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      // If there's a running task when unmounting, move it to background
      // so it continues running and shows in the sidebar
      const currentTaskId = taskIdRef.current;
      const currentIsRunning = isRunningRef.current;
      const currentPrompt = initialPromptRef.current;

      if (abortControllerRef.current && currentTaskId && currentIsRunning) {
        console.log(
          '[useAgent] Moving task to background on unmount:',
          currentTaskId
        );
        addBackgroundTask({
          taskId: currentTaskId,
          sessionId: sessionIdRef.current || '',
          abortController: abortControllerRef.current,
          isRunning: true,
          prompt: currentPrompt,
        });
        // Don't clear refs here since the effect is cleaning up
        // The stream will continue to run and save to database
      }
    };
  }, []);

  // Get count of running background tasks
  const runningBackgroundTaskCount = backgroundTasks.filter(
    (t) => t.isRunning
  ).length;

  return {
    messages,
    isRunning,
    taskId,
    sessionId: currentSessionId,
    taskIndex: currentTaskIndex,
    sessionFolder,
    taskFolder,
    pendingPermission,
    pendingQuestion,
    phase,
    plan,
    runAgent,
    approvePlan,
    rejectPlan,
    continueConversation,
    stopAgent,
    clearMessages,
    loadTask,
    loadMessages,
    respondToPermission,
    respondToQuestion,
    setSessionInfo,
    // Background tasks
    backgroundTasks,
    runningBackgroundTaskCount,
  };
}

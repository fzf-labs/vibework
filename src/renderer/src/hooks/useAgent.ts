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
import { newUlid, newUuid } from '@/lib/ids';
import { getSessionsDir, getVibeworkDataDir } from '@/lib/paths';
import { getProjectMcpConfigPath } from '@/lib/mcp';

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
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
  isRunning: boolean;
  taskId: string | null;
  sessionId: string | null;
  sessionFolder: string | null;
  taskFolder: string | null; // Same as sessionFolder in the new model
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
  setSessionInfo: (sessionId: string | null) => void;
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
  const setSessionInfo = useCallback((sessionId: string | null) => {
    setCurrentSessionId(sessionId);
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
          sessionIdRef.current = task.session_id;
        } else {
          setCurrentSessionId(null);
          sessionIdRef.current = null;
        }

        // Compute and set session folder (task-based)
        try {
          const sessionsDir = await getSessionsDir();
          const projectKey = task.project_id || 'project';
          const computedSessionFolder = `${sessionsDir}/${projectKey}/${task.id}`;
          setSessionFolder(computedSessionFolder);
          console.log(
            '[useAgent] Loaded sessionFolder from task:',
            computedSessionFolder
          );
        } catch (error) {
          console.error('Failed to compute session folder:', error);
        }
      }
      return task;
    } catch (error) {
      console.error('Failed to load task:', error);
      return null;
    }
  }, []);

  // Load existing messages (message persistence removed)
  const loadMessages = useCallback(async (id: string): Promise<void> => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    activeTaskIdRef.current = id;
    setMessages([]);
    setPendingPermission(null);
    setPendingQuestion(null);
    setPlan(null);
    setTaskId(id);

    const backgroundTask = getBackgroundTask(id);
    if (
      backgroundTask &&
      backgroundTask.isRunning &&
      !backgroundTask.abortController.signal.aborted
    ) {
      console.log('[useAgent] Restoring background task without message history:', id);
      abortControllerRef.current = backgroundTask.abortController;
      sessionIdRef.current = backgroundTask.sessionId;
      setIsRunning(true);
      setPhase('executing');
      removeBackgroundTask(id);
      return;
    }

    setIsRunning(false);
    setPhase('idle');
    abortControllerRef.current = null;
  }, []);

  const getCurrentWorkNodeExecutionId = useCallback(async (currentTaskId: string): Promise<string | null> => {
    try {
      const workflow = await db.getWorkflowByTaskId(currentTaskId) as {
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
      console.error('[useAgent] Failed to resolve agent execution:', error);
      return null;
    }
  }, []);

  const startAgentExecutionForTask = useCallback(async (currentTaskId: string): Promise<string | null> => {
    const executionId = await getCurrentWorkNodeExecutionId(currentTaskId);
    if (!executionId) return null;
    try {
      await db.updateAgentExecutionStatus(executionId, 'running');
    } catch (error) {
      console.error('[useAgent] Failed to mark agent execution running:', error);
    }
    return executionId;
  }, [getCurrentWorkNodeExecutionId]);

  const completeAgentExecution = useCallback(async (
    executionId: string | null,
    cost?: number,
    duration?: number
  ): Promise<void> => {
    if (!executionId) return;
    try {
      await db.updateAgentExecutionStatus(executionId, 'completed', cost, duration);
    } catch (error) {
      console.error('[useAgent] Failed to mark agent execution completed:', error);
    }
  }, []);

  // Process SSE stream
  const processStream = useCallback(
    async (
      response: Response,
      currentTaskId: string,
      _abortController: AbortController,
      agentExecutionId?: string | null
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
      let executionCompleted = false;
      let lastCost: number | undefined;
      let lastDuration: number | undefined;

      // Helper to check if this stream is still for the active task
      const isActiveTask = () => activeTaskIdRef.current === currentTaskId;
      const markExecutionCompleted = async (cost?: number, duration?: number) => {
        if (!agentExecutionId || executionCompleted) return;
        executionCompleted = true;
        await completeAgentExecution(agentExecutionId, cost, duration);
      };

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

                if (normalizedData.type === 'result') {
                  lastCost = normalizedData.cost ?? lastCost;
                  lastDuration = normalizedData.duration ?? lastDuration;
                  await markExecutionCompleted(normalizedData.cost, normalizedData.duration);
                } else if (normalizedData.type === 'error') {
                  await markExecutionCompleted(normalizedData.cost, normalizedData.duration);
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

              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
      await markExecutionCompleted(lastCost, lastDuration);
    },
    [completeAgentExecution]
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
      return settings.workDir || (await getVibeworkDataDir());
    },
    []
  );

  const resolveProjectMcpConfigPath = useCallback(
    async (taskIdValue?: string | null, task?: Task | null): Promise<string | undefined> => {
      try {
        const taskRecord = task || (taskIdValue ? await db.getTask(taskIdValue) : null);
        const projectId = taskRecord?.project_id;
        if (!projectId || !window.api?.projects?.get) return undefined;
        const project = await window.api.projects.get(projectId) as { path?: string } | null;
        if (!project?.path) return undefined;
        const cliToolId = taskRecord?.cli_tool_id || getSettings().defaultCliToolId;
        return getProjectMcpConfigPath(project.path, cliToolId || undefined);
      } catch (error) {
        console.warn('[useAgent] Failed to resolve project MCP config path:', error);
        return undefined;
      }
    },
    []
  );

  // Phase 1: Planning - get a plan from the agent
  const runAgent = useCallback(
    async (
      prompt: string,
      existingTaskId?: string,
      _sessionInfo?: SessionInfo,
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
      const initialUserMessage: AgentMessage | null =
        prompt.trim() || (attachments && attachments.length > 0)
          ? {
              type: 'user',
              content: prompt,
              attachments:
                attachments && attachments.length > 0 ? attachments : undefined,
            }
          : null;
      setMessages(initialUserMessage ? [initialUserMessage] : []);
      setInitialPrompt(prompt);
      setPhase('planning');
      setPlan(null);

      // Create or use existing task
      const currentTaskId = existingTaskId || newUlid();
      let sessId = newUuid();
      let existingTask: Task | null = null;
      try {
        existingTask = await db.getTask(currentTaskId);
        if (existingTask?.session_id) {
          sessId = existingTask.session_id;
        }
      } catch (error) {
        console.error('Failed to load existing task:', error);
      }
      setCurrentSessionId(sessId);
      sessionIdRef.current = sessId;

      // Compute session folder path
      let computedSessionFolder: string | null = null;
      try {
        if (existingTask && !existingTask.session_id) {
          const updatedTask = await db.updateTask(currentTaskId, { session_id: sessId });
          if (updatedTask) existingTask = updatedTask;
        }
      } catch (error) {
        console.error('[useAgent] Failed to persist session_id:', error);
      }

      try {
        const sessionsDir = await getSessionsDir();
        const projectKey = existingTask?.project_id || 'project';
        computedSessionFolder = `${sessionsDir}/${projectKey}/${currentTaskId}`;
        setSessionFolder(computedSessionFolder);
      } catch (error) {
        console.error('Failed to compute session folder:', error);
      }
      setTaskId(currentTaskId);
      activeTaskIdRef.current = currentTaskId; // Set as active task for stream isolation

      // Save task to database - check if task exists first
      try {
        if (!existingTask) {
          const settings = getSettings();
          let agentToolConfigId: string | null = null;
          if (settings.defaultCliToolId) {
            try {
              const configs = await db.listAgentToolConfigs(settings.defaultCliToolId);
              const list = Array.isArray(configs) ? (configs as Array<{ id: string; is_default?: number }>) : [];
              const defaultConfig = list.find((cfg) => cfg.is_default);
              agentToolConfigId = defaultConfig?.id ?? null;
            } catch {
              agentToolConfigId = null;
            }
          }
          await db.createTask({
            id: currentTaskId,
            session_id: sessId,
            title: prompt,
            prompt,
            cli_tool_id: settings.defaultCliToolId || null,
            agent_tool_config_id: agentToolConfigId,
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

      let executionId: string | null = null;
      try {
        const modelConfig = getModelConfig();
        const projectMcpConfigPath = await resolveProjectMcpConfigPath(
          currentTaskId,
          existingTask
        );
        const mcpConfig = getMcpConfig(
          projectMcpConfigPath
            ? {
                projectConfigPath: projectMcpConfigPath,
                mergeStrategy: 'project_over_global',
              }
            : undefined
        );

        // If images are attached, use direct execution (skip planning)
        // because images need to be processed during execution, not planning
        if (hasImages) {
          console.log('[useAgent] Images attached, using direct execution');
          setPhase('executing');

          // Use session folder as workDir
          const taskWorkDir = await resolveTaskWorkDir(
            currentTaskId,
            computedSessionFolder,
            workDirOverride
          );
          const sandboxConfig = getSandboxConfig();
          const skillsConfig = await getSkillsConfig();

          executionId = await startAgentExecutionForTask(currentTaskId);
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

          await processStream(response, currentTaskId, abortController, executionId);
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

                  const executionId = await startAgentExecutionForTask(currentTaskId);
                  await completeAgentExecution(
                    executionId,
                    normalizedData.cost,
                    normalizedData.duration
                  );
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

          await completeAgentExecution(executionId);
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
    [
      completeAgentExecution,
      initialPrompt,
      isRunning,
      processStream,
      resolveProjectMcpConfigPath,
      resolveTaskWorkDir,
      startAgentExecutionForTask,
      taskId,
    ]
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

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let executionId: string | null = null;
    try {
      const workDir = await resolveTaskWorkDir(taskId, sessionFolder);
      const modelConfig = getModelConfig();
      const sandboxConfig = getSandboxConfig();
      const skillsConfig = await getSkillsConfig();
      const projectMcpConfigPath = await resolveProjectMcpConfigPath(taskId);
      const mcpConfig = getMcpConfig(
        projectMcpConfigPath
          ? {
              projectConfigPath: projectMcpConfigPath,
              mergeStrategy: 'project_over_global',
            }
          : undefined
      );

      executionId = await startAgentExecutionForTask(taskId);
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

      await processStream(response, taskId, abortController, executionId);
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

        await completeAgentExecution(executionId);
      }
    } finally {
      // Only update running state if this is still the active task
      if (activeTaskIdRef.current === taskId) {
        setIsRunning(false);
        setPhase('idle');
        abortControllerRef.current = null;

        // Message history is no longer reloaded from database.
      }
    }
  }, [
    plan,
    taskId,
    phase,
    initialPrompt,
    processStream,
    sessionFolder,
    resolveProjectMcpConfigPath,
    resolveTaskWorkDir,
    startAgentExecutionForTask,
    completeAgentExecution,
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

      setIsRunning(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let executionId: string | null = null;
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
        const skillsConfig = await getSkillsConfig();
        const projectMcpConfigPath = await resolveProjectMcpConfigPath(taskId);
        const mcpConfig = getMcpConfig(
          projectMcpConfigPath
            ? {
                projectConfigPath: projectMcpConfigPath,
                mergeStrategy: 'project_over_global',
              }
            : undefined
        );

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
        executionId = await startAgentExecutionForTask(taskId);
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

        await processStream(response, taskId, abortController, executionId);
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

          await completeAgentExecution(executionId);
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
      resolveProjectMcpConfigPath,
      resolveTaskWorkDir,
      startAgentExecutionForTask,
      completeAgentExecution,
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

    // Keep task in in_progress status when stopped - user can continue
    setIsRunning(false);
    if (taskId) {
      const executionId = await getCurrentWorkNodeExecutionId(taskId);
      await completeAgentExecution(executionId);
    }
  }, [taskId, completeAgentExecution, getCurrentWorkNodeExecutionId]);

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
    setMessages,
    isRunning,
    taskId,
    sessionId: currentSessionId,
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

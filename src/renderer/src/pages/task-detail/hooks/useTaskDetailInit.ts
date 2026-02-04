import { useEffect, useRef, useState } from 'react';

import { db, type Task } from '@/data';
import { getSettings } from '@/data/settings';
import { newUuid } from '@/lib/ids';
import type { AgentMessage } from '@/hooks/useAgent';

interface UseTaskDetailInitInput {
  taskId?: string;
  initialPrompt: string;
  initialSessionId?: string;
  loadTask: (taskId: string) => Promise<Task | null>;
  loadMessages: (taskId: string) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
}

export function useTaskDetailInit({
  taskId,
  initialPrompt,
  initialSessionId,
  loadTask,
  loadMessages,
  setMessages,
}: UseTaskDetailInitInput) {
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

    void initialize();
  }, [
    taskId,
    loadMessages,
    loadTask,
    initialPrompt,
    initialSessionId,
    hasStarted,
    setMessages,
  ]);

  return {
    task,
    setTask,
    isLoading,
    hasStarted,
    setHasStarted,
  };
}

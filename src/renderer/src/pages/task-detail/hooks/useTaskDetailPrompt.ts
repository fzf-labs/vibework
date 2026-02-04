import { useCallback, useMemo } from 'react';

import type { Task } from '@/data';

interface UseTaskDetailPromptInput {
  task: Task | null;
  initialPrompt: string;
}

export function useTaskDetailPrompt({ task, initialPrompt }: UseTaskDetailPromptInput) {
  const baseTaskPrompt = useMemo(
    () => task?.prompt || initialPrompt || '',
    [initialPrompt, task?.prompt]
  );

  const taskPrompt = useMemo(
    () => task?.prompt || initialPrompt,
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

  return {
    baseTaskPrompt,
    taskPrompt,
    buildCliPrompt,
  };
}

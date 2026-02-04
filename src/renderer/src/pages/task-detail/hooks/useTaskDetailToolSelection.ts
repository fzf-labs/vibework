import { useEffect, useMemo, useState } from 'react';

import type { AgentMessage } from '@/hooks/useAgent';

interface UseTaskDetailToolSelectionInput {
  taskId?: string;
  messages: AgentMessage[];
  isRunning: boolean;
}

export function useTaskDetailToolSelection({
  taskId,
  messages,
  isRunning,
}: UseTaskDetailToolSelectionInput) {
  const [selectedToolIndex, setSelectedToolIndex] = useState<number | null>(null);

  const toolCount = useMemo(
    () => messages.filter((message) => message.type === 'tool_use').length,
    [messages]
  );

  useEffect(() => {
    if (isRunning && toolCount > 0) {
      setSelectedToolIndex(toolCount - 1);
    }
  }, [toolCount, isRunning]);

  useEffect(() => {
    setSelectedToolIndex(null);
  }, [taskId]);

  const toolSelectionValue = useMemo(
    () => ({
      selectedToolIndex,
      setSelectedToolIndex,
      showComputer: () => {},
    }),
    [selectedToolIndex]
  );

  return { selectedToolIndex, setSelectedToolIndex, toolSelectionValue };
}

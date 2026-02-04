import { useEffect, useState } from 'react';

import type { CLIToolInfo } from '../types';

export function useTaskDetailCliTools() {
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([]);

  useEffect(() => {
    let active = true;
    const loadCliTools = async () => {
      try {
        const result =
          (await window.api?.cliTools?.getAll?.()) ||
          (await window.api?.cliTools?.detectAll?.());
        const tools = Array.isArray(result) ? (result as CLIToolInfo[]) : [];
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

    void loadCliTools();
    return () => {
      active = false;
    };
  }, []);

  return { cliTools };
}

import { useMemo } from 'react';

import type { Task } from '@/data';
import type { Artifact } from '@/components/artifacts';

interface UseTaskDetailWorkingDirInput {
  task: Task | null;
  artifacts: Artifact[];
  sessionFolder: string | null;
}

export function useTaskDetailWorkingDir({
  task,
  artifacts,
  sessionFolder,
}: UseTaskDetailWorkingDirInput) {
  const workingDir = useMemo(() => {
    if (task?.workspace_path) {
      return task.workspace_path;
    }

    if (task?.worktree_path) {
      return task.worktree_path;
    }

    if (sessionFolder) {
      return sessionFolder;
    }

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

  return { workingDir };
}

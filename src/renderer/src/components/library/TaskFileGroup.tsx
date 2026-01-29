import { useState } from 'react';
import type { LibraryFile, Task } from '@/data';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

import { FileCard } from './FileCard';

interface TaskFileGroupProps {
  task: Task;
  files: LibraryFile[];
  viewMode: 'grid' | 'list';
  onToggleFavorite?: (fileId: string) => void;
}

// Format date to display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

export function TaskFileGroup({
  task,
  files,
  viewMode,
  onToggleFavorite,
}: TaskFileGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const INITIAL_SHOW_COUNT = 3;
  const hasMoreFiles = files.length > INITIAL_SHOW_COUNT;
  const displayFiles = isExpanded ? files : files.slice(0, INITIAL_SHOW_COUNT);

  return (
    <div className="space-y-4">
      {/* Task header */}
      <div className="flex items-center justify-between">
        <h3 className="text-foreground flex-1 truncate text-base font-semibold">
          {task.prompt}
        </h3>
        <span className="text-muted-foreground ml-4 shrink-0 text-sm">
          {formatDate(task.created_at)}
        </span>
      </div>

      {/* Files grid/list */}
      <div
        className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col gap-3'
        )}
      >
        {displayFiles.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {/* Show more/less button */}
      {hasMoreFiles && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-sm transition-colors duration-200"
        >
          <ChevronDown
            className={cn(
              'size-4 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
          <span>
            {isExpanded
              ? 'Show less'
              : `${files.length - INITIAL_SHOW_COUNT} more files`}
          </span>
        </button>
      )}
    </div>
  );
}

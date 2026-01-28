import { cn } from '@/lib/utils';
import {
  File,
  FilePlus,
  FileX,
  FileEdit,
  FileQuestion,
  Check,
  Circle,
} from 'lucide-react';

export interface ChangedFile {
  path: string;
  status: string;
  staged: boolean;
}

interface ChangedFilesListProps {
  files: ChangedFile[];
  selectedFile?: string;
  onSelectFile?: (file: ChangedFile) => void;
  onStageFile?: (file: ChangedFile) => void;
  onUnstageFile?: (file: ChangedFile) => void;
  className?: string;
}

function getStatusIcon(status: string) {
  const firstChar = status[0];
  const secondChar = status[1];
  const effectiveStatus = firstChar !== ' ' ? firstChar : secondChar;

  switch (effectiveStatus) {
    case 'A':
      return FilePlus;
    case 'D':
      return FileX;
    case 'M':
      return FileEdit;
    case '?':
      return FileQuestion;
    default:
      return File;
  }
}

function getStatusColor(status: string) {
  const firstChar = status[0];
  const secondChar = status[1];
  const effectiveStatus = firstChar !== ' ' ? firstChar : secondChar;

  switch (effectiveStatus) {
    case 'A':
      return 'text-green-500';
    case 'D':
      return 'text-red-500';
    case 'M':
      return 'text-yellow-500';
    case '?':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusLabel(status: string) {
  const firstChar = status[0];
  const secondChar = status[1];
  const effectiveStatus = firstChar !== ' ' ? firstChar : secondChar;

  switch (effectiveStatus) {
    case 'A':
      return 'Added';
    case 'D':
      return 'Deleted';
    case 'M':
      return 'Modified';
    case '?':
      return 'Untracked';
    case 'R':
      return 'Renamed';
    case 'C':
      return 'Copied';
    default:
      return 'Changed';
  }
}

export function ChangedFilesList({
  files,
  selectedFile,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  className,
}: ChangedFilesListProps) {
  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  if (files.length === 0) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <p className="text-muted-foreground text-sm">No changes</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Staged files */}
      {stagedFiles.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 px-2">
            <Check className="size-4 text-green-500" />
            <span className="text-sm font-medium">
              Staged ({stagedFiles.length})
            </span>
          </div>
          <div className="space-y-0.5">
            {stagedFiles.map((file) => (
              <FileItem
                key={file.path}
                file={file}
                isSelected={selectedFile === file.path}
                onSelect={() => onSelectFile?.(file)}
                onToggleStage={() => onUnstageFile?.(file)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unstaged files */}
      {unstagedFiles.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 px-2">
            <Circle className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Changes ({unstagedFiles.length})
            </span>
          </div>
          <div className="space-y-0.5">
            {unstagedFiles.map((file) => (
              <FileItem
                key={file.path}
                file={file}
                isSelected={selectedFile === file.path}
                onSelect={() => onSelectFile?.(file)}
                onToggleStage={() => onStageFile?.(file)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileItem({
  file,
  isSelected,
  onSelect,
  onToggleStage,
}: {
  file: ChangedFile;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStage: () => void;
}) {
  const StatusIcon = getStatusIcon(file.status);
  const statusColor = getStatusColor(file.status);
  const statusLabel = getStatusLabel(file.status);
  const fileName = file.path.split('/').pop() || file.path;
  const dirPath = file.path.includes('/')
    ? file.path.substring(0, file.path.lastIndexOf('/'))
    : '';

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer',
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      )}
      onClick={onSelect}
    >
      <StatusIcon className={cn('size-4 shrink-0', statusColor)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm">{fileName}</span>
          <span className={cn('text-xs', statusColor)}>[{statusLabel}]</span>
        </div>
        {dirPath && (
          <div className="text-muted-foreground truncate text-xs">{dirPath}</div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStage();
        }}
        className={cn(
          'shrink-0 rounded px-2 py-0.5 text-xs transition-colors',
          'opacity-0 group-hover:opacity-100',
          file.staged
            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
            : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
        )}
      >
        {file.staged ? 'Unstage' : 'Stage'}
      </button>
    </div>
  );
}

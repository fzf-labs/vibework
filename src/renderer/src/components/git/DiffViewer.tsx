import { cn } from '@/lib/utils';
import { Plus, Minus } from 'lucide-react';

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  isBinary: boolean;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

interface DiffViewerProps {
  diff: FileDiff;
  className?: string;
}

export function DiffViewer({ diff, className }: DiffViewerProps) {
  if (diff.isBinary) {
    return (
      <div className={cn('rounded-lg border p-4', className)}>
        <div className="text-muted-foreground text-sm">
          Binary file not shown
        </div>
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div className={cn('rounded-lg border p-4', className)}>
        <div className="text-muted-foreground text-sm">No changes</div>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      {/* File header */}
      <div className="bg-muted/50 border-b px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          {diff.isNew && (
            <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-600">
              New
            </span>
          )}
          {diff.isDeleted && (
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-600">
              Deleted
            </span>
          )}
          {diff.isRenamed && (
            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-600">
              Renamed
            </span>
          )}
          <span className="font-mono">{diff.newPath}</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {diff.hunks.map((hunk, hunkIndex) => (
              <HunkView key={hunkIndex} hunk={hunk} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HunkView({ hunk }: { hunk: DiffHunk }) {
  return (
    <>
      {/* Hunk header */}
      <tr className="bg-blue-500/10">
        <td
          colSpan={4}
          className="text-muted-foreground px-4 py-1 font-mono text-xs"
        >
          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines}{' '}
          @@
        </td>
      </tr>

      {/* Diff lines */}
      {hunk.lines.map((line, lineIndex) => (
        <DiffLineView key={lineIndex} line={line} />
      ))}
    </>
  );
}

function DiffLineView({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === 'add'
      ? 'bg-green-500/10'
      : line.type === 'delete'
        ? 'bg-red-500/10'
        : '';

  const textColor =
    line.type === 'add'
      ? 'text-green-600'
      : line.type === 'delete'
        ? 'text-red-600'
        : 'text-foreground';

  const lineNumColor =
    line.type === 'add'
      ? 'bg-green-500/20 text-green-700'
      : line.type === 'delete'
        ? 'bg-red-500/20 text-red-700'
        : 'bg-muted/30 text-muted-foreground';

  return (
    <tr className={bgColor}>
      {/* Old line number */}
      <td
        className={cn(
          'w-12 select-none px-2 py-0 text-right font-mono text-xs',
          lineNumColor
        )}
      >
        {line.oldLineNumber ?? ''}
      </td>

      {/* New line number */}
      <td
        className={cn(
          'w-12 select-none px-2 py-0 text-right font-mono text-xs',
          lineNumColor
        )}
      >
        {line.newLineNumber ?? ''}
      </td>

      {/* Change indicator */}
      <td className="w-6 select-none px-1 py-0 text-center">
        {line.type === 'add' && <Plus className="inline size-3 text-green-600" />}
        {line.type === 'delete' && (
          <Minus className="inline size-3 text-red-600" />
        )}
      </td>

      {/* Content */}
      <td className={cn('px-2 py-0 font-mono text-xs whitespace-pre', textColor)}>
        {line.content}
      </td>
    </tr>
  );
}

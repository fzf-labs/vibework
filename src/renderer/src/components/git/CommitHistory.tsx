import { cn } from '@/lib/utils';
import { GitCommit, User, Calendar } from 'lucide-react';

export interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface CommitHistoryProps {
  commits: Commit[];
  selectedCommit?: string;
  onSelectCommit?: (commit: Commit) => void;
  className?: string;
}

export function CommitHistory({
  commits,
  selectedCommit,
  onSelectCommit,
  className,
}: CommitHistoryProps) {
  if (commits.length === 0) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <p className="text-muted-foreground text-sm">No commits</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {commits.map((commit) => (
        <CommitItem
          key={commit.hash}
          commit={commit}
          isSelected={selectedCommit === commit.hash}
          onSelect={() => onSelectCommit?.(commit)}
        />
      ))}
    </div>
  );
}

function CommitItem({
  commit,
  isSelected,
  onSelect,
}: {
  commit: Commit;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const shortHash = commit.hash.substring(0, 7);

  return (
    <div
      className={cn(
        'rounded-md px-3 py-2 cursor-pointer transition-colors',
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <GitCommit className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{commit.message}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono text-primary/80">{shortHash}</span>
            <span className="flex items-center gap-1">
              <User className="size-3" />
              {commit.author}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {commit.date}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GitBranch, Check, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BranchSelectorProps {
  branches: string[];
  currentBranch: string;
  onSelectBranch?: (branch: string) => void;
  onCreateBranch?: (name: string) => void;
  className?: string;
}

export function BranchSelector({
  branches,
  currentBranch,
  onSelectBranch,
  onCreateBranch,
  className,
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  const handleSelectBranch = (branch: string) => {
    if (branch !== currentBranch) {
      onSelectBranch?.(branch);
    }
    setIsOpen(false);
  };

  const handleCreateBranch = () => {
    if (newBranchName.trim()) {
      onCreateBranch?.(newBranchName.trim());
      setNewBranchName('');
      setIsCreating(false);
      setIsOpen(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <GitBranch className="size-4" />
        <span className="max-w-[150px] truncate">{currentBranch}</span>
        <ChevronDown className="size-4" />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover p-1 shadow-lg">
            {/* Branch list */}
            <div className="max-h-[200px] overflow-y-auto">
              {branches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => handleSelectBranch(branch)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm',
                    'hover:bg-accent transition-colors',
                    branch === currentBranch && 'bg-accent/50'
                  )}
                >
                  {branch === currentBranch ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <span className="size-4" />
                  )}
                  <span className="truncate">{branch}</span>
                </button>
              ))}
            </div>

            {/* Create new branch */}
            <div className="border-t mt-1 pt-1">
              {isCreating ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateBranch();
                      if (e.key === 'Escape') setIsCreating(false);
                    }}
                    placeholder="Branch name"
                    className="flex-1 bg-transparent text-sm outline-none"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCreateBranch}
                    className="h-6 px-2"
                  >
                    Create
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Plus className="size-4" />
                  <span>New branch</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

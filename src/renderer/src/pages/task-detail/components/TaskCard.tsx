import { MoreHorizontal, PanelLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { LanguageStrings, TaskMetaRow } from '../types';

interface TaskCardProps {
  t: LanguageStrings;
  title: string;
  metaRows: TaskMetaRow[];
  showStartButton: boolean;
  startDisabled: boolean;
  onStartTask: () => void;
  onToggleSidebar: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

export function TaskCard({
  t,
  title,
  metaRows,
  showStartButton,
  startDisabled,
  onStartTask,
  onToggleSidebar,
  onEdit,
  onDelete,
  canEdit,
}: TaskCardProps) {
  return (
    <section className="border-border/50 bg-background/95 rounded-xl border shadow-sm">
      <div className="border-border/50 flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex cursor-pointer items-center justify-center rounded-lg p-2 transition-colors duration-200 md:hidden"
          >
            <PanelLeft className="size-4" />
          </button>
          <span className="text-muted-foreground text-xs font-semibold">
            {t.task.taskCardTitle || 'Task'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showStartButton && (
            <Button size="sm" onClick={onStartTask} disabled={startDisabled}>
              {t.task.startExecution || 'Start'}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
                type="button"
                aria-label="Task actions"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                  {t.common.edit}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                {t.common.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2 px-3 py-2">
        <div className="text-foreground text-sm font-medium break-words">
          {title}
        </div>

        {metaRows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metaRows.map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.key}
                  className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs"
                >
                  <Icon className="text-muted-foreground size-3.5 shrink-0" />
                  <div className="min-w-0 truncate">{row.value}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

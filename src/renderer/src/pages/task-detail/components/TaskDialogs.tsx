import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { LanguageStrings } from '../types';

type CLIToolInfo = {
  id: string;
  name?: string;
  displayName?: string;
};

type PipelineTemplateOption = {
  id: string;
  name: string;
};

interface TaskDialogsProps {
  t: LanguageStrings;
  isCliReviewOpen: boolean;
  setIsCliReviewOpen: (open: boolean) => void;
  isCliTaskReviewPending: boolean;
  onContinueCliTask: () => void;
  onApproveCliTask: () => void;
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editPrompt: string;
  setEditPrompt: (value: string) => void;
  editCliToolId: string;
  setEditCliToolId: (value: string) => void;
  editPipelineTemplateId: string;
  setEditPipelineTemplateId: (value: string) => void;
  cliTools: CLIToolInfo[];
  pipelineTemplates: PipelineTemplateOption[];
  onSaveEdit: () => void;
  isDeleteOpen: boolean;
  setIsDeleteOpen: (open: boolean) => void;
  onDelete: () => void;
}

export function TaskDialogs({
  t,
  isCliReviewOpen,
  setIsCliReviewOpen,
  isCliTaskReviewPending,
  onContinueCliTask,
  onApproveCliTask,
  isEditOpen,
  setIsEditOpen,
  editPrompt,
  setEditPrompt,
  editCliToolId,
  setEditCliToolId,
  editPipelineTemplateId,
  setEditPipelineTemplateId,
  cliTools,
  pipelineTemplates,
  onSaveEdit,
  isDeleteOpen,
  setIsDeleteOpen,
  onDelete,
}: TaskDialogsProps) {
  return (
    <>
      <Dialog
        open={isCliReviewOpen && isCliTaskReviewPending}
        onOpenChange={setIsCliReviewOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t.task.executionCompleted || 'Execution completed'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground text-sm">
            {t.task.pendingApproval || 'Pending approval'}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onContinueCliTask}>
              {t.task.continueConversation || 'Continue'}
            </Button>
            <Button onClick={onApproveCliTask}>
              {t.task.confirmComplete || 'Confirm complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {`${t.common.edit} ${t.task.taskInfo || 'Task'}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.task.createPromptLabel}
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="border-input bg-background text-foreground w-full resize-none rounded-md border px-3 py-2 text-sm"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.task.createCliLabel}
              </label>
              <select
                value={editCliToolId}
                onChange={(e) => setEditCliToolId(e.target.value)}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">{t.task.createCliPlaceholder}</option>
                {cliTools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.displayName || tool.name || tool.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.task.createPipelineLabel}
              </label>
              <select
                value={editPipelineTemplateId}
                onChange={(e) => setEditPipelineTemplateId(e.target.value)}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">{t.task.createPipelineNone}</option>
                {pipelineTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={onSaveEdit}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common.deleteTask}</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground text-sm">
            <p>{t.common.deleteTaskConfirm}</p>
            <p className="mt-2">{t.common.deleteTaskDescription}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

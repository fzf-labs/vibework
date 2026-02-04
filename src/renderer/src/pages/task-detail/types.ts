import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { useLanguage } from '@/providers/language-provider';
import type { MessageAttachment } from '@/hooks/useAgent';

export type LanguageStrings = ReturnType<typeof useLanguage>['t'];

export type TaskMetaRow = {
  key: string;
  icon: LucideIcon;
  value: ReactNode;
  visible: boolean;
};

export type PipelineDisplayStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

export const filterVisibleMetaRows = (rows: TaskMetaRow[]) =>
  rows.filter((row) => row.visible);

export type LocationState = {
  prompt?: string;
  sessionId?: string;
  attachments?: MessageAttachment[];
};

export type WorkNodeTemplate = {
  id: string;
  workflow_template_id: string;
  node_order: number;
  name: string;
  prompt: string;
  requires_approval: boolean;
  continue_on_error: boolean;
  created_at: string;
  updated_at: string;
};

export type PipelineTemplate = {
  id: string;
  name: string;
  description: string | null;
  scope: 'global' | 'project';
  project_id: string | null;
  created_at: string;
  updated_at: string;
  nodes: WorkNodeTemplate[];
};

export type CLIToolInfo = {
  id: string;
  name?: string;
  displayName?: string;
};

export type PipelineStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'failed'
  | 'completed';

export type ExecutionStatus = 'idle' | 'running' | 'stopped' | 'error';

export type WorkflowNode = {
  id: string;
  work_node_template_id: string;
  template_node_id?: string | null;
  node_order: number;
  status: PipelineDisplayStatus;
  name?: string;
  prompt?: string;
};

export type WorkflowCurrentNode = {
  id: string;
  templateId: string;
  status: PipelineDisplayStatus;
  index: number;
};

export type WorkflowReviewNode = {
  id: string;
  name: string;
  status: PipelineDisplayStatus;
};

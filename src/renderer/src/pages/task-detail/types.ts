import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { useLanguage } from '@/providers/language-provider';

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

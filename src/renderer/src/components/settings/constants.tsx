import type { ComponentType } from 'react';
import {
  Bell,
  Code,
  Database,
  GitBranch,
  Info,
  ListChecks,
  Plug,
  Server,
  Settings,
  Sparkles,
  Terminal,
  User,
  Volume2,
} from 'lucide-react';

import type { SettingsCategory } from './types';

// Category icons mapping
export const categoryIcons: Record<
  SettingsCategory,
  ComponentType<{ className?: string }>
> = {
  account: User,
  general: Settings,
  sound: Volume2,
  notification: Bell,
  editor: Code,
  cli: Terminal,
  git: GitBranch,
  pipelineTemplates: ListChecks,
  mcp: Server,
  skills: Sparkles,
  connector: Plug,
  data: Database,
  about: Info,
};

// Re-export API config
export { API_PORT, API_BASE_URL } from '@/config';

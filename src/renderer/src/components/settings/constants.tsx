import type { ComponentType } from 'react';
import {
  Database,
  Info,
  Plug,
  Server,
  Settings,
  Sparkles,
  User,
} from 'lucide-react';

import type { SettingsCategory } from './types';

// Category icons mapping
export const categoryIcons: Record<
  SettingsCategory,
  ComponentType<{ className?: string }>
> = {
  account: User,
  general: Settings,
  mcp: Server,
  skills: Sparkles,
  connector: Plug,
  data: Database,
  about: Info,
};

// Re-export API config
export { API_PORT, API_BASE_URL } from '@/config';

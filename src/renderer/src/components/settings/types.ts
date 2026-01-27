import type { Settings as SettingsType } from '@/data/settings';

export type { SettingsType };

// Settings category type
export type SettingsCategory =
  | 'account'
  | 'general'
  | 'mcp'
  | 'skills'
  | 'connector'
  | 'data'
  | 'about';

// Common props for settings tabs
export interface SettingsTabProps {
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
}

// MCP Server Config Types
export interface MCPServerStdio {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPServerHttp {
  url: string;
  headers?: Record<string, string>;
}

export type MCPServerConfig = MCPServerStdio | MCPServerHttp;

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

// Internal MCP server representation for UI
export interface MCPServerUI {
  id: string;
  name: string;
  type: 'stdio' | 'http' | 'sse';
  enabled: boolean;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  autoExecute?: boolean;
  source?: 'VibeWork' | 'claude';
}

// Skill types
export interface SkillFile {
  name: string;
  path: string;
  isDir: boolean;
  children?: SkillFile[];
}

export interface SkillInfo {
  id: string;
  name: string;
  description?: string;
  source: 'claude' | 'VibeWork';
  path: string;
  files: SkillFile[];
  enabled: boolean;
}

// Sub-tab types
export type MCPSubTab = 'settings' | string;
export type SkillsSubTab = 'settings' | string;

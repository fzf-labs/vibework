// Settings type definitions

export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  models: string[];
  icon?: string;
  apiKeyUrl?: string;
  canDelete?: boolean;
}

export interface MCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
}

export type SandboxProviderType =
  | 'docker'
  | 'native'
  | 'e2b'
  | 'codex'
  | 'claude'
  | 'custom';

export interface SandboxProviderSetting {
  id: string;
  type: SandboxProviderType;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export type AgentRuntimeType = 'claude' | 'codex' | 'deepagents' | 'custom';

export interface AgentRuntimeSetting {
  id: string;
  type: AgentRuntimeType;
  name: string;
  enabled: boolean;
  config: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    executablePath?: string;
    [key: string]: unknown;
  };
}

export interface UserProfile {
  nickname: string;
}

export type AccentColor =
  | 'orange'
  | 'blue'
  | 'green'
  | 'purple'
  | 'pink'
  | 'red'
  | 'sage';

export type BackgroundStyle = 'default' | 'warm' | 'cool';

export type EditorType =
  | 'vscode'
  | 'cursor'
  | 'antigravity'
  | 'webstorm'
  | 'idea'
  | 'goland'
  | 'xcode'
  | 'custom'
  | 'other';

export interface EditorSettings {
  editorType: EditorType;
  customCommand: string;
}

export type SoundPresetId = 'chime' | 'ding' | 'pulse' | 'silent';

export type SoundChoiceSource = 'preset' | 'file';

export interface SoundChoice {
  source: SoundChoiceSource;
  presetId: SoundPresetId;
  filePath: string;
}

export interface Settings {
  profile: UserProfile;
  providers: AIProvider[];
  defaultProvider: string;
  defaultModel: string;
  taskCompleteSoundEnabled: boolean;
  workNodeCompleteSoundEnabled: boolean;
  taskCompleteNotificationsEnabled: boolean;
  workNodeCompleteNotificationsEnabled: boolean;
  taskCompleteSound: SoundChoice;
  workNodeCompleteSound: SoundChoice;
  mcpConfigPath: string;
  mcpUserDirEnabled: boolean;
  mcpAppDirEnabled: boolean;
  skillsPath: string;
  skillsUserDirEnabled: boolean;
  skillsAppDirEnabled: boolean;
  workDir: string;
  sandboxEnabled: boolean;
  sandboxProviders: SandboxProviderSetting[];
  defaultSandboxProvider: string;
  agentRuntimes: AgentRuntimeSetting[];
  defaultAgentRuntime: string;
  theme: 'light' | 'dark' | 'system';
  accentColor: AccentColor;
  backgroundStyle: BackgroundStyle;
  language: string;
  editor: EditorSettings;
  defaultCliToolId: string;
  gitWorktreeBranchPrefix: string;
  // CLI tool paths
  claudeCodePath: string;
  codexCliPath: string;
}

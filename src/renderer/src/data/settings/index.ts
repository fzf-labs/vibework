// Settings module - unified exports

// Types
export type {
  AIProvider,
  MCPServer,
  SandboxProviderType,
  SandboxProviderSetting,
  AgentRuntimeType,
  AgentRuntimeSetting,
  UserProfile,
  AccentColor,
  BackgroundStyle,
  EditorType,
  EditorSettings,
  Settings,
  SoundChoice,
  SoundPresetId,
} from './types';

// General - core functions, theme
export {
  // Default values
  defaultSandboxProviders,
  defaultAgentRuntimes,
  defaultProviders,
  defaultSettings,
  // Theme
  accentColors,
  backgroundStyles,
  // Core functions
  getSettings,
  getSettingsAsync,
  saveSettings,
  saveSettingItem,
  initializeSettings,
  clearSettingsCache,
  clearAllSettings,
  // Internal functions (used by syncSettingsWithBackend)
  getDefaultAIProvider,
  getDefaultSandboxProvider,
  getDefaultAgentRuntime,
  // Sync
  syncSettingsWithBackend,
} from './general';

// Account
export { updateProfile, getProfile } from './account';

// MCP
export { updateMcpSettings, getMcpSettings } from './mcp';

// Skills
export { updateSkillsSettings, getSkillsSettings } from './skills';

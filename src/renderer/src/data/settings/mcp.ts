// MCP settings - MCP server configuration

import type { Settings } from './types';
import { getSettings, saveSettings } from './general';

export function updateMcpSettings(updates: {
  mcpEnabled?: boolean;
  mcpUserDirEnabled?: boolean;
  mcpAppDirEnabled?: boolean;
  mcpConfigPath?: string;
}): Settings {
  const settings = getSettings();
  if (updates.mcpEnabled !== undefined) settings.mcpEnabled = updates.mcpEnabled;
  if (updates.mcpUserDirEnabled !== undefined) settings.mcpUserDirEnabled = updates.mcpUserDirEnabled;
  if (updates.mcpAppDirEnabled !== undefined) settings.mcpAppDirEnabled = updates.mcpAppDirEnabled;
  if (updates.mcpConfigPath !== undefined) settings.mcpConfigPath = updates.mcpConfigPath;
  saveSettings(settings);
  return settings;
}

export function getMcpSettings() {
  const settings = getSettings();
  return {
    mcpEnabled: settings.mcpEnabled,
    mcpUserDirEnabled: settings.mcpUserDirEnabled,
    mcpAppDirEnabled: settings.mcpAppDirEnabled,
    mcpConfigPath: settings.mcpConfigPath,
  };
}

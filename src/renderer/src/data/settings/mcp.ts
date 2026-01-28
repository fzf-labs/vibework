// MCP settings - MCP server configuration

import type { Settings } from './types';
import { getSettings, saveSettings } from './general';

export function updateMcpSettings(updates: {
  mcpUserDirEnabled?: boolean;
  mcpAppDirEnabled?: boolean;
  mcpConfigPath?: string;
}): Settings {
  const settings = getSettings();
  if (updates.mcpUserDirEnabled !== undefined) settings.mcpUserDirEnabled = updates.mcpUserDirEnabled;
  if (updates.mcpAppDirEnabled !== undefined) settings.mcpAppDirEnabled = updates.mcpAppDirEnabled;
  if (updates.mcpConfigPath !== undefined) settings.mcpConfigPath = updates.mcpConfigPath;
  saveSettings(settings);
  return settings;
}

export function getMcpSettings() {
  const settings = getSettings();
  return {
    mcpUserDirEnabled: settings.mcpUserDirEnabled,
    mcpAppDirEnabled: settings.mcpAppDirEnabled,
    mcpConfigPath: settings.mcpConfigPath,
  };
}

// Skills settings - Skills configuration

import type { Settings } from './types';
import { getSettings, saveSettings } from './general';

export function updateSkillsSettings(updates: {
  skillsEnabled?: boolean;
  skillsUserDirEnabled?: boolean;
  skillsAppDirEnabled?: boolean;
  skillsPath?: string;
}): Settings {
  const settings = getSettings();
  if (updates.skillsEnabled !== undefined) settings.skillsEnabled = updates.skillsEnabled;
  if (updates.skillsUserDirEnabled !== undefined) settings.skillsUserDirEnabled = updates.skillsUserDirEnabled;
  if (updates.skillsAppDirEnabled !== undefined) settings.skillsAppDirEnabled = updates.skillsAppDirEnabled;
  if (updates.skillsPath !== undefined) settings.skillsPath = updates.skillsPath;
  saveSettings(settings);
  return settings;
}

export function getSkillsSettings() {
  const settings = getSettings();
  return {
    skillsEnabled: settings.skillsEnabled,
    skillsUserDirEnabled: settings.skillsUserDirEnabled,
    skillsAppDirEnabled: settings.skillsAppDirEnabled,
    skillsPath: settings.skillsPath,
  };
}

// Skills settings - Skills configuration

import type { Settings } from './types';
import { getSettings, saveSettings } from './general';

export function updateSkillsSettings(updates: {
  skillsUserDirEnabled?: boolean;
  skillsAppDirEnabled?: boolean;
  skillsPath?: string;
}): Settings {
  const settings = getSettings();
  if (updates.skillsUserDirEnabled !== undefined) settings.skillsUserDirEnabled = updates.skillsUserDirEnabled;
  if (updates.skillsAppDirEnabled !== undefined) settings.skillsAppDirEnabled = updates.skillsAppDirEnabled;
  if (updates.skillsPath !== undefined) settings.skillsPath = updates.skillsPath;
  saveSettings(settings);
  return settings;
}

export function getSkillsSettings() {
  const settings = getSettings();
  return {
    skillsUserDirEnabled: settings.skillsUserDirEnabled,
    skillsAppDirEnabled: settings.skillsAppDirEnabled,
    skillsPath: settings.skillsPath,
  };
}

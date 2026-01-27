// Account settings - user profile management

import type { UserProfile, Settings } from './types';
import { getSettings, saveSettings } from './general';

export function updateProfile(updates: Partial<UserProfile>): Settings {
  const settings = getSettings();
  settings.profile = { ...settings.profile, ...updates };
  saveSettings(settings);
  return settings;
}

export function getProfile(): UserProfile {
  const settings = getSettings();
  return settings.profile;
}

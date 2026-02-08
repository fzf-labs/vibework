// General settings - theme, language, AI providers, sandbox, agent runtime

import { API_BASE_URL } from '@/config';
import {
  getDataRootDir,
  getMcpConfigPath,
  getSkillsDir,
  getWorktreesDir,
} from '../../lib/paths';
import type {
  Settings,
  AIProvider,
  SandboxProviderSetting,
  AgentRuntimeSetting,
  AccentColor,
  BackgroundStyle,
  SoundChoice,
  SoundPresetId,
} from './types';
import {
  DEFAULT_TASK_COMPLETE_SOUND,
  DEFAULT_TASK_NODE_COMPLETE_SOUND,
} from './sounds';

// ============ Default Values ============

export const defaultSandboxProviders: SandboxProviderSetting[] = [
  {
    id: 'codex',
    type: 'codex',
    name: 'Codex Sandbox',
    enabled: true,
    config: { defaultTimeout: 120000 },
  },
  {
    id: 'native',
    type: 'native',
    name: 'Native (No Isolation)',
    enabled: true,
    config: { shell: '/bin/bash', defaultTimeout: 120000 },
  },
];

export const defaultAgentRuntimes: AgentRuntimeSetting[] = [
  {
    id: 'claude',
    type: 'claude',
    name: 'Claude Code',
    enabled: true,
    config: { model: 'claude-sonnet-4-20250514' },
  },
  {
    id: 'codex',
    type: 'codex',
    name: 'OpenAI Codex CLI',
    enabled: false,
    config: { model: 'codex' },
  },
];

export const defaultProviders: AIProvider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api',
    enabled: true,
    models: ['anthropic/claude-sonnet-4.5', 'anthropic/claude-opus-4.5'],
    icon: 'O',
    apiKeyUrl: 'https://openrouter.ai/keys',
    canDelete: true,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    apiKey: '',
    baseUrl: 'https://api.minimax.io/anthropic',
    enabled: true,
    models: ['MiniMax-M2.1'],
    icon: 'M',
    apiKeyUrl: 'https://platform.minimax.io/subscribe/coding-plan?code=9hgHKlPO3G&source=link',
    canDelete: true,
  },
  {
    id: 'zai',
    name: 'Z.ai',
    apiKey: '',
    baseUrl: 'https://api.z.ai/api/anthropic',
    enabled: true,
    models: ['glm-4.7'],
    icon: 'Z',
    apiKeyUrl: 'https://z.ai/subscribe?ic=7YS469UOXD',
    canDelete: true,
  },
  {
    id: 'volcengine',
    name: 'Volcengine',
    apiKey: '',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
    enabled: true,
    models: ['ark-code-latest'],
    icon: 'V',
    apiKeyUrl: 'https://volcengine.com/L/Sq5rSgyFu_E',
    canDelete: true,
  },
  {
    id: '302ai',
    name: '302.AI',
    apiKey: '',
    baseUrl: 'https://api.302.ai/cc',
    enabled: true,
    models: ['claude-sonnet-4-5-20250929'],
    icon: '3',
    apiKeyUrl: 'https://302.ai/?utm_source=VibeWork_desktop',
    canDelete: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    enabled: true,
    models: ['glm-4.7-flash'],
    icon: 'O',
    apiKeyUrl: 'https://docs.ollama.com/integrations/claude-code',
    canDelete: true,
  },
];

export const defaultSettings: Settings = {
  profile: { nickname: 'Vibe User' },
  providers: defaultProviders,
  defaultProvider: 'default',
  defaultModel: '',
  taskCompleteSoundEnabled: false,
  taskNodeCompleteSoundEnabled: false,
  taskCompleteNotificationsEnabled: false,
  taskNodeCompleteNotificationsEnabled: false,
  taskCompleteSound: DEFAULT_TASK_COMPLETE_SOUND,
  taskNodeCompleteSound: DEFAULT_TASK_NODE_COMPLETE_SOUND,
  mcpConfigPath: '',
  mcpUserDirEnabled: true,
  mcpAppDirEnabled: true,
  skillsPath: '',
  skillsUserDirEnabled: true,
  skillsAppDirEnabled: true,
  workDir: '',
  sandboxEnabled: true,
  sandboxProviders: defaultSandboxProviders,
  defaultSandboxProvider: 'codex',
  agentRuntimes: defaultAgentRuntimes,
  defaultAgentRuntime: 'claude',
  theme: 'system',
  accentColor: 'orange',
  backgroundStyle: 'default',
  language: '',
  editor: {
    editorType: 'vscode',
    customCommand: '',
  },
  defaultCliToolId: '',
  gitWorktreeBranchPrefix: 'VW-',
  gitWorktreeDir: '~/.vibework/worktrees',
  claudeCodePath: '',
  codexCliPath: '',
};

// ============ Theme Constants ============

export const accentColors: {
  id: AccentColor;
  name: string;
  color: string;
  darkColor: string;
}[] = [
  { id: 'orange', name: 'Orange', color: 'oklch(0.6716 0.1368 48.513)', darkColor: 'oklch(0.7214 0.1337 49.9802)' },
  { id: 'blue', name: 'Blue', color: 'oklch(0.5469 0.1914 262.881)', darkColor: 'oklch(0.6232 0.1914 262.881)' },
  { id: 'green', name: 'Green', color: 'oklch(0.5966 0.1397 149.214)', darkColor: 'oklch(0.6489 0.1397 149.214)' },
  { id: 'purple', name: 'Purple', color: 'oklch(0.5412 0.1879 293.541)', darkColor: 'oklch(0.6135 0.1879 293.541)' },
  { id: 'pink', name: 'Pink', color: 'oklch(0.6171 0.1762 349.761)', darkColor: 'oklch(0.6894 0.1762 349.761)' },
  { id: 'red', name: 'Red', color: 'oklch(0.5772 0.2077 27.325)', darkColor: 'oklch(0.6495 0.2077 27.325)' },
  { id: 'sage', name: 'Sage', color: 'oklch(0.4531 0.0891 152.535)', darkColor: 'oklch(0.5654 0.1091 152.535)' },
];

export const backgroundStyles: {
  id: BackgroundStyle;
  name: string;
  description: string;
}[] = [
  { id: 'default', name: 'Default', description: 'Clean neutral background' },
  { id: 'warm', name: 'Warm', description: 'Cozy cream and beige tones' },
  { id: 'cool', name: 'Cool', description: 'Crisp blue-gray tones' },
];

// ============ Settings Cache ============

let settingsCache: Settings | null = null;

const SOUND_PRESET_IDS = new Set<SoundPresetId>([
  'chime',
  'ding',
  'pulse',
  'silent',
]);

const normalizeSoundChoice = (value: unknown, fallback: SoundChoice): SoundChoice => {
  if (!value) {
    return { ...fallback };
  }

  if (typeof value === 'string') {
    if (SOUND_PRESET_IDS.has(value as SoundPresetId)) {
      return { ...fallback };
    }
    return { source: 'file', presetId: fallback.presetId, filePath: value };
  }

  if (typeof value === 'object') {
    const record = value as {
      source?: string;
      presetId?: string;
      filePath?: string;
    };
    const presetId = SOUND_PRESET_IDS.has(record.presetId as SoundPresetId)
      ? (record.presetId as SoundPresetId)
      : fallback.presetId;
    const source = record.source === 'file' ? 'file' : 'preset';
    const filePath = typeof record.filePath === 'string' ? record.filePath : '';

    if (source === 'file' && filePath) {
      return { source: 'file', presetId, filePath };
    }

    return { ...fallback };
  }

  return { ...fallback };
};

// ============ Core Functions ============

const loadGeneralSettingsFromMain = async (): Promise<Partial<Settings>> => {
  const isElectron = typeof window !== 'undefined' && 'api' in window;
  if (!isElectron || !window.api.settings) {
    return {};
  }

  try {
    const appSettings = await window.api.settings.get();
    return {
      theme: appSettings.theme,
      accentColor: appSettings.accentColor as AccentColor,
      backgroundStyle: appSettings.backgroundStyle as BackgroundStyle,
      language: appSettings.language,
    };
  } catch (error) {
    console.error('[Settings] Failed to load from main process:', error);
    return {};
  }
};

const normalizeLoadedSettings = (value: unknown): Settings => {
  const loadedSettings = {
    ...defaultSettings,
    ...(value as Partial<Settings>),
  } as Settings & {
    mcpEnabled?: boolean;
    profile?: { avatar?: string };
    providers?: unknown;
  };

  if ('mcpEnabled' in loadedSettings) {
    delete loadedSettings.mcpEnabled;
  }

  if (!loadedSettings.profile || typeof loadedSettings.profile !== 'object') {
    loadedSettings.profile = { ...defaultSettings.profile };
  } else {
    delete loadedSettings.profile.avatar;
  }

  if (!loadedSettings.gitWorktreeBranchPrefix?.trim()) {
    loadedSettings.gitWorktreeBranchPrefix = defaultSettings.gitWorktreeBranchPrefix;
  }

  if (!loadedSettings.gitWorktreeDir?.trim()) {
    loadedSettings.gitWorktreeDir = defaultSettings.gitWorktreeDir;
  }

  if (typeof loadedSettings.taskCompleteNotificationsEnabled !== 'boolean') {
    loadedSettings.taskCompleteNotificationsEnabled = defaultSettings.taskCompleteNotificationsEnabled;
  }

  if (typeof loadedSettings.taskNodeCompleteNotificationsEnabled !== 'boolean') {
    loadedSettings.taskNodeCompleteNotificationsEnabled =
      defaultSettings.taskNodeCompleteNotificationsEnabled;
  }

  if (typeof loadedSettings.taskCompleteSoundEnabled !== 'boolean') {
    loadedSettings.taskCompleteSoundEnabled = defaultSettings.taskCompleteSoundEnabled;
  }

  if (typeof loadedSettings.taskNodeCompleteSoundEnabled !== 'boolean') {
    loadedSettings.taskNodeCompleteSoundEnabled = defaultSettings.taskNodeCompleteSoundEnabled;
  }

  loadedSettings.taskCompleteSound = normalizeSoundChoice(
    loadedSettings.taskCompleteSound,
    defaultSettings.taskCompleteSound
  );

  loadedSettings.taskNodeCompleteSound = normalizeSoundChoice(
    loadedSettings.taskNodeCompleteSound,
    defaultSettings.taskNodeCompleteSound
  );

  if (!Array.isArray(loadedSettings.providers)) {
    loadedSettings.providers = [...defaultProviders];
  }

  for (const defaultProvider of defaultProviders) {
    if (!loadedSettings.providers.find((provider: { id: string }) => provider.id === defaultProvider.id)) {
      loadedSettings.providers.push(defaultProvider);
    }
  }

  return loadedSettings;
};

const loadSettingsFromStorage = (): Settings | null => {
  try {
    const stored = localStorage.getItem('VibeWork_settings');
    if (!stored) return null;
    return normalizeLoadedSettings(JSON.parse(stored));
  } catch (error) {
    console.error('[Settings] Failed to load from localStorage:', error);
    return null;
  }
};

export async function getSettingsAsync(): Promise<Settings> {
  if (settingsCache) return settingsCache;

  const [storedSettings, generalSettings] = await Promise.all([
    Promise.resolve(loadSettingsFromStorage()),
    loadGeneralSettingsFromMain(),
  ]);

  settingsCache = {
    ...(storedSettings ?? defaultSettings),
    ...generalSettings,
  };

  return settingsCache;
}

export function getSettings(): Settings {
  if (settingsCache) return settingsCache;

  settingsCache = loadSettingsFromStorage() ?? defaultSettings;
  return settingsCache;
}

export function saveSettings(settings: Settings): void {
  settingsCache = settings;

  const isElectron = typeof window !== 'undefined' && 'api' in window;
  if (isElectron && window.api.settings) {
    window.api.settings.update({
      theme: settings.theme,
      accentColor: settings.accentColor,
      backgroundStyle: settings.backgroundStyle,
      language: settings.language,
    }).catch((error) => {
      console.error('[Settings] Failed to sync to main process:', error);
    });
  }

  if (isElectron && window.api.notification) {
    const notificationsEnabled =
      settings.taskCompleteNotificationsEnabled ||
      settings.taskNodeCompleteNotificationsEnabled;
    window.api.notification.setEnabled(notificationsEnabled).catch((error) => {
      console.error('[Settings] Failed to sync notification state:', error);
    });
    const soundEnabled =
      settings.taskCompleteSoundEnabled || settings.taskNodeCompleteSoundEnabled;
    window.api.notification.setSoundEnabled(soundEnabled).catch((error) => {
      console.error('[Settings] Failed to sync sound alert state:', error);
    });
  }

  try {
    const sanitized = {
      ...settings,
      profile: { ...settings.profile },
    } as Settings & { mcpEnabled?: boolean };
    if ('mcpEnabled' in sanitized) delete sanitized.mcpEnabled;
    delete (sanitized.profile as { avatar?: string }).avatar;
    localStorage.setItem('VibeWork_settings', JSON.stringify(sanitized));
  } catch (error) {
    console.error('[Settings] Failed to save to localStorage:', error);
  }
}

export async function saveSettingItem(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(`VibeWork_${key}`, value);
  } catch (error) {
    console.error(`[Settings] Failed to save ${key}:`, error);
  }
}

export async function initializeSettings(): Promise<Settings> {
  const [dataRootDir, mcpConfigPath, skillsDir, worktreesDir] = await Promise.all([
    getDataRootDir(),
    getMcpConfigPath(),
    getSkillsDir(),
    getWorktreesDir(),
  ]);

  const settings = await getSettingsAsync();

  if (!settings.workDir) settings.workDir = dataRootDir;
  if (!settings.mcpConfigPath) {
    settings.mcpConfigPath = mcpConfigPath;
  }
  if (!settings.skillsPath) {
    settings.skillsPath = skillsDir;
  }
  if (!settings.gitWorktreeDir) {
    settings.gitWorktreeDir = worktreesDir;
  }
  if (settings.defaultSandboxProvider && settings.sandboxEnabled !== true) {
    settings.sandboxEnabled = true;
  }

  settingsCache = settings;
  saveSettings(settings);
  return settings;
}

export function clearSettingsCache(): void {
  settingsCache = null;
}

export function clearAllSettings(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('VibeWork')) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('[Settings] Failed to clear localStorage:', error);
  }
  settingsCache = null;
}

// ============ AI Provider Functions ============

export function getDefaultAIProvider(): AIProvider | undefined {
  const settings = getSettings();
  return settings.providers.find((p) => p.id === settings.defaultProvider);
}

// ============ Sandbox Functions ============

export function getDefaultSandboxProvider(): SandboxProviderSetting | undefined {
  const settings = getSettings();
  return settings.sandboxProviders.find((p) => p.id === settings.defaultSandboxProvider);
}

// ============ Agent Runtime Functions ============

export function getDefaultAgentRuntime(): AgentRuntimeSetting | undefined {
  const settings = getSettings();
  return settings.agentRuntimes.find((r) => r.id === settings.defaultAgentRuntime);
}

// ============ Sync with Backend ============

export async function syncSettingsWithBackend(): Promise<void> {
  const settings = getSettings();
  const aiProvider = getDefaultAIProvider();
  const agentConfig: Record<string, unknown> = {
    ...getDefaultAgentRuntime()?.config,
  };

  if (settings.defaultProvider !== 'default' && aiProvider) {
    if (aiProvider.apiKey) agentConfig.apiKey = aiProvider.apiKey;
    if (aiProvider.baseUrl) agentConfig.baseUrl = aiProvider.baseUrl;
    if (settings.defaultModel) agentConfig.model = settings.defaultModel;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/providers/settings/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sandboxProvider: settings.defaultSandboxProvider,
        sandboxConfig: getDefaultSandboxProvider()?.config,
        agentProvider: settings.defaultAgentRuntime,
        agentConfig,
        defaultProvider: settings.defaultProvider,
        defaultModel: settings.defaultModel,
      }),
    });

    if (!response.ok) {
      console.error('[Settings] Failed to sync with backend:', response.statusText);
    }
  } catch (error) {
    console.warn('[Settings] Could not sync with backend:', error);
  }
}

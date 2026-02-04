// Agent configuration helpers

import { API_BASE_URL } from '@/config';
import { translations, type Language } from '@/config/locale';
import { getCurrentProjectId } from '@/data/projects';
import { getSettings } from '@/data/settings';
import {
  DEFAULT_PROJECT_SKILLS_SETTINGS,
  resolveProjectSkillDirectories,
} from '@/lib/skills';

export const AGENT_SERVER_URL = API_BASE_URL;

// Helper to get current language translations
export function getErrorMessages() {
  const settings = getSettings();
  const lang = (settings.language || 'zh-CN') as Language;
  return (
    translations[lang]?.common?.errors || translations['zh-CN'].common.errors
  );
}

// Helper to get model configuration from settings
export function getModelConfig():
  | { apiKey?: string; baseUrl?: string; model?: string }
  | undefined {
  try {
    const settings = getSettings();

    console.log('[useAgent] getModelConfig called:', {
      defaultProvider: settings.defaultProvider,
      defaultModel: settings.defaultModel,
      providersCount: settings.providers.length,
    });

    // Check if settings appear to be default (not loaded from storage)
    if (
      settings.defaultProvider === 'default' &&
      settings.providers.length === 2 &&
      settings.providers.every((p) => !p.apiKey)
    ) {
      console.warn(
        '[useAgent] WARNING: Settings appear to be defaults. ' +
          'If you configured a custom API provider, it may not have been loaded correctly. ' +
          'Check browser console for [Settings] logs to diagnose the issue.'
      );
    }

    // If using "default" provider, return undefined to use environment variables
    if (settings.defaultProvider === 'default') {
      console.log('[useAgent] Using default provider (environment variables)');
      return undefined;
    }

    const provider = settings.providers.find(
      (p) => p.id === settings.defaultProvider
    );

    console.log(
      '[useAgent] Found provider:',
      provider
        ? {
            id: provider.id,
            name: provider.name,
            hasApiKey: !!provider.apiKey,
            hasBaseUrl: !!provider.baseUrl,
          }
        : 'NOT FOUND'
    );

    if (!provider) return undefined;

    // Only return config if we have custom settings
    const config: { apiKey?: string; baseUrl?: string; model?: string } = {};

    if (provider.apiKey) {
      config.apiKey = provider.apiKey;
    }
    if (provider.baseUrl) {
      config.baseUrl = provider.baseUrl;
    }
    if (settings.defaultModel) {
      config.model = settings.defaultModel;
    }

    // Return undefined if no custom config
    if (!config.apiKey && !config.baseUrl && !config.model) {
      console.log('[useAgent] No custom config found, returning undefined');
      return undefined;
    }

    console.log('[useAgent] Returning modelConfig:', {
      hasApiKey: !!config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    });

    return config;
  } catch (error) {
    console.error('[useAgent] getModelConfig error:', error);
    return undefined;
  }
}

// Helper to get sandbox configuration from settings
export function getSandboxConfig():
  | { enabled: boolean; provider?: string; apiEndpoint?: string }
  | undefined {
  try {
    const settings = getSettings();

    console.log('[useAgent] getSandboxConfig - Full settings check:', {
      sandboxEnabled: settings.sandboxEnabled,
      sandboxEnabledType: typeof settings.sandboxEnabled,
      defaultSandboxProvider: settings.defaultSandboxProvider,
      hasSettings: !!settings,
      settingsKeys: Object.keys(settings),
    });

    // Only return if sandbox is enabled
    if (!settings.sandboxEnabled) {
      console.warn(
        '[useAgent] ⚠️ Sandbox is DISABLED in settings - sandboxEnabled:',
        settings.sandboxEnabled
      );
      return undefined;
    }

    const config = {
      enabled: true,
      provider: settings.defaultSandboxProvider,
      apiEndpoint: AGENT_SERVER_URL,
    };

    console.log('[useAgent] ✅ Sandbox ENABLED, returning config:', config);
    return config;
  } catch (error) {
    console.error('[useAgent] ❌ Error getting sandbox config:', error);
    return undefined;
  }
}

// Helper to get skills configuration from settings
export async function getSkillsConfig(): Promise<
  | {
      enabled: boolean;
      userDirEnabled: boolean;
      appDirEnabled: boolean;
      skillsPath?: string;
      projectSkills?: {
        enabled: boolean;
        paths: string[];
      };
    }
  | undefined
> {
  try {
    const settings = getSettings();

    const config = {
      enabled: true,
      userDirEnabled: settings.skillsUserDirEnabled !== false,
      appDirEnabled: settings.skillsAppDirEnabled !== false,
      skillsPath: settings.skillsPath || undefined,
    };

    const projectId = getCurrentProjectId?.();
    if (!projectId || !window.api?.projects?.get) {
      console.log('[useAgent] Skills config:', config);
      return config;
    }

    try {
      const [project, cliTools] = await Promise.all([
        window.api.projects.get(projectId) as Promise<{ id?: string; path?: string } | undefined>,
        window.api?.cliTools?.getAll?.() as Promise<Array<{ id: string; displayName?: string }> | undefined>,
      ]);

      if (project?.path) {
        const directories = await resolveProjectSkillDirectories(
          project.path,
          DEFAULT_PROJECT_SKILLS_SETTINGS,
          cliTools ?? []
        );

        const projectSkills = {
          enabled: true,
          paths: directories.map((dir) => dir.path),
        };

        const enrichedConfig = {
          ...config,
          projectSkills,
        };

        console.log('[useAgent] Skills config:', enrichedConfig);
        return enrichedConfig;
      }
    } catch (error) {
      console.error('[useAgent] Failed to load project skills directories:', error);
    }

    console.log('[useAgent] Skills config:', config);
    return config;
  } catch {
    return undefined;
  }
}

// Helper to get MCP configuration from settings
export function getMcpConfig(options?: {
  projectConfigPath?: string;
  mergeStrategy?: 'project_over_global';
}): {
  userDirEnabled: boolean;
  appDirEnabled: boolean;
  mcpConfigPath?: string;
  projectConfigPath?: string;
  mergeStrategy?: 'project_over_global';
} | undefined {
  try {
    const settings = getSettings();

    const config = {
      userDirEnabled: settings.mcpUserDirEnabled !== false,
      appDirEnabled: settings.mcpAppDirEnabled !== false,
      mcpConfigPath: settings.mcpConfigPath || undefined,
      projectConfigPath: options?.projectConfigPath,
      mergeStrategy: options?.mergeStrategy,
    };

    console.log('[useAgent] MCP config:', config);
    return config;
  } catch {
    return undefined;
  }
}

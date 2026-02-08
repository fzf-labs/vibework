import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/providers/language-provider';
import { Terminal, Check, AlertCircle, Plus, Pencil, Star, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { newUlid } from '@/lib/ids';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { db } from '@/data';
import type { AgentToolConfig } from '@/data';
import type { SettingsTabProps } from '../types';

const TOOL_CACHE = {
  tools: null as CLIToolInfo[] | null,
};

interface CLIToolInfo {
  id: string;
  name: string;
  displayName: string;
  installed: boolean;
  version?: string;
  installPath?: string;
}

type ConfigFieldType =
  | 'string'
  | 'stringArray'
  | 'stringMap'
  | 'boolean'
  | 'booleanNullable';

type ConfigFieldOption = {
  value: string;
  label: string;
};

type ConfigFieldSchema = {
  type: ConfigFieldType;
  required?: boolean;
  defaultValue?: unknown;
  multiline?: boolean;
  options?: ConfigFieldOption[];
  description?: string;
};

const CODEX_SANDBOX_OPTIONS: ConfigFieldOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'read-only', label: 'Read Only' },
  { value: 'workspace-write', label: 'Workspace Write' },
  { value: 'danger-full-access', label: 'Danger Full Access' },
];

const CODEX_APPROVAL_OPTIONS: ConfigFieldOption[] = [
  { value: 'unless-trusted', label: 'Unless Trusted' },
  { value: 'on-failure', label: 'On Failure' },
  { value: 'on-request', label: 'On Request' },
  { value: 'never', label: 'Never' },
];

const CODEX_REASONING_EFFORT_OPTIONS: ConfigFieldOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
];

const CODEX_REASONING_SUMMARY_OPTIONS: ConfigFieldOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'none', label: 'None' },
];

const CODEX_REASONING_SUMMARY_FORMAT_OPTIONS: ConfigFieldOption[] = [
  { value: 'none', label: 'None' },
  { value: 'experimental', label: 'Experimental' },
];

const TOOL_CONFIG_SCHEMAS: Record<string, Record<string, ConfigFieldSchema>> = {
  'claude-code': {
    append_prompt: { type: 'string', multiline: true },
    claude_code_router: { type: 'booleanNullable' },
    plan: { type: 'booleanNullable' },
    approvals: { type: 'booleanNullable' },
    model: { type: 'string' },
    dangerously_skip_permissions: { type: 'booleanNullable' },
    disable_api_key: { type: 'booleanNullable' },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
  codex: {
    append_prompt: { type: 'string', multiline: true },
    sandbox: { type: 'string', options: CODEX_SANDBOX_OPTIONS },
    ask_for_approval: { type: 'string', options: CODEX_APPROVAL_OPTIONS },
    oss: { type: 'booleanNullable' },
    model: { type: 'string' },
    model_reasoning_effort: { type: 'string', options: CODEX_REASONING_EFFORT_OPTIONS },
    model_reasoning_summary: { type: 'string', options: CODEX_REASONING_SUMMARY_OPTIONS },
    model_reasoning_summary_format: {
      type: 'string',
      options: CODEX_REASONING_SUMMARY_FORMAT_OPTIONS,
    },
    profile: { type: 'string' },
    base_instructions: { type: 'string', multiline: true },
    include_apply_patch_tool: { type: 'booleanNullable' },
    model_provider: { type: 'string' },
    compact_prompt: { type: 'string', multiline: true },
    developer_instructions: { type: 'string', multiline: true },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
  'cursor-agent': {
    append_prompt: { type: 'string', multiline: true },
    api_key: { type: 'string' },
    force: { type: 'booleanNullable' },
    model: { type: 'string', defaultValue: 'auto' },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
  'gemini-cli': {
    append_prompt: { type: 'string', multiline: true },
    model: { type: 'string' },
    yolo: { type: 'booleanNullable' },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
  opencode: {
    append_prompt: { type: 'string', multiline: true },
    model: { type: 'string' },
    variant: { type: 'string' },
    agent: { type: 'string' },
    auto_approve: { type: 'boolean', defaultValue: true },
    auto_compact: { type: 'boolean', defaultValue: true },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
};

const ADVANCED_FIELDS_BY_TOOL: Record<string, Set<string>> = {
  'claude-code': new Set([
    'claude_code_router',
    'approvals',
    'dangerously_skip_permissions',
    'disable_api_key',
    'base_command_override',
    'additional_params',
    'env',
  ]),
  codex: new Set([
    'model_reasoning_effort',
    'model_reasoning_summary',
    'model_reasoning_summary_format',
    'base_instructions',
    'include_apply_patch_tool',
    'model_provider',
    'compact_prompt',
    'developer_instructions',
    'base_command_override',
    'additional_params',
    'env',
  ]),
  'cursor-agent': new Set(['base_command_override', 'additional_params', 'env']),
  'gemini-cli': new Set(['base_command_override', 'additional_params', 'env']),
  opencode: new Set(['variant', 'auto_compact', 'base_command_override', 'additional_params', 'env']),
};

const sanitizeStringMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, item]) => {
      if (typeof item === 'string') {
        acc[key] = item;
      }
      return acc;
    },
    {}
  );
};

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
};

const formatFieldLabel = (key: string): string =>
  key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const parseStringArrayInput = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const toStringArrayInput = (value: unknown): string =>
  sanitizeStringArray(value).join('\n');

const parseStringMapInput = (value: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const rawLine of value.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator === -1) {
      result[line] = '';
      continue;
    }

    const key = line.slice(0, separator).trim();
    if (!key) {
      continue;
    }
    result[key] = line.slice(separator + 1);
  }
  return result;
};

const toStringMapInput = (value: unknown): string =>
  Object.entries(sanitizeStringMap(value))
    .map(([key, item]) => `${key}=${item}`)
    .join('\n');

const sanitizeFieldByType = (
  type: ConfigFieldType,
  value: unknown,
  defaultValue?: unknown
): unknown => {
  switch (type) {
    case 'string':
      return typeof value === 'string' ? value : typeof defaultValue === 'string' ? defaultValue : '';
    case 'stringArray':
      return sanitizeStringArray(value);
    case 'stringMap':
      return sanitizeStringMap(value);
    case 'boolean': {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof defaultValue === 'boolean') {
        return defaultValue;
      }
      return false;
    }
    case 'booleanNullable':
      return typeof value === 'boolean' ? value : null;
    default:
      return value;
  }
};

const createConfigTemplate = (toolId: string): Record<string, unknown> => {
  const schema = TOOL_CONFIG_SCHEMAS[toolId];
  if (!schema) {
    return {};
  }

  return Object.entries(schema).reduce<Record<string, unknown>>(
    (acc, [key, field]) => {
      acc[key] = sanitizeFieldByType(field.type, undefined, field.defaultValue);
      return acc;
    },
    {}
  );
};

const sanitizeConfigBySchema = (
  toolId: string,
  parsed: Record<string, unknown>
): Record<string, unknown> => {
  const schema = TOOL_CONFIG_SCHEMAS[toolId];
  if (!schema) {
    return parsed;
  }

  return Object.entries(schema).reduce<Record<string, unknown>>(
    (acc, [key, field]) => {
      const rawValue = parsed[key];
      acc[key] = sanitizeFieldByType(field.type, rawValue, field.defaultValue);
      return acc;
    },
    {}
  );
};

export function CLISettings({
  settings,
  onSettingsChange,
}: SettingsTabProps) {
  const { t } = useLanguage();
  const [tools, setTools] = useState<CLIToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [defaultCliToolId, setDefaultCliToolId] = useState(
    settings.defaultCliToolId || ''
  );

  const [configToolId, setConfigToolId] = useState('');
  const [configs, setConfigs] = useState<AgentToolConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configsError, setConfigsError] = useState<string | null>(null);

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configDialogMode, setConfigDialogMode] = useState<'create' | 'edit'>('create');
  const [configDraftId, setConfigDraftId] = useState<string | null>(null);
  const [configDraftName, setConfigDraftName] = useState('');
  const [configDraftDescription, setConfigDraftDescription] = useState('');
  const [configDraftConfig, setConfigDraftConfig] = useState<Record<string, unknown>>({});
  const [configDraftDefault, setConfigDraftDefault] = useState(false);
  const [configDraftError, setConfigDraftError] = useState<string | null>(null);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  const loadTools = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    if (!force && TOOL_CACHE.tools) {
      setTools(TOOL_CACHE.tools);
      setLoading(false);
      return;
    }

    try {
      const result = await window.api?.cliTools?.detectAll?.();
      if (Array.isArray(result)) {
        const detectedTools = result as CLIToolInfo[];
        TOOL_CACHE.tools = detectedTools;
        setTools(detectedTools);
      } else {
        TOOL_CACHE.tools = [];
        setTools([]);
      }
    } catch (err) {
      console.error('Failed to detect CLI tools:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  useEffect(() => {
    setDefaultCliToolId(settings.defaultCliToolId || '');
  }, [settings.defaultCliToolId]);

  useEffect(() => {
    if (!configToolId && tools.length > 0) {
      const fallback = settings.defaultCliToolId || tools[0]?.id || '';
      if (fallback) setConfigToolId(fallback);
    }
  }, [configToolId, settings.defaultCliToolId, tools]);

  const handleDefaultChange = (value: string) => {
    setDefaultCliToolId(value);
    onSettingsChange({ ...settings, defaultCliToolId: value });
  };

  const loadConfigs = useCallback(async (toolId?: string) => {
    if (!toolId) {
      setConfigs([]);
      return;
    }
    setConfigsLoading(true);
    setConfigsError(null);
    try {
      const result = await db.listAgentToolConfigs(toolId);
      setConfigs(Array.isArray(result) ? (result as AgentToolConfig[]) : []);
    } catch (err) {
      console.error('Failed to load agent tool configs:', err);
      setConfigsError(t.settings?.cliConfigLoadError || 'Failed to load configs.');
      setConfigs([]);
    } finally {
      setConfigsLoading(false);
    }
  }, [t.settings?.cliConfigLoadError]);

  useEffect(() => {
    void loadConfigs(configToolId);
  }, [configToolId, loadConfigs]);

  const normalizeSeedConfig = useCallback((toolId: string, base: Record<string, unknown>) => {
    const schema = TOOL_CONFIG_SCHEMAS[toolId];
    const seed = createConfigTemplate(toolId);
    if (!schema) {
      return seed;
    }

    return Object.entries(schema).reduce<Record<string, unknown>>(
      (acc, [key, field]) => {
        const rawValue =
          key === 'model' &&
          (base[key] === undefined || base[key] === null || base[key] === '') &&
          typeof base.defaultModel === 'string' &&
          base.defaultModel.trim()
            ? base.defaultModel
            : key === 'base_command_override' &&
                (base[key] === undefined || base[key] === null || base[key] === '') &&
                typeof base.executablePath === 'string' &&
                base.executablePath.trim()
              ? base.executablePath
              : base[key];

        acc[key] = sanitizeFieldByType(field.type, rawValue, field.defaultValue);
        return acc;
      },
      seed
    );
  }, []);

  const openCreateConfig = useCallback(async () => {
    if (!configToolId) return;
    setConfigDialogMode('create');
    setConfigDraftId(null);
    setConfigDraftName('DEFAULT');
    setConfigDraftDescription('');
    setConfigDraftDefault(true);
    setConfigDraftError(null);
    setIsApiKeyVisible(false);

    try {
      const baseConfig = await window.api?.cliToolConfig?.get?.(configToolId);
      const seed = normalizeSeedConfig(configToolId, (baseConfig || {}) as Record<string, unknown>);
      setConfigDraftConfig(seed);
    } catch {
      setConfigDraftConfig(createConfigTemplate(configToolId));
    }

    setConfigDialogOpen(true);
  }, [configToolId, normalizeSeedConfig]);

  const sanitizeConfigDraft = useCallback((toolId: string, parsed: Record<string, unknown>) => {
    return sanitizeConfigBySchema(toolId, parsed);
  }, []);

  const openEditConfig = useCallback((config: AgentToolConfig) => {
    setConfigDialogMode('edit');
    setConfigDraftId(config.id);
    setConfigDraftName(config.name || '');
    setConfigDraftDescription(config.description || '');
    setConfigDraftDefault(Boolean(config.is_default));
    setConfigDraftError(null);
    setIsApiKeyVisible(false);
    if (config.config_json) {
      try {
        const parsed = JSON.parse(config.config_json);
        const normalized = sanitizeConfigDraft(
          config.tool_id || configToolId,
          parsed as Record<string, unknown>
        );
        setConfigDraftConfig(normalized);
      } catch {
        setConfigDraftConfig(createConfigTemplate(config.tool_id || configToolId));
      }
    } else {
      setConfigDraftConfig(createConfigTemplate(config.tool_id || configToolId));
    }
    setConfigDialogOpen(true);
  }, [configToolId, sanitizeConfigDraft]);

  const validateConfig = useCallback((toolId: string, parsed: Record<string, unknown>) => {
    const schema = TOOL_CONFIG_SCHEMAS[toolId];
    if (!schema) {
      return null;
    }

    for (const [key, field] of Object.entries(schema)) {
      if (!field.required) {
        continue;
      }

      const value = parsed[key];
      if (field.type === 'string' && (typeof value !== 'string' || !value.trim())) {
        return `${t.settings?.cliConfigRequiredField || 'Missing required field.'} ${key}`;
      }
    }

    return null;
  }, [t.settings?.cliConfigRequiredField]);

  const saveConfigDraft = useCallback(async () => {
    if (!configToolId) return;

    const normalized = sanitizeConfigDraft(configToolId, configDraftConfig);
    const formatted = JSON.stringify(normalized, null, 2);
    const validationError = validateConfig(configToolId, normalized);
    if (validationError) {
      setConfigDraftError(validationError);
      return;
    }

    setConfigDraftError(null);
    setConfigDraftConfig(normalized);
    try {
      if (configDialogMode === 'create') {
        const created = await db.createAgentToolConfig({
          id: newUlid(),
          tool_id: configToolId,
          name: configDraftName.trim() || 'DEFAULT',
          description: configDraftDescription.trim() || null,
          config_json: formatted,
          is_default: 0,
        });
        if (configDraftDefault && (created as AgentToolConfig)?.id) {
          await db.setDefaultAgentToolConfig((created as AgentToolConfig).id);
        }
      } else if (configDraftId) {
        const updates: Record<string, unknown> = {
          name: configDraftName.trim() || 'DEFAULT',
          description: configDraftDescription.trim() || null,
          config_json: formatted,
        };
        if (!configDraftDefault) {
          updates.is_default = 0;
        }
        await db.updateAgentToolConfig(configDraftId, updates);
        if (configDraftDefault) {
          await db.setDefaultAgentToolConfig(configDraftId);
        }
      }
      setConfigDialogOpen(false);
      await loadConfigs(configToolId);
    } catch (err) {
      console.error('Failed to save agent tool config:', err);
      setConfigDraftError(t.settings?.cliConfigSaveError || 'Failed to save config.');
    }
  }, [
    configDialogMode,
    configDraftDefault,
    configDraftDescription,
    configDraftId,
    configDraftConfig,
    configDraftName,
    configToolId,
    loadConfigs,
    t.settings?.cliConfigSaveError,
    sanitizeConfigDraft,
    validateConfig,
  ]);

  const deleteConfig = useCallback(async (config: AgentToolConfig) => {
    const confirmText = t.settings?.cliConfigDeleteConfirm || 'Delete this config?';
    if (!window.confirm(confirmText)) return;
    try {
      await db.deleteAgentToolConfig(config.id);
      await loadConfigs(configToolId);
    } catch (err) {
      console.error('Failed to delete config:', err);
    }
  }, [configToolId, loadConfigs, t.settings?.cliConfigDeleteConfirm]);

  const handleConfigDialogOpenChange = useCallback((open: boolean) => {
    setConfigDialogOpen(open);
    if (!open) {
      setIsApiKeyVisible(false);
    }
  }, []);

  const setDefaultConfig = useCallback(async (config: AgentToolConfig) => {
    try {
      await db.setDefaultAgentToolConfig(config.id);
      await loadConfigs(configToolId);
    } catch (err) {
      console.error('Failed to set default config:', err);
    }
  }, [configToolId, loadConfigs]);

  const configList = useMemo(() => configs, [configs]);
  const configTabs = useMemo(() => tools, [tools]);
  const activeTool = useMemo(
    () => tools.find((tool) => tool.id === configToolId) || null,
    [configToolId, tools]
  );
  const configToolLabel = activeTool?.displayName || configToolId;
  const activeConfigSchema = useMemo(
    () => TOOL_CONFIG_SCHEMAS[configToolId] || {},
    [configToolId]
  );
  const configFieldEntries = useMemo(
    () => Object.entries(activeConfigSchema),
    [activeConfigSchema]
  );
  const advancedFieldKeys = useMemo(
    () => ADVANCED_FIELDS_BY_TOOL[configToolId] ?? new Set<string>(),
    [configToolId]
  );
  const basicConfigFieldEntries = useMemo(
    () => configFieldEntries.filter(([fieldKey]) => !advancedFieldKeys.has(fieldKey)),
    [advancedFieldKeys, configFieldEntries]
  );
  const advancedConfigFieldEntries = useMemo(
    () => configFieldEntries.filter(([fieldKey]) => advancedFieldKeys.has(fieldKey)),
    [advancedFieldKeys, configFieldEntries]
  );

  const setDraftFieldValue = useCallback((fieldKey: string, value: unknown) => {
    setConfigDraftConfig((prev) =>
      sanitizeConfigDraft(configToolId, {
        ...prev,
        [fieldKey]: value,
      })
    );
  }, [configToolId, sanitizeConfigDraft]);

  const renderConfigField = useCallback((fieldKey: string, field: ConfigFieldSchema) => {
    const value = configDraftConfig[fieldKey];
    const label = formatFieldLabel(fieldKey);
    const isSecretField = fieldKey === 'api_key';
    const isWideField =
      field.type === 'stringArray' ||
      field.type === 'stringMap' ||
      (field.type === 'string' && Boolean(field.multiline)) ||
      isSecretField;
    const fieldDescription =
      field.description ||
      (field.type === 'stringArray'
        ? t.settings?.cliConfigHintArgsPerLine || 'One argument per line'
        : field.type === 'stringMap'
          ? t.settings?.cliConfigHintEnvPerLine || 'KEY=VALUE per line'
          : '');

    return (
      <div key={fieldKey} className={cn('space-y-2', isWideField ? 'md:col-span-2' : '')}>
        <label className="text-sm font-medium">{label}</label>
        {field.type === 'string' && field.options?.length ? (
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setDraftFieldValue(fieldKey, e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t.settings?.cliConfigOptionDefault || "Default"}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === 'string' && field.multiline ? (
          <textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setDraftFieldValue(fieldKey, e.target.value)}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
            rows={4}
          />
        ) : field.type === 'string' ? (
          <div className="relative">
            <input
              type={isSecretField && !isApiKeyVisible ? 'password' : 'text'}
              autoComplete={isSecretField ? 'new-password' : undefined}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setDraftFieldValue(fieldKey, e.target.value)}
              className={cn("w-full rounded-md border bg-background px-3 py-2 text-sm", isSecretField ? 'pr-10' : '')}
            />
            {isSecretField ? (
              <button
                type="button"
                onClick={() => setIsApiKeyVisible((prev) => !prev)}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-2 flex items-center"
                aria-label={
                  isApiKeyVisible
                    ? t.settings?.cliConfigHideSecret || 'Hide value'
                    : t.settings?.cliConfigShowSecret || 'Show value'
                }
              >
                {isApiKeyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            ) : null}
          </div>
        ) : field.type === 'stringArray' ? (
          <textarea
            value={toStringArrayInput(value)}
            onChange={(e) => setDraftFieldValue(fieldKey, parseStringArrayInput(e.target.value))}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm font-mono"
            rows={4}
          />
        ) : field.type === 'stringMap' ? (
          <textarea
            value={toStringMapInput(value)}
            onChange={(e) => setDraftFieldValue(fieldKey, parseStringMapInput(e.target.value))}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm font-mono"
            rows={4}
          />
        ) : field.type === 'booleanNullable' ? (
          <select
            value={
              typeof value === 'boolean'
                ? value
                  ? 'true'
                  : 'false'
                : 'null'
            }
            onChange={(e) => {
              const selected = e.target.value;
              setDraftFieldValue(fieldKey, selected === 'null' ? null : selected === 'true');
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="null">{t.settings?.cliConfigOptionDefault || "Default"}</option>
            <option value="true">{t.settings?.cliConfigOptionEnabled || "Enabled"}</option>
            <option value="false">{t.settings?.cliConfigOptionDisabled || "Disabled"}</option>
          </select>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={(value ?? field.defaultValue) === true}
              onChange={(e) => setDraftFieldValue(fieldKey, e.target.checked)}
            />
            <span>{(value ?? field.defaultValue) === true ? (t.settings?.cliConfigOptionEnabled || 'Enabled') : (t.settings?.cliConfigOptionDisabled || 'Disabled')}</span>
          </label>
        )}
        <p className="text-muted-foreground text-[11px] font-mono">
          {fieldKey}
          {fieldDescription ? ` · ${fieldDescription}` : ''}
        </p>
      </div>
    );
  }, [
    configDraftConfig,
    setDraftFieldValue,
    isApiKeyVisible,
    t.settings?.cliConfigHideSecret,
    t.settings?.cliConfigHintArgsPerLine,
    t.settings?.cliConfigHintEnvPerLine,
    t.settings?.cliConfigOptionDefault,
    t.settings?.cliConfigOptionDisabled,
    t.settings?.cliConfigOptionEnabled,
    t.settings?.cliConfigShowSecret,
  ]);

  const statusLabel = (installed: boolean) =>
    installed
      ? t.settings?.cliInstalled || 'Installed'
      : t.settings?.cliNotInstalled || 'Not installed';

  const columnLabels = {
    tool: t.settings?.cliTool || 'Tool',
    status: t.settings?.cliStatus || 'Status',
    version: t.settings?.cliVersion || 'Version',
    path: t.settings?.cliInstallPath || 'Install Path',
  };

  return (
    <div className="space-y-6">
      <div className="border-border rounded-lg border p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t.settings?.cliDefaultLabel || 'Default CLI'}
          </label>
          <select
            value={defaultCliToolId}
            onChange={(e) => handleDefaultChange(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">
              {t.settings?.cliDefaultPlaceholder || 'Select default CLI'}
            </option>
            {tools
              .filter((tool) => tool.installed)
              .map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.displayName}
                </option>
              ))}
          </select>
          <p className="text-muted-foreground text-xs">
            {t.settings?.cliDefaultDescription ||
              'Used as the default CLI when creating new tasks.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
          {t.settings?.cliDetectError ||
            'Unable to detect CLI tools. Please try again.'}
        </div>
      )}

      {loading && tools.length === 0 ? (
        <div className="border-border rounded-lg border px-4 py-6 text-center text-sm">
          {t.settings?.cliDetecting || 'Detecting...'}
        </div>
      ) : tools.length === 0 ? (
        <div className="border-border rounded-lg border px-4 py-6 text-center text-sm">
          {t.settings?.cliEmpty || 'No CLI tools found.'}
        </div>
      ) : (
        <div className="border-border rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                {t.settings?.cliConfigTitle || 'CLI Configurations'}
              </h3>
              <p className="text-muted-foreground text-xs">
                {t.settings?.cliConfigDescription || 'Manage per-tool CLI profiles.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTools(true)}
                disabled={loading}
              >
                {loading
                  ? t.settings?.cliDetecting || 'Detecting...'
                  : t.settings?.cliRescan || 'Rescan'}
              </Button>
              <Button size="sm" onClick={openCreateConfig} disabled={!configToolId}>
                <Plus className="mr-1 size-3" />
                {t.settings?.cliConfigCreate || 'New'}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="border-border bg-muted/20 rounded-lg border p-2">
              <div className="text-muted-foreground px-2 py-1 text-xs font-medium">
                {t.settings?.cliTool || 'Tool'}
              </div>
              <div className="space-y-1" role="tablist" aria-label="CLI Tools">
                {configTabs.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    role="tab"
                    aria-selected={configToolId === tool.id}
                    onClick={() => setConfigToolId(tool.id)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      configToolId === tool.id
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent/40 hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{tool.displayName}</span>
                      <span
                        className={cn(
                          'inline-flex size-2 rounded-full',
                          tool.installed ? 'bg-emerald-500' : 'bg-rose-500'
                        )}
                      />
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs font-mono">
                      {tool.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {activeTool ? (
                <div className="border-border rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-muted/60 text-muted-foreground flex size-9 items-center justify-center rounded-md">
                        <Terminal className="size-4" />
                      </div>
                      <div>
                        <p className="text-foreground text-sm font-semibold">
                          {activeTool.displayName}
                        </p>
                        <p className="text-muted-foreground text-xs font-mono">
                          {activeTool.name}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        activeTool.installed
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {activeTool.installed ? (
                        <Check className="size-3" />
                      ) : (
                        <AlertCircle className="size-3" />
                      )}
                      {statusLabel(activeTool.installed)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">{columnLabels.version}</p>
                      <p className="text-foreground font-mono">
                        {activeTool.version || '—'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">{columnLabels.path}</p>
                      <p className="text-foreground font-mono break-all">
                        {activeTool.installPath || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="border-border rounded-lg border p-4">
                {configsLoading ? (
                  <div className="text-muted-foreground text-sm">
                    {t.settings?.cliConfigLoading || 'Loading configs...'}
                  </div>
                ) : configsError ? (
                  <div className="text-destructive text-sm">{configsError}</div>
                ) : configList.length === 0 ? (
                  <div className="text-muted-foreground text-sm">
                    {t.settings?.cliConfigEmpty || 'No configs yet.'}
                  </div>
                ) : (
                  <div className="divide-border divide-y">
                    {configList.map((config) => (
                      <div
                        key={config.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{config.name}</span>
                            {config.is_default ? (
                              <span className="text-xs text-amber-600">
                                {t.settings?.cliConfigDefault || 'Default'}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {config.description ||
                              t.settings?.cliConfigNoDescription ||
                              'No description'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!config.is_default ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDefaultConfig(config)}
                            >
                              <Star className="mr-1 size-3" />
                              {t.settings?.cliConfigSetDefault || 'Set default'}
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => openEditConfig(config)}>
                            <Pencil className="mr-1 size-3" />
                            {t.common?.edit || 'Edit'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteConfig(config)}>
                            <Trash2 className="mr-1 size-3" />
                            {t.common?.delete || 'Delete'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={configDialogOpen} onOpenChange={handleConfigDialogOpenChange}>
        <DialogContent className="!flex max-h-[85vh] max-w-3xl !flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {configToolLabel ||
                (configDialogMode === 'create'
                  ? t.settings?.cliConfigCreateTitle || 'Create Config'
                  : t.settings?.cliConfigEditTitle || 'Edit Config')}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.settings?.cliConfigName || 'Name'}
              </label>
              <input
                value={configDraftName}
                onChange={(e) => setConfigDraftName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="DEFAULT"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.settings?.cliConfigDescriptionLabel || 'Description'}
              </label>
              <input
                value={configDraftDescription}
                onChange={(e) => setConfigDraftDescription(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={configDraftDefault}
                onChange={(e) => setConfigDraftDefault(e.target.checked)}
              />
              <span>{t.settings?.cliConfigMakeDefault || 'Set as default'}</span>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">
                {t.settings?.cliConfigParametersLabel || 'CLI Parameters'}
              </label>
              {configFieldEntries.length === 0 ? (
                <div className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
                  {t.settings?.cliConfigNoFields || 'No configurable fields for this CLI.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {basicConfigFieldEntries.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                        {t.settings?.cliConfigSectionBasic || 'Basic'}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {basicConfigFieldEntries.map(([fieldKey, field]) =>
                          renderConfigField(fieldKey, field)
                        )}
                      </div>
                    </div>
                  ) : null}

                  {advancedConfigFieldEntries.length > 0 ? (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                        {t.settings?.cliConfigSectionAdvanced || 'Advanced'}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {advancedConfigFieldEntries.map(([fieldKey, field]) =>
                          renderConfigField(fieldKey, field)
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {configDraftError && (
              <div className="text-destructive text-sm">{configDraftError}</div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t pt-3">
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              {t.common?.cancel || 'Cancel'}
            </Button>
            <Button onClick={saveConfigDraft}>
              {t.common?.save || 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

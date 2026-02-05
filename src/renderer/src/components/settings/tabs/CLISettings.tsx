import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/providers/language-provider';
import { Terminal, Check, AlertCircle, Plus, Pencil, Star, Trash2 } from 'lucide-react';
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

const createConfigTemplate = (toolId: string): Record<string, unknown> => {
  const common = {
    executablePath: '',
    env: {},
    additionalArgs: [],
  };

  switch (toolId) {
    case 'claude-code':
      return {
        ...common,
        model: '',
        agent: '',
        agentsJson: '',
        addDir: [],
        allowedTools: [],
        disallowedTools: [],
        appendSystemPrompt: '',
        systemPrompt: '',
        permissionMode: '',
        mcpConfig: [],
        strictMcpConfig: null,
        settings: '',
        settingSources: '',
        continue: null,
        resume: '',
        outputFormat: '',
        inputFormat: '',
        includePartialMessages: null,
        replayUserMessages: null,
        noSessionPersistence: null,
        debug: null,
        debugFile: '',
        verbose: null,
        betas: [],
        fallbackModel: '',
        maxBudgetUsd: '',
        jsonSchema: '',
        tools: '',
        fileResources: [],
        chrome: null,
        noChrome: null,
        ide: null,
        pluginDir: [],
        allowDangerouslySkipPermissions: null,
        dangerouslySkipPermissions: null,
      };
    case 'codex':
      return {
        ...common,
        model: '',
        profile: '',
        sandbox: '',
        askForApproval: '',
        fullAuto: null,
        dangerouslyBypassApprovalsAndSandbox: null,
        oss: null,
        localProvider: '',
        search: null,
        addDir: [],
        cd: '',
        noAltScreen: null,
        configOverrides: [],
        enableFeatures: [],
        disableFeatures: [],
        imagePaths: [],
        threadId: '',
        sessionId: '',
        resumeSessionId: '',
      };
    case 'cursor-agent':
      return {
        ...common,
        apiKey: '',
        env: { CURSOR_API_KEY: '' },
        model: '',
        mode: '',
        plan: null,
        resume: '',
        continue: null,
        force: null,
        sandbox: '',
        approveMcps: null,
        workspace: '',
        outputFormat: '',
        streamPartialOutput: null,
        cloud: null,
        print: null,
        headers: [],
      };
    case 'gemini-cli':
      return {
        ...common,
        model: '',
        prompt: '',
        promptInteractive: '',
        sandbox: null,
        yolo: null,
        approvalMode: '',
        experimentalAcp: null,
        allowedMcpServerNames: [],
        allowedTools: [],
        extensions: [],
        resume: '',
        includeDirectories: [],
        outputFormat: '',
        rawOutput: null,
        acceptRawOutputRisk: null,
        debug: null,
      };
    case 'opencode':
      return {
        ...common,
        model: '',
        continue: null,
        session: '',
        prompt: '',
        agent: '',
        printLogs: null,
        logLevel: '',
        port: '',
        hostname: '',
        mdns: null,
        mdnsDomain: '',
        cors: [],
      };
    default:
      return { ...common };
  }
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
  const [configDraftJson, setConfigDraftJson] = useState('{\n  \n}');
  const [configDraftDefault, setConfigDraftDefault] = useState(false);
  const [configDraftError, setConfigDraftError] = useState<string | null>(null);

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
    const seed = createConfigTemplate(toolId);
    if (typeof base.executablePath === 'string' && base.executablePath.trim()) {
      seed.executablePath = base.executablePath;
    }
    if (typeof base.defaultModel === 'string' && base.defaultModel.trim()) {
      seed.model = base.defaultModel;
    }
    if (toolId === 'cursor-agent' && typeof base.apiKey === 'string' && base.apiKey.trim()) {
      seed.apiKey = base.apiKey;
      seed.env = {
        ...(seed.env && typeof seed.env === 'object' ? seed.env : {}),
        CURSOR_API_KEY: base.apiKey,
      };
    }
    return seed;
  }, []);

  const openCreateConfig = useCallback(async () => {
    if (!configToolId) return;
    setConfigDialogMode('create');
    setConfigDraftId(null);
    setConfigDraftName('DEFAULT');
    setConfigDraftDescription('');
    setConfigDraftDefault(true);
    setConfigDraftError(null);

    try {
      const baseConfig = await window.api?.cliToolConfig?.get?.(configToolId);
      const seed = normalizeSeedConfig(configToolId, (baseConfig || {}) as Record<string, unknown>);
      setConfigDraftJson(JSON.stringify(seed, null, 2));
    } catch {
      setConfigDraftJson('{\n  \n}');
    }

    setConfigDialogOpen(true);
  }, [configToolId, normalizeSeedConfig]);

  const openEditConfig = useCallback((config: AgentToolConfig) => {
    setConfigDialogMode('edit');
    setConfigDraftId(config.id);
    setConfigDraftName(config.name || '');
    setConfigDraftDescription(config.description || '');
    setConfigDraftDefault(Boolean(config.is_default));
    setConfigDraftError(null);
    if (config.config_json) {
      try {
        const parsed = JSON.parse(config.config_json);
        setConfigDraftJson(JSON.stringify(parsed, null, 2));
      } catch {
        setConfigDraftJson(config.config_json);
      }
    } else {
      setConfigDraftJson('{\n  \n}');
    }
    setConfigDialogOpen(true);
  }, []);

  const validateConfig = useCallback((toolId: string, parsed: Record<string, unknown>) => {
    if (toolId === 'cursor-agent') {
      const apiKey = parsed.apiKey as string | undefined;
      const env = parsed.env as Record<string, string> | undefined;
      if (!apiKey && (!env || !env.CURSOR_API_KEY)) {
        return t.settings?.cliConfigCursorKeyRequired || 'CURSOR_API_KEY is required.';
      }
    }
    return null;
  }, [t.settings?.cliConfigCursorKeyRequired]);

  const saveConfigDraft = useCallback(async () => {
    if (!configToolId) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configDraftJson || '{}');
    } catch (error) {
      setConfigDraftError(t.settings?.cliConfigJsonInvalid || 'Invalid JSON.');
      return;
    }

    const formatted = JSON.stringify(parsed, null, 2);
    const validationError = validateConfig(configToolId, parsed);
    if (validationError) {
      setConfigDraftError(validationError);
      return;
    }

    setConfigDraftError(null);
    setConfigDraftJson(formatted);
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
    configDraftJson,
    configDraftName,
    configToolId,
    loadConfigs,
    t.settings?.cliConfigJsonInvalid,
    t.settings?.cliConfigSaveError,
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

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {configToolLabel ||
                (configDialogMode === 'create'
                  ? t.settings?.cliConfigCreateTitle || 'Create Config'
                  : t.settings?.cliConfigEditTitle || 'Edit Config')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.settings?.cliConfigJsonLabel || 'Config JSON'}
              </label>
              <textarea
                value={configDraftJson}
                onChange={(e) => setConfigDraftJson(e.target.value)}
                className="border-input bg-background text-foreground w-full resize-none rounded-md border px-3 py-2 text-xs font-mono"
                rows={10}
              />
              <p className="text-muted-foreground text-xs">
                {t.settings?.cliConfigJsonHint || 'Use JSON to define CLI parameters.'}
              </p>
            </div>

            {configDraftError && (
              <div className="text-destructive text-sm">{configDraftError}</div>
            )}
          </div>

          <DialogFooter>
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

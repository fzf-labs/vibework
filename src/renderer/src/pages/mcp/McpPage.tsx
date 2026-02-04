import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useProjects } from '@/hooks/useProjects';
import { useLanguage } from '@/providers/language-provider';
import { API_BASE_URL } from '@/config';
import { resolvePath } from '@/lib/skills';
import {
  buildMcpServersFromConfig,
  extractMcpServers,
  getProjectMcpConfigPath,
  parseTomlMcpServers,
  type MCPServerRecord,
} from '@/lib/mcp';
import type { MCPServerUI } from '@/components/settings/types';

type CliToolInfo = { id: string; displayName?: string };
type KeyValuePair = { id: string; key: string; value: string };

type CliMcpStatus = {
  id: string;
  label: string;
  global: { configured: boolean; serverCount: number; servers: MCPServerUI[] };
  project: { configured: boolean; serverCount: number; servers: MCPServerUI[] };
};

type ConfigCandidate = { path: string; format: 'json' | 'toml' };

const CLI_GLOBAL_CONFIGS: Record<string, string[]> = {
  'cursor-agent': ['~/.cursor/mcp.json', '~/.cursor/agent-config.json'],
  codex: ['~/.codex/config.toml', '~/.codex/config.json'],
  'gemini-cli': ['~/.gemini/settings.json', '~/.gemini/config.json'],
  opencode: ['~/.opencode/config.json'],
  'claude-code': ['~/.claude.json', '~/.config/claude/config.json'],
};

const getConfigCandidates = (paths: string[]): ConfigCandidate[] =>
  paths.map((path) => ({
    path,
    format: path.endsWith('.toml') ? 'toml' : 'json',
  }));

export function McpPage() {
  const { t } = useLanguage();
  const { currentProject } = useProjects();
  const [cliTools, setCliTools] = useState<CliToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cliStatuses, setCliStatuses] = useState<CliMcpStatus[]>([]);
  const [detailServer, setDetailServer] = useState<MCPServerUI | null>(null);

  const cliIds = useMemo(() => {
    if (cliTools.length > 0) return cliTools.map((tool) => tool.id);
    return Object.keys(CLI_GLOBAL_CONFIGS);
  }, [cliTools]);

  const cliLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const tool of cliTools) {
      map.set(tool.id, tool.displayName || tool.id);
    }
    return map;
  }, [cliTools]);

  useEffect(() => {
    let cancelled = false;
    const loadCliTools = async () => {
      const tools =
        (await window.api?.cliTools?.getAll?.())?.filter(Boolean) ?? [];
      if (cancelled) return;
      setCliTools(tools as CliToolInfo[]);
    };
    loadCliTools();
    return () => {
      cancelled = true;
    };
  }, []);

  const readMcpConfigFile = useCallback(async (candidate: ConfigCandidate) => {
    const resolvedPath = await resolvePath(candidate.path);
    if (!resolvedPath) return { exists: false, servers: {} };

    const parseContent = (content: string) => {
      if (candidate.format === 'toml') {
        return parseTomlMcpServers(content);
      }
      try {
        const parsed = JSON.parse(content) as unknown;
        return extractMcpServers(parsed);
      } catch (error) {
        console.warn('[Project MCP] Failed to parse JSON config:', error);
        return {};
      }
    };

    if (window.api?.fs?.exists && window.api?.fs?.readTextFile) {
      try {
        const exists = await window.api.fs.exists(resolvedPath);
        if (!exists) return { exists: false, servers: {} };
        const content = await window.api.fs.readTextFile(resolvedPath);
        return { exists: true, servers: parseContent(content) };
      } catch (error) {
        console.warn('[Project MCP] Failed to read config file:', error);
        return { exists: false, servers: {} };
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/files/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: resolvedPath, expandHome: true }),
      });
      const data = await response.json();
      if (!data.success || !data.content) {
        return { exists: false, servers: {} };
      }
      return { exists: true, servers: parseContent(data.content) };
    } catch (error) {
      console.warn('[Project MCP] Failed to read config via API:', error);
    }

    return { exists: false, servers: {} };
  }, []);

  const getAggregateStatus = useCallback(
    async (candidates: ConfigCandidate[], sourceLabel: string) => {
      let configured = false;
      const combined: MCPServerRecord = {};
      for (const candidate of candidates) {
        const result = await readMcpConfigFile(candidate);
        if (result.exists) {
          configured = true;
        }
        Object.assign(combined, result.servers || {});
      }
      const servers = buildMcpServersFromConfig(combined, sourceLabel);
      return { configured, serverCount: servers.length, servers };
    },
    [readMcpConfigFile]
  );

  const loadStatuses = useCallback(async () => {
    if (!currentProject?.path) {
      setCliStatuses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const statuses = await Promise.all(
      cliIds.map(async (cliId) => {
        const globalPaths = CLI_GLOBAL_CONFIGS[cliId] || [];
        const globalCandidates = getConfigCandidates(globalPaths);

        const projectPath = getProjectMcpConfigPath(currentProject.path, cliId);
        const projectCandidates = getConfigCandidates([projectPath]);

        return {
          id: cliId,
          label: cliLabelMap.get(cliId) || cliId,
          global: await getAggregateStatus(globalCandidates, t.settings.mcpProjectSourceGlobal),
          project: await getAggregateStatus(projectCandidates, t.settings.mcpProjectSourceProject),
        } as CliMcpStatus;
      })
    );

    setCliStatuses(statuses);
    setLoading(false);
  }, [cliIds, cliLabelMap, currentProject?.path, getAggregateStatus, t.settings.mcpProjectSourceGlobal, t.settings.mcpProjectSourceProject]);

  const formatServerType = (server: MCPServerUI) => {
    if (server.type === 'stdio') return t.settings.mcpTypeStdio;
    if (server.type === 'sse') return t.settings.mcpTypeSse || 'SSE';
    return t.settings.mcpTypeHttp;
  };

  const toKeyValuePairs = (values?: Record<string, string>): KeyValuePair[] =>
    Object.entries(values ?? {}).map(([key, value], index) => ({
      id: `${key}-${index}`,
      key,
      value,
    }));

  const detailArgs = detailServer?.args ?? [];
  const detailEnv = toKeyValuePairs(detailServer?.env);
  const detailHeaders = toKeyValuePairs(detailServer?.headers);
  const detailTransportType = detailServer?.type ?? 'stdio';
  const noop = () => {};

  const renderServers = (servers: MCPServerUI[]) => {
    if (!servers.length) {
      return (
        <div className="text-muted-foreground flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-sm">
          {t.settings.mcpNoServers}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3">
        {servers.map((server) => (
          <button
            type="button"
            key={`${server.id}-${server.name}`}
            className="border-border bg-background hover:border-foreground/20 w-full rounded-lg border p-3 text-left transition-colors"
            onClick={() => setDetailServer(server)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground text-sm font-medium">
                {server.name}
              </span>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">
                {formatServerType(server)}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">MCP</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t.settings.mcpProjectDescription}
          </p>
          {currentProject && (
            <div className="text-muted-foreground mt-2 text-xs">
              {currentProject.name}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          onClick={loadStatuses}
          disabled={!currentProject?.path}
        >
          <RefreshCw className="mr-2 size-4" />
          {t.common.refresh}
        </Button>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        {!currentProject ? (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
            <div className="text-lg font-medium">
              {t.settings.mcpProjectNoProjectTitle}
            </div>
            <div className="text-muted-foreground mt-2 max-w-md text-sm">
              {t.settings.mcpProjectNoProjectDescription}
            </div>
          </div>
        ) : cliStatuses.length === 0 ? (
          <div className="text-muted-foreground flex h-28 items-center justify-center rounded-xl border border-dashed border-border text-sm">
            {t.settings.mcpCliEmpty}
          </div>
        ) : (
          <div className="space-y-6">
            {cliStatuses.map((status) => (
              <div
                key={status.id}
                className="border-border bg-background rounded-xl border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-foreground text-sm font-medium">
                    {status.label}
                  </h4>
                  <span className="text-muted-foreground text-xs">
                    {t.settings.mcpProjectSourceGlobal} {status.global.serverCount} /{' '}
                    {t.settings.mcpProjectSourceProject} {status.project.serverCount}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="border-border rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-foreground text-sm font-medium">
                        {t.settings.mcpProjectSourceGlobal} MCP
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            status.global.configured
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {status.global.configured
                            ? t.settings.mcpProjectStatusConfigured
                            : t.settings.mcpProjectStatusMissing}
                        </span>
                        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                          {status.global.serverCount} {t.settings.mcpServers}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">{renderServers(status.global.servers)}</div>
                  </div>

                  <div className="border-border rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-foreground text-sm font-medium">
                        {t.settings.mcpProjectSourceProject} MCP
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            status.project.configured
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {status.project.configured
                            ? t.settings.mcpProjectStatusConfigured
                            : t.settings.mcpProjectStatusMissing}
                        </span>
                        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                          {status.project.serverCount} {t.settings.mcpServers}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">{renderServers(status.project.servers)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogPrimitive.Root
        open={!!detailServer}
        onOpenChange={(open) => {
          if (!open) setDetailServer(null);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60" />
          <DialogPrimitive.Content className="bg-background border-border fixed top-1/2 left-1/2 z-[100] flex max-h-[85vh] w-[500px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border shadow-2xl focus:outline-none">
            <div className="border-border shrink-0 border-b px-6 py-4">
              <DialogPrimitive.Title className="text-foreground text-lg font-semibold">
                {t.settings.mcpConfigTitle}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-sm transition-opacity focus:outline-none">
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="text-foreground mb-2 block text-sm font-medium">
                    {t.settings.mcpServerName}
                  </label>
                  <input
                    type="text"
                    value={detailServer?.name ?? ''}
                    onChange={noop}
                    placeholder={t.settings.mcpServerNamePlaceholder}
                    disabled
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="text-foreground mb-2 block text-sm font-medium">
                    {t.settings.mcpTransportType}
                  </label>
                  <select
                    value={detailTransportType}
                    onChange={noop}
                    disabled
                    className="border-input bg-background text-foreground focus:ring-ring h-10 w-full cursor-pointer rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="stdio">stdio</option>
                    <option value="http">http</option>
                    <option value="sse">sse</option>
                  </select>
                </div>

                {detailTransportType === 'stdio' ? (
                  <>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpCommand}
                      </label>
                      <input
                        type="text"
                        value={detailServer?.command ?? ''}
                        onChange={noop}
                        placeholder={t.settings.mcpCommandPlaceholder}
                        disabled
                        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>

                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpArguments}
                      </label>
                      <div className="space-y-2">
                        {detailArgs.map((arg, index) => (
                          <div key={`${arg}-${index}`} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={arg}
                              onChange={noop}
                              placeholder={t.settings.mcpArgumentPlaceholder}
                              disabled
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpEnvVariables}
                      </label>
                      <div className="space-y-2">
                        {detailEnv.map((item) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.key}
                              onChange={noop}
                              placeholder={t.settings.mcpEnvVariableName}
                              disabled
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-32 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            <span className="text-muted-foreground">=</span>
                            <input
                              type="text"
                              value={item.value}
                              onChange={noop}
                              placeholder={t.settings.mcpEnvVariableValue}
                              disabled
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpServerUrl}
                      </label>
                      <input
                        type="text"
                        value={detailServer?.url ?? ''}
                        onChange={noop}
                        placeholder={
                          detailTransportType === 'sse'
                            ? t.settings.mcpServerUrlPlaceholderSse
                            : t.settings.mcpServerUrlPlaceholder
                        }
                        disabled
                        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>

                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpCustomHeaders}{' '}
                        <span className="text-muted-foreground font-normal">
                          {t.settings.mcpCustomHeadersOptional}
                        </span>
                      </label>
                      <div className="space-y-2">
                        {detailHeaders.map((item) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.key}
                              onChange={noop}
                              placeholder="Header Name"
                              disabled
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-32 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            <span className="text-muted-foreground">=</span>
                            <input
                              type="text"
                              value={item.value}
                              onChange={noop}
                              placeholder="Value"
                              disabled
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-border shrink-0 border-t px-6 py-4">
              <DialogPrimitive.Close className="bg-foreground text-background hover:bg-foreground/90 flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors">
                {t.common.close || 'Close'}
              </DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from 'react';
import { getMcpConfigPath } from '@/lib/paths';
import { buildMcpServersFromConfig, extractMcpServers } from '@/lib/mcp';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import { Button } from '@/components/ui/button';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  FileJson,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';

import { API_BASE_URL } from '../constants';
import type {
  MCPConfig,
  MCPServerStdio,
  MCPServerUI,
  SettingsTabProps,
} from '../types';

type MCPConfigSource = {
  name: string;
  path: string;
  exists: boolean;
  servers: Record<
    string,
    MCPServerStdio | { url: string; headers?: Record<string, string>; type?: 'http' | 'sse' }
  >;
  label?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stripTomlComment = (line: string): string => {
  let inSingle = false;
  let inDouble = false;
  let out = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    if (ch === '#' && !inSingle && !inDouble) break;
    out += ch;
  }
  return out.trim();
};

const splitTopLevel = (input: string, delimiter = ','): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    if (!inSingle && !inDouble) {
      if (ch === '{' || ch === '[' || ch === '(') depth += 1;
      if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
      if (ch === delimiter && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const unquote = (value: string): string => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const parseTomlValue = (raw: string): unknown => {
  const value = raw.trim();
  if (!value) return '';
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return unquote(value);
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map((item) => parseTomlValue(item));
  }
  if (value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return {};
    const pairs = splitTopLevel(inner);
    const obj: Record<string, unknown> = {};
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      const key = unquote(pair.slice(0, idx).trim());
      const val = pair.slice(idx + 1).trim();
      obj[key] = parseTomlValue(val);
    }
    return obj;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^[+-]?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const splitTomlPath = (path: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < path.length; i += 1) {
    const ch = path[i];
    const prev = i > 0 ? path[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    if (ch === '.' && !inSingle && !inDouble) {
      if (current.trim()) parts.push(unquote(current.trim()));
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(unquote(current.trim()));
  return parts;
};

const parseToml = (content: string): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  let currentPath: string[] = [];
  const ensurePath = (pathParts: string[]): Record<string, unknown> => {
    let cursor = result as Record<string, unknown>;
    for (const part of pathParts) {
      if (!isRecord(cursor[part])) cursor[part] = {};
      cursor = cursor[part] as Record<string, unknown>;
    }
    return cursor;
  };

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = stripTomlComment(rawLine);
    if (!line) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      const section = line.slice(1, -1).trim();
      currentPath = splitTomlPath(section);
      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = unquote(line.slice(0, idx).trim());
    const value = line.slice(idx + 1).trim();
    const target = ensurePath(currentPath);
    target[key] = parseTomlValue(value);
  }

  return result;
};

const parseTomlMcpServers = (
  content: string
): Record<
  string,
  MCPServerStdio | { url: string; headers?: Record<string, string>; type?: 'http' | 'sse' }
> => {
  const parsed = parseToml(content);
  return extractMcpServers(parsed);
};

// MCP Card component
function MCPCard({
  server,
  onConfigure,
  onDelete,
  onClick,
  readOnly = false,
}: {
  server: MCPServerUI;
  onConfigure?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);
  const showActions = !readOnly && onConfigure && onDelete;
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`border-border bg-background hover:border-foreground/20 relative flex flex-col rounded-xl border p-4 transition-colors ${
        isClickable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="mb-2">
        <span className="text-foreground text-sm font-medium">
          {server.name}
        </span>
      </div>

      <p className="text-muted-foreground mb-4 flex-1 text-xs">
        {server.type === 'stdio'
          ? t.settings.mcpTypeStdio
          : server.type === 'sse'
            ? t.settings.mcpTypeSse || 'SSE'
            : t.settings.mcpTypeHttp}
      </p>

      {showActions && (
        <div className="border-border flex items-center justify-end border-t pt-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button
              onClick={onConfigure}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1.5 transition-colors"
              title={t.settings.mcpGoToConfigure}
            >
              <Settings2 className="size-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1.5 transition-colors"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="border-border bg-popover absolute right-0 bottom-full z-20 mb-1 min-w-max rounded-lg border py-1 shadow-lg">
                    <button
                      onClick={() => {
                        onDelete?.();
                        setShowMenu(false);
                      }}
                      className="hover:bg-destructive/10 text-destructive flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors"
                    >
                      <Trash2 className="size-3.5 shrink-0" />
                      {t.settings.mcpDeleteServer}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type MainTab = 'installed' | 'cli';

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

type CliMcpGroup = {
  id: string;
  label: string;
  path: string;
  exists: boolean;
  servers: MCPServerUI[];
};

interface ConfigDialogState {
  open: boolean;
  mode: 'add' | 'edit' | 'view';
  serverName: string;
  transportType: 'stdio' | 'http' | 'sse';
  command: string;
  args: string[];
  env: KeyValuePair[];
  url: string;
  headers: KeyValuePair[];
  editServerId?: string;
}

const initialConfigDialog: ConfigDialogState = {
  open: false,
  mode: 'add',
  serverName: '',
  transportType: 'stdio',
  command: '',
  args: [],
  env: [],
  url: '',
  headers: [],
};

export function MCPSettings({ settings }: SettingsTabProps) {
  const [appServers, setAppServers] = useState<MCPServerUI[]>([]);
  const [cliGroups, setCliGroups] = useState<CliMcpGroup[]>([]);
  const [mainTab, setMainTab] = useState<MainTab>('installed');
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
  const [cliError, setCliError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [homeDir, setHomeDir] = useState<string | null>(null);

  // Import by JSON dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedCliTargets, setSelectedCliTargets] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  // Config dialog (for both add and edit)
  const [configDialog, setConfigDialog] =
    useState<ConfigDialogState>(initialConfigDialog);

  const { t } = useLanguage();
  const mcpLoadError = t.settings.mcpLoadError;
  const isViewMode = configDialog.mode === 'view';
  const exportableCliGroups = useMemo(
    () => cliGroups.filter((group) => group.path.endsWith('.json')),
    [cliGroups]
  );
  const allCliSelected =
    exportableCliGroups.length > 0 &&
    selectedCliTargets.length === exportableCliGroups.length;

  useEffect(() => {
    setSelectedCliTargets([]);
  }, [exportableCliGroups]);

  const resolvePath = useCallback(async (targetPath: string): Promise<string> => {
    if (!targetPath) return targetPath;
    if (targetPath.startsWith('~') && window.api?.path?.homeDir) {
      const homeDir = await window.api.path.homeDir();
      return targetPath.replace(/^~(?=\/|\\)/, homeDir);
    }
    return targetPath;
  }, []);

  const formatDisplayPath = useCallback((targetPath: string) => {
    if (!targetPath || targetPath.startsWith('~') || !homeDir) return targetPath;
    const normalizedHome = homeDir.replace(/\/$/, '');
    if (targetPath.startsWith(normalizedHome)) {
      const suffix = targetPath.slice(normalizedHome.length);
      return `~${suffix || ''}`;
    }
    return targetPath;
  }, [homeDir]);

  useEffect(() => {
    let cancelled = false;
    if (window.api?.path?.homeDir) {
      window.api.path.homeDir()
        .then((dir) => {
          if (!cancelled) setHomeDir(dir);
        })
        .catch(() => {
          if (!cancelled) setHomeDir(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const getSaveConfigPath = useCallback(async (): Promise<string> => {
    if (settings?.mcpConfigPath) return settings.mcpConfigPath;
    return getMcpConfigPath();
  }, [settings?.mcpConfigPath]);

  const ensureParentDir = async (filePath: string): Promise<void> => {
    const lastSeparator = Math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf('\\')
    );
    if (lastSeparator <= 0) return;
    const dirPath = filePath.slice(0, lastSeparator);
    if (window.api?.fs?.mkdir) {
      await window.api.fs.mkdir(dirPath);
    }
  };

  const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
    if (!dirPath) return;
    if (window.api?.fs?.mkdir) {
      await window.api.fs.mkdir(dirPath);
    }
  };

  const getDirectoryPath = (filePath: string): string => {
    if (!filePath) return filePath;
    const lastSeparator = Math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf('\\')
    );
    if (lastSeparator <= 0) return filePath;
    return filePath.slice(0, lastSeparator);
  };

  const buildServersFromConfig = useCallback(
    (
      servers: Record<
        string,
        MCPServerStdio | { url: string; headers?: Record<string, string>; type?: 'http' | 'sse' }
      >,
      sourceName: string
    ): MCPServerUI[] => buildMcpServersFromConfig(servers, sourceName),
    []
  );

  const isAppConfigName = useCallback(
    (name: string) => name.toLowerCase() === 'vibework',
    []
  );

  const formatCliLabel = useCallback(
    (id: string) =>
      id
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' '),
    []
  );

  // Filter and sort servers
  const filteredServers = appServers
    .filter((server) => {
      if (
        searchQuery &&
        !server.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aConfigured = a.type === 'stdio' ? !!a.command : !!a.url;
      const bConfigured = b.type === 'stdio' ? !!b.command : !!b.url;
      if (aConfigured && !bConfigured) return -1;
      if (bConfigured && !aConfigured) return 1;
      return 0;
    });

  const readAppServersFromFile = useCallback(async (): Promise<MCPServerUI[] | null> => {
    if (!window.api?.fs?.readTextFile || !window.api?.fs?.exists) return null;
    const localPath = await resolvePath(await getSaveConfigPath());
    if (!localPath) return null;
    const exists = await window.api.fs.exists(localPath);
    if (!exists) return null;

    const content = await window.api.fs.readTextFile(localPath);
    const parsed = JSON.parse(content) as MCPConfig | Record<string, unknown>;
    const mcpServers = (parsed as MCPConfig).mcpServers || parsed;
    if (!mcpServers || typeof mcpServers !== 'object') return [];

    return buildServersFromConfig(
      mcpServers as Record<
        string,
        MCPServerStdio | { url: string; headers?: Record<string, string>; type?: 'http' | 'sse' }
      >,
      'VibeWork'
    );
  }, [buildServersFromConfig, getSaveConfigPath, resolvePath]);

  const fetchAllConfigs = useCallback(async (): Promise<MCPConfigSource[]> => {
    const fsApi = window.api?.fs;
    if (!fsApi?.readTextFile || !fsApi?.exists) {
      const response = await fetch(`${API_BASE_URL}/mcp/all-configs`);
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load config');
      }
      return result.configs as MCPConfigSource[];
    }

    const configs: MCPConfigSource[] = [];
    const readTextIfExists = async (path: string) => {
      try {
        const resolved = await resolvePath(path);
        if (!resolved) return null;
        const exists = await fsApi.exists(resolved);
        if (!exists) return null;
        const content = await fsApi.readTextFile(resolved);
        return { path: resolved, content };
      } catch (error) {
        console.warn('[MCP] Failed to read config path:', path, error);
        return null;
      }
    };
    const addConfig = (
      name: string,
      path: string,
      servers: MCPConfigSource['servers'],
      label?: string
    ) => {
      configs.push({ name, path, exists: true, servers, label });
    };
    const safeParseJsonServers = (content: string) => {
      try {
        const parsed = JSON.parse(content) as unknown;
        return extractMcpServers(parsed);
      } catch (error) {
        console.warn('[MCP] Failed to parse JSON config:', error);
        return {};
      }
    };
    const safeParseTomlServers = (content: string) => {
      try {
        return parseTomlMcpServers(content);
      } catch (error) {
        console.warn('[MCP] Failed to parse TOML config:', error);
        return {};
      }
    };
    const buildLabel = (prefix: string, suffix?: string) =>
      suffix ? `${prefix} (${suffix})` : prefix;
    

    const appConfigPath = await getSaveConfigPath();
    const appConfig = await readTextIfExists(appConfigPath);
    if (appConfig) {
      addConfig('VibeWork', appConfig.path, safeParseJsonServers(appConfig.content));
    }

    const cursorMcp = await readTextIfExists('~/.cursor/mcp.json');
    if (cursorMcp) {
      addConfig('cursor-agent', cursorMcp.path, safeParseJsonServers(cursorMcp.content), buildLabel('Cursor Agent', 'mcp.json'));
    }
    const cursorAgentConfig = await readTextIfExists('~/.cursor/agent-config.json');
    if (cursorAgentConfig) {
      addConfig(
        'cursor-agent@config',
        cursorAgentConfig.path,
        safeParseJsonServers(cursorAgentConfig.content),
        buildLabel('Cursor Agent', 'agent-config.json')
      );
    }

    const codexToml = await readTextIfExists('~/.codex/config.toml');
    if (codexToml) {
      addConfig('codex', codexToml.path, safeParseTomlServers(codexToml.content), buildLabel('Codex CLI', 'config.toml'));
    }
    const codexJson = await readTextIfExists('~/.codex/config.json');
    if (codexJson) {
      addConfig('codex@config', codexJson.path, safeParseJsonServers(codexJson.content), buildLabel('Codex CLI', 'config.json'));
    }

    const geminiSettings = await readTextIfExists('~/.gemini/settings.json');
    if (geminiSettings) {
      addConfig(
        'gemini-cli',
        geminiSettings.path,
        safeParseJsonServers(geminiSettings.content),
        buildLabel('Gemini CLI', 'settings.json')
      );
    }
    const geminiConfig = await readTextIfExists('~/.gemini/config.json');
    if (geminiConfig) {
      addConfig(
        'gemini-cli@config',
        geminiConfig.path,
        safeParseJsonServers(geminiConfig.content),
        buildLabel('Gemini CLI', 'config.json')
      );
    }

    const opencodeConfig = await readTextIfExists('~/.opencode/config.json');
    if (opencodeConfig) {
      addConfig(
        'opencode',
        opencodeConfig.path,
        safeParseJsonServers(opencodeConfig.content),
        buildLabel('OpenCode', 'config.json')
      );
    }

    const claudeState = await readTextIfExists('~/.claude.json');
    if (claudeState) {
      let claudeParsed: Record<string, unknown> | null = null;
      try {
        claudeParsed = JSON.parse(claudeState.content) as Record<string, unknown>;
      } catch (error) {
        console.warn('[MCP] Failed to parse Claude Code state:', error);
      }
      if (claudeParsed) {
        addConfig(
          'claude-code',
          claudeState.path,
          extractMcpServers(claudeParsed),
          buildLabel('Claude Code', 'global')
        );
        // Only read global CLI MCP config; skip project-scoped entries.
      } else {
        addConfig('claude-code', claudeState.path, {}, buildLabel('Claude Code', 'global'));
      }
    }

    const claudeConfig = await readTextIfExists('~/.config/claude/config.json');
    if (claudeConfig) {
      addConfig(
        'claude-code@config',
        claudeConfig.path,
        safeParseJsonServers(claudeConfig.content),
        buildLabel('Claude Code', 'config.json')
      );
    }

    return configs;
  }, [getSaveConfigPath, resolvePath]);

  const buildCliGroups = useCallback(async (
    configs: MCPConfigSource[]
  ): Promise<CliMcpGroup[]> => {
    const tools =
      (await window.api?.cliTools?.getAll?.())?.filter(Boolean) ?? [];
    const toolNameMap = new Map<string, string>();
    for (const tool of tools as { id: string; displayName?: string }[]) {
      toolNameMap.set(tool.id, tool.displayName || formatCliLabel(tool.id));
    }

    return configs
      .filter((config) => config.exists && !isAppConfigName(config.name))
      .map((config) => ({
        id: config.name,
        label: config.label || toolNameMap.get(config.name) || formatCliLabel(config.name),
        path: config.path,
        exists: config.exists,
        servers: buildServersFromConfig(config.servers, config.name),
      }));
  }, [buildServersFromConfig, formatCliLabel, isAppConfigName]);

  // Load MCP config from all sources
  useEffect(() => {
    let cancelled = false;

    async function loadMcpData() {
      setLoading(true);
      setAppError(null);
      setCliError(null);

      let appServersResult: MCPServerUI[] | null = null;
      try {
        appServersResult = await readAppServersFromFile();
      } catch (err) {
        console.error('[MCP] Failed to read app MCP config:', err);
      }

      let configs: MCPConfigSource[] | null = null;

      try {
        configs = await fetchAllConfigs();
      } catch (err) {
        console.error('[MCP] Failed to load MCP config:', err);
          setCliError(mcpLoadError);
          if (appServersResult === null) {
            setAppError(mcpLoadError);
          }
        }

      let appServersList = appServersResult ?? [];
      if (configs && appServersResult === null) {
        const appConfig = configs.find((config) => isAppConfigName(config.name));
        if (appConfig?.exists) {
          appServersList = buildServersFromConfig(appConfig.servers, 'VibeWork');
        }
      }

      let cliGroupsList: CliMcpGroup[] = [];
      if (configs) {
        try {
          cliGroupsList = await buildCliGroups(configs);
        } catch (err) {
          console.error('[MCP] Failed to build CLI MCP groups:', err);
          setCliError(mcpLoadError);
        }
      }

      if (cancelled) return;
      setAppServers(appServersList);
      setCliGroups(cliGroupsList);
      setLoading(false);
    }

    loadMcpData();
    return () => {
      cancelled = true;
    };
  }, [
    buildCliGroups,
    buildServersFromConfig,
    fetchAllConfigs,
    isAppConfigName,
    mcpLoadError,
    readAppServersFromFile,
    settings?.mcpConfigPath,
  ]);

  // Save MCP config via API
  const buildMcpConfig = (serverList: MCPServerUI[]): MCPConfig => {
    const mcpServers: Record<string, unknown> = {};
    for (const server of serverList) {
      if (server.type === 'http' || server.type === 'sse') {
        const serverConfig: Record<string, unknown> = {
          url: server.url || '',
        };
        // Only add type field for sse (http is default)
        if (server.type === 'sse') {
          serverConfig.type = 'sse';
        }
        if (server.headers && Object.keys(server.headers).length > 0) {
          serverConfig.headers = server.headers;
        }
        mcpServers[server.name] = serverConfig;
      } else {
        const serverConfig: Record<string, unknown> = {
          command: server.command || '',
        };
        if (server.args && server.args.length > 0) {
          serverConfig.args = server.args;
        }
        if (server.env && Object.keys(server.env).length > 0) {
          serverConfig.env = server.env;
        }
        mcpServers[server.name] = serverConfig;
      }
    }

    return {
      mcpServers: mcpServers as MCPConfig['mcpServers'],
    };
  };

  const saveMCPConfig = async (serverList: MCPServerUI[]) => {
    const config = buildMcpConfig(
      serverList.filter((server) => !server.source || server.source === 'VibeWork')
    );

    let fileSaved = false;
    if (window.api?.fs?.writeTextFile) {
      try {
        const targetPath = await resolvePath(await getSaveConfigPath());
        if (targetPath) {
          await ensureParentDir(targetPath);
          await window.api.fs.writeTextFile(
            targetPath,
            JSON.stringify(config, null, 2)
          );
          fileSaved = true;
        }
      } catch (err) {
        console.error('[MCP] Failed to save MCP config to file:', err);
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/mcp/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to save config');
      }
    } catch (err) {
      if (!fileSaved) {
        console.error('[MCP] Failed to save MCP config via API:', err);
      }
    }
  };

  const handleExportToCli = async () => {
    if (!window.api?.fs?.writeTextFile) return;
    if (selectedCliTargets.length === 0) return;

    setExporting(true);
    try {
      const config = buildMcpConfig(
        appServers.filter((server) => !server.source || server.source === 'VibeWork')
      );

      for (const targetId of selectedCliTargets) {
        const group = exportableCliGroups.find((item) => item.id === targetId);
        if (!group) continue;
        const resolvedPath = await resolvePath(group.path);
        await ensureParentDir(resolvedPath);

        let payload: Record<string, unknown> = {};
        if (window.api?.fs?.exists && window.api?.fs?.readTextFile) {
          try {
            const exists = await window.api.fs.exists(resolvedPath);
            if (exists) {
              const content = await window.api.fs.readTextFile(resolvedPath);
              payload = JSON.parse(content) as Record<string, unknown>;
            }
          } catch (error) {
            console.warn('[MCP] Failed to read CLI config, overwriting:', error);
          }
        }

        payload.mcpServers = config.mcpServers;
        await window.api.fs.writeTextFile(
          resolvedPath,
          JSON.stringify(payload, null, 2)
        );
      }
    } catch (error) {
      console.error('[MCP] Failed to export MCP config to CLI:', error);
    } finally {
      setExporting(false);
      setShowExportDialog(false);
      setSelectedCliTargets([]);
    }
  };

  // Open folder in system file manager
  const openFolderInSystem = async (folderPath: string) => {
    try {
      const resolvedPath = await resolvePath(folderPath);
      await ensureDirectoryExists(resolvedPath);
      if (window.api?.shell?.openPath) {
        try {
          await window.api.shell.openPath(resolvedPath);
          return;
        } catch (error) {
          if (window.api?.shell?.showItemInFolder) {
            await window.api.shell.showItemInFolder(resolvedPath);
            return;
          }
          throw error;
        }
      }
      const response = await fetch(`${API_BASE_URL}/files/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: resolvedPath, expandHome: true }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('[MCP] Failed to open folder:', data.error);
      }
    } catch (err) {
      console.error('[MCP] Error opening folder:', err);
    }
  };

  const handleOpenMcpFolder = async () => {
    const path = await getSaveConfigPath();
    const folderPath = getDirectoryPath(path);
    if (!folderPath) return;
    await openFolderInSystem(folderPath);
  };

  // Handle import by JSON
  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJson);
      const mcpServers = parsed.mcpServers || parsed;

      if (!mcpServers || typeof mcpServers !== 'object') {
        console.error('[MCP] Invalid JSON format');
        return;
      }

      const newServers: MCPServerUI[] = [...appServers];

      for (const [name, config] of Object.entries(mcpServers)) {
        const cfg = config as Record<string, unknown>;
        const existingIndex = newServers.findIndex(
          (s) => s.name === name && s.source === 'VibeWork'
        );

        // Determine type: use explicit type if provided, otherwise default based on config
        let serverType: 'stdio' | 'http' | 'sse' = 'stdio';
        if (cfg.url) {
          serverType = (cfg.type as 'http' | 'sse') || 'http';
        }

        const serverData: MCPServerUI = {
          id: `VibeWork-${name}`,
          name,
          type: serverType,
          enabled: true,
          command: cfg.command as string | undefined,
          args: cfg.args as string[] | undefined,
          env: cfg.env as Record<string, string> | undefined,
          url: cfg.url as string | undefined,
          headers: cfg.headers as Record<string, string> | undefined,
          autoExecute: true,
          source: 'VibeWork',
        };

        if (existingIndex >= 0) {
          newServers[existingIndex] = serverData;
        } else {
          newServers.push(serverData);
        }
      }

      setAppServers(newServers);
      setAppError(null);
      saveMCPConfig(newServers);
      setShowImportDialog(false);
      setImportJson('');
    } catch (err) {
      console.error('[MCP] Failed to parse JSON:', err);
    }
  };

  const toggleCliTarget = (id: string) => {
    setSelectedCliTargets((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Helper to convert object to KeyValuePair array
  const objectToKeyValuePairs = (
    obj: Record<string, string> | undefined
  ): KeyValuePair[] => {
    if (!obj) return [];
    return Object.entries(obj).map(([key, value], index) => ({
      id: `kv-${Date.now()}-${index}`,
      key,
      value,
    }));
  };

  // Helper to convert KeyValuePair array to object
  const keyValuePairsToObject = (
    pairs: KeyValuePair[]
  ): Record<string, string> => {
    const obj: Record<string, string> = {};
    for (const pair of pairs) {
      if (pair.key.trim()) {
        obj[pair.key] = pair.value;
      }
    }
    return obj;
  };

  // Handle configure server (open config dialog for editing)
  const handleConfigureServer = (server: MCPServerUI) => {
    setConfigDialog({
      open: true,
      mode: 'edit',
      serverName: server.name,
      transportType: server.type,
      command: server.command || '',
      args: server.args || [],
      env: objectToKeyValuePairs(server.env),
      url: server.url || '',
      headers: objectToKeyValuePairs(server.headers),
      editServerId: server.id,
    });
  };

  const handleViewServer = (server: MCPServerUI) => {
    setConfigDialog({
      open: true,
      mode: 'view',
      serverName: server.name,
      transportType: server.type,
      command: server.command || '',
      args: server.args || [],
      env: objectToKeyValuePairs(server.env),
      url: server.url || '',
      headers: objectToKeyValuePairs(server.headers),
      editServerId: server.id,
    });
  };

  // Handle save config dialog
  const handleSaveConfigDialog = () => {
    if (configDialog.mode === 'view') return;
    if (!configDialog.serverName) return;

    const newServers = [...appServers];
    const headersObj = keyValuePairsToObject(configDialog.headers);
    const hasHeaders = Object.keys(headersObj).length > 0;
    const envObj = keyValuePairsToObject(configDialog.env);
    const hasEnv = Object.keys(envObj).length > 0;

    const isUrlType = configDialog.transportType !== 'stdio';

    if (configDialog.mode === 'edit' && configDialog.editServerId) {
      const index = newServers.findIndex(
        (s) => s.id === configDialog.editServerId
      );
      if (index >= 0) {
        newServers[index] = {
          ...newServers[index],
          name: configDialog.serverName,
          type: configDialog.transportType,
          command:
            configDialog.transportType === 'stdio'
              ? configDialog.command
              : undefined,
          args:
            configDialog.transportType === 'stdio'
              ? configDialog.args
              : undefined,
          env:
            configDialog.transportType === 'stdio' && hasEnv ? envObj : undefined,
          url: isUrlType ? configDialog.url : undefined,
          headers: isUrlType && hasHeaders ? headersObj : undefined,
        };
      }
    } else {
      const fullId = `VibeWork-${configDialog.serverName}`;
      if (
        newServers.some(
          (s) => s.id === fullId || s.name === configDialog.serverName
        )
      ) {
        console.error('[MCP] Server name already exists');
        return;
      }

      newServers.push({
        id: fullId,
        name: configDialog.serverName,
        type: configDialog.transportType,
        enabled: true,
        command:
          configDialog.transportType === 'stdio'
            ? configDialog.command
            : undefined,
        args:
          configDialog.transportType === 'stdio'
            ? configDialog.args
            : undefined,
        env:
          configDialog.transportType === 'stdio' && hasEnv ? envObj : undefined,
        url: isUrlType ? configDialog.url : undefined,
        headers: isUrlType && hasHeaders ? headersObj : undefined,
        autoExecute: true,
        source: 'VibeWork',
      });
    }

    setAppServers(newServers);
    setAppError(null);
    saveMCPConfig(newServers);
    setConfigDialog(initialConfigDialog);
  };

  // Handle delete server
  const handleDeleteServer = (serverId: string) => {
    const server = appServers.find((s) => s.id === serverId);
    if (!server || server.source !== 'VibeWork') return;

    const newServers = appServers.filter((s) => s.id !== serverId);
    setAppServers(newServers);
    saveMCPConfig(newServers);
  };

  // Argument handlers
  const handleAddArg = () => {
    setConfigDialog({
      ...configDialog,
      args: [...configDialog.args, ''],
    });
  };

  const handleUpdateArg = (index: number, value: string) => {
    const newArgs = [...configDialog.args];
    newArgs[index] = value;
    setConfigDialog({ ...configDialog, args: newArgs });
  };

  const handleRemoveArg = (index: number) => {
    const newArgs = configDialog.args.filter((_, i) => i !== index);
    setConfigDialog({ ...configDialog, args: newArgs });
  };

  // Env handlers
  const handleAddEnv = () => {
    setConfigDialog({
      ...configDialog,
      env: [
        ...configDialog.env,
        { id: `env-${Date.now()}`, key: '', value: '' },
      ],
    });
  };

  const handleUpdateEnv = (id: string, key: string, value: string) => {
    setConfigDialog({
      ...configDialog,
      env: configDialog.env.map((item) =>
        item.id === id ? { ...item, key, value } : item
      ),
    });
  };

  const handleRemoveEnv = (id: string) => {
    setConfigDialog({
      ...configDialog,
      env: configDialog.env.filter((item) => item.id !== id),
    });
  };

  // Header handlers
  const handleAddHeader = () => {
    setConfigDialog({
      ...configDialog,
      headers: [
        ...configDialog.headers,
        { id: `header-${Date.now()}`, key: '', value: '' },
      ],
    });
  };

  const handleUpdateHeader = (id: string, key: string, value: string) => {
    setConfigDialog({
      ...configDialog,
      headers: configDialog.headers.map((item) =>
        item.id === id ? { ...item, key, value } : item
      ),
    });
  };

  const handleRemoveHeader = (id: string) => {
    setConfigDialog({
      ...configDialog,
      headers: configDialog.headers.filter((item) => item.id !== id),
    });
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <>
      <div className="-m-6 flex h-[calc(100%+48px)] flex-col">
        {/* Tab Bar */}
        <div className="border-border shrink-0 border-b px-6">
          <div className="flex items-center gap-6">
          <button
            onClick={() => setMainTab('installed')}
            className={cn(
              'relative py-4 text-sm font-medium transition-colors',
              mainTab === 'installed'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.settings.mcpInstalled}
            {mainTab === 'installed' && (
              <span className="bg-foreground absolute bottom-0 left-0 h-0.5 w-full" />
            )}
          </button>
          <button
            onClick={() => setMainTab('cli')}
            className={cn(
              'relative py-4 text-sm font-medium transition-colors',
              mainTab === 'cli'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.settings.cli}
            {mainTab === 'cli' && (
              <span className="bg-foreground absolute bottom-0 left-0 h-0.5 w-full" />
            )}
          </button>
        </div>
      </div>

        {/* Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {mainTab === 'installed' ? (
            <div className="space-y-6 p-6">
              {/* MCP Config File */}
              <div className="border-border bg-background rounded-xl border p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-foreground text-sm font-medium">
                      {t.settings.mcpConfigPath}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                    <code className="bg-muted text-muted-foreground block min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                        {formatDisplayPath(settings?.mcpConfigPath || '~/.vibework/mcp/mcp.json')}
                    </code>
                      <button
                        onClick={() => {
                          void handleOpenMcpFolder();
                        }}
                        className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
                      >
                        <FolderOpen className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* Filter Bar */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.settings.mcpSearch}
                        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-9 w-64 rounded-lg border py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowExportDialog(true)}
                      disabled={exportableCliGroups.length === 0}
                    >
                      {t.settings.mcpExportToCli}
                    </Button>
                    {/* Add Button with Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="bg-foreground text-background hover:bg-foreground/90 flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors"
                        >
                          <Plus className="size-4" />
                          {t.common.add}
                          <ChevronDown className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[180px] rounded-xl p-1">
                        <DropdownMenuItem
                          onSelect={() => setShowImportDialog(true)}
                          className="gap-3 px-3 py-2"
                        >
                          <FileJson className="text-muted-foreground size-4 shrink-0" />
                          <span className="text-foreground text-sm">
                            {t.settings.mcpImportByJson}
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setConfigDialog({
                              ...initialConfigDialog,
                              open: true,
                            })
                          }
                          className="gap-3 px-3 py-2"
                        >
                          <Settings2 className="text-muted-foreground size-4 shrink-0" />
                          <span className="text-foreground text-sm">
                            {t.settings.mcpDirectConfig}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* MCP Grid */}
                <div>
                  {appError && filteredServers.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-red-500">
                      {appError}
                    </div>
                  ) : filteredServers.length === 0 ? (
                    <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                      {searchQuery
                        ? t.settings.mcpNoResults
                        : t.settings.mcpNoServers}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {filteredServers.map((server) => (
                        <MCPCard
                          key={server.id}
                          server={server}
                          onConfigure={() => handleConfigureServer(server)}
                          onDelete={() => handleDeleteServer(server.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* CLI Tab Content */
            <div className="space-y-4 p-6">
              {cliError && cliGroups.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-red-500">
                  {cliError}
                </div>
              ) : cliGroups.length === 0 ? (
                <div className="text-muted-foreground flex h-28 items-center justify-center rounded-xl border border-dashed border-border text-sm">
                  {t.settings.mcpCliEmpty}
                </div>
              ) : (
                <div className="space-y-4">
                  {cliGroups.map((group) => (
                    <div
                      key={group.id}
                      className="border-border bg-background rounded-xl border p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-foreground text-sm font-medium">
                              {group.label}
                            </h4>
                            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                              {group.servers.length} {t.settings.mcpServers}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <code className="bg-muted text-muted-foreground block min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                              {formatDisplayPath(group.path)}
                            </code>
                            <button
                              onClick={() => {
                                const folderPath =
                                  getDirectoryPath(group.path) || group.path;
                                void openFolderInSystem(folderPath);
                              }}
                              className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
                              title={t.settings.skillsOpenFolder}
                            >
                              <FolderOpen className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        {group.servers.length === 0 ? (
                          <div className="text-muted-foreground flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm">
                            {t.settings.mcpNoServers}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            {group.servers.map((server) => (
                              <MCPCard
                                key={server.id}
                                server={server}
                                readOnly
                                onClick={() => handleViewServer(server)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export Dialog - Using Radix Dialog */}
      <DialogPrimitive.Root
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60" />
          <DialogPrimitive.Content className="bg-background border-border fixed top-1/2 left-1/2 z-[100] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-6 shadow-2xl focus:outline-none">
            <DialogPrimitive.Title className="text-foreground text-lg font-semibold">
              {t.settings.mcpExportTitle}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-muted-foreground mt-2 text-sm">
              {t.settings.mcpExportDescription}
            </DialogPrimitive.Description>

            {exportableCliGroups.length === 0 ? (
              <div className="text-muted-foreground mt-4 text-sm">
                {t.settings.mcpExportEmpty}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCliTargets(
                      allCliSelected
                        ? []
                        : exportableCliGroups.map((group) => group.id)
                    )
                  }
                  className="text-primary mt-4 text-sm"
                >
                  {t.settings.mcpExportSelectAll}
                </button>

                <div className="border-border mt-3 max-h-56 overflow-y-auto rounded-lg border p-2">
                  {exportableCliGroups.map((group) => (
                    <label
                      key={group.id}
                      className="hover:bg-accent flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCliTargets.includes(group.id)}
                        onChange={() => toggleCliTarget(group.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground font-medium">
                          {group.label}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">
                          {group.path}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleExportToCli}
                  disabled={selectedCliTargets.length === 0 || exporting}
                  className="bg-foreground text-background hover:bg-foreground/90 mt-4 flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting ? t.settings.mcpExporting : t.settings.mcpExportApply}
                </button>
              </>
            )}

            <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-sm transition-opacity focus:outline-none">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Import Dialog - Using Radix Dialog */}
      <DialogPrimitive.Root
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60" />
          <DialogPrimitive.Content className="bg-background border-border fixed top-1/2 left-1/2 z-[100] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-6 shadow-2xl focus:outline-none">
            <DialogPrimitive.Title className="text-foreground text-lg font-semibold">
              {t.settings.mcpImportTitle}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-muted-foreground mt-2 text-sm">
              {t.settings.mcpImportDesc}
            </DialogPrimitive.Description>

            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder={t.settings.mcpImportPlaceholder}
              className="border-input bg-muted text-foreground placeholder:text-muted-foreground focus:ring-ring mt-4 h-64 w-full resize-none rounded-lg border p-3 font-mono text-sm focus:ring-2 focus:outline-none"
            />

            <button
              onClick={handleImportJson}
              disabled={!importJson.trim()}
              className="bg-foreground text-background hover:bg-foreground/90 mt-4 flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.settings.mcpImportButton}
            </button>

            <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-sm transition-opacity focus:outline-none">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Config Dialog - Using Radix Dialog */}
      <DialogPrimitive.Root
        open={configDialog.open}
        onOpenChange={(open) => {
          if (!open) setConfigDialog(initialConfigDialog);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60" />
          <DialogPrimitive.Content className="bg-background border-border fixed top-1/2 left-1/2 z-[100] flex max-h-[85vh] w-[500px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border shadow-2xl focus:outline-none">
            {/* Header */}
            <div className="border-border shrink-0 border-b px-6 py-4">
              <DialogPrimitive.Title className="text-foreground text-lg font-semibold">
                {t.settings.mcpConfigTitle}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-sm transition-opacity focus:outline-none">
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {/* Server Name */}
                <div>
                  <label className="text-foreground mb-2 block text-sm font-medium">
                    {t.settings.mcpServerName}
                  </label>
                  <input
                    type="text"
                    value={configDialog.serverName}
                    onChange={(e) =>
                      setConfigDialog({
                        ...configDialog,
                        serverName: e.target.value,
                      })
                    }
                    placeholder={t.settings.mcpServerNamePlaceholder}
                    disabled={isViewMode}
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>

                {/* Transport Type */}
                <div>
                  <label className="text-foreground mb-2 block text-sm font-medium">
                    {t.settings.mcpTransportType}
                  </label>
                  <select
                    value={configDialog.transportType}
                    onChange={(e) =>
                      setConfigDialog({
                        ...configDialog,
                        transportType: e.target.value as 'stdio' | 'http' | 'sse',
                      })
                    }
                    disabled={isViewMode}
                    className="border-input bg-background text-foreground focus:ring-ring h-10 w-full cursor-pointer rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="stdio">stdio</option>
                    <option value="http">http</option>
                    <option value="sse">sse</option>
                  </select>
                </div>

                {configDialog.transportType === 'stdio' ? (
                  /* Stdio config fields */
                  <>
                    {/* Command */}
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpCommand}
                      </label>
                      <input
                        type="text"
                        value={configDialog.command}
                        onChange={(e) =>
                          setConfigDialog({
                            ...configDialog,
                            command: e.target.value,
                          })
                        }
                        placeholder={t.settings.mcpCommandPlaceholder}
                        disabled={isViewMode}
                        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>

                    {/* Arguments */}
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpArguments}
                      </label>
                      <div className="space-y-2">
                        {configDialog.args.map((arg, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={arg}
                              onChange={(e) =>
                                handleUpdateArg(index, e.target.value)
                              }
                              placeholder={t.settings.mcpArgumentPlaceholder}
                              disabled={isViewMode}
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            {!isViewMode && (
                              <button
                                onClick={() => handleRemoveArg(index)}
                                className="text-muted-foreground hover:text-destructive flex size-10 items-center justify-center rounded-lg transition-colors"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {!isViewMode && (
                          <button
                            onClick={handleAddArg}
                            className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm"
                          >
                            <Plus className="size-4" />
                            {t.settings.mcpAddArgument}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Environment Variables */}
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpEnvVariables}
                      </label>
                      <div className="space-y-2">
                        {configDialog.env.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={item.key}
                              onChange={(e) =>
                                handleUpdateEnv(
                                  item.id,
                                  e.target.value,
                                  item.value
                                )
                              }
                              placeholder={t.settings.mcpEnvVariableName}
                              disabled={isViewMode}
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-32 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            <span className="text-muted-foreground">=</span>
                            <input
                              type="text"
                              value={item.value}
                              onChange={(e) =>
                                handleUpdateEnv(
                                  item.id,
                                  item.key,
                                  e.target.value
                                )
                              }
                              placeholder={t.settings.mcpEnvVariableValue}
                              disabled={isViewMode}
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            {!isViewMode && (
                              <button
                                onClick={() => handleRemoveEnv(item.id)}
                                className="text-muted-foreground hover:text-destructive flex size-10 items-center justify-center rounded-lg transition-colors"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {!isViewMode && (
                          <button
                            onClick={handleAddEnv}
                            className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm"
                          >
                            <Plus className="size-4" />
                            {t.settings.mcpAddEnvVariable}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* URL */}
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpServerUrl}
                      </label>
                      <input
                        type="text"
                        value={configDialog.url}
                        onChange={(e) =>
                          setConfigDialog({
                            ...configDialog,
                            url: e.target.value,
                          })
                        }
                        placeholder={configDialog.transportType === 'sse' ? t.settings.mcpServerUrlPlaceholderSse : t.settings.mcpServerUrlPlaceholder}
                        disabled={isViewMode}
                        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>

                    {/* Custom Headers */}
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        {t.settings.mcpCustomHeaders}{' '}
                        <span className="text-muted-foreground font-normal">
                          {t.settings.mcpCustomHeadersOptional}
                        </span>
                      </label>
                      <div className="space-y-2">
                        {configDialog.headers.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={item.key}
                              onChange={(e) =>
                                handleUpdateHeader(
                                  item.id,
                                  e.target.value,
                                  item.value
                                )
                              }
                              placeholder="Header Name"
                              disabled={isViewMode}
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-32 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            <span className="text-muted-foreground">=</span>
                            <input
                              type="text"
                              value={item.value}
                              onChange={(e) =>
                                handleUpdateHeader(
                                  item.id,
                                  item.key,
                                  e.target.value
                                )
                              }
                              placeholder="Value"
                              disabled={isViewMode}
                              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            {!isViewMode && (
                              <button
                                onClick={() => handleRemoveHeader(item.id)}
                                className="text-muted-foreground hover:text-destructive flex size-10 items-center justify-center rounded-lg transition-colors"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {!isViewMode && (
                          <button
                            onClick={handleAddHeader}
                            className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm"
                          >
                            <Plus className="size-4" />
                            {t.settings.mcpAddCustomHeader}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-border shrink-0 border-t px-6 py-4">
              {isViewMode ? (
                <DialogPrimitive.Close className="bg-foreground text-background hover:bg-foreground/90 flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors">
                  {t.common.close || 'Close'}
                </DialogPrimitive.Close>
              ) : (
                <button
                  onClick={handleSaveConfigDialog}
                  disabled={!configDialog.serverName}
                  className="bg-foreground text-background hover:bg-foreground/90 flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.settings.mcpSave}
                </button>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

import type { MCPServerStdio, MCPServerUI } from '@/components/settings/types';

export type MCPServerRecord = Record<
  string,
  MCPServerStdio | { url: string; headers?: Record<string, string>; type?: 'http' | 'sse' }
>;

export type MergedMcpServer = MCPServerUI & {
  scope: 'project' | 'global';
  overrides?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMcpServerStdio = (value: unknown): value is MCPServerStdio =>
  isRecord(value) && typeof value.command === 'string';

export const extractMcpServers = (value: unknown): MCPServerRecord => {
  if (!isRecord(value)) return {};
  const direct = (value as { mcpServers?: unknown; mcp_servers?: unknown }).mcpServers
    || (value as { mcpServers?: unknown; mcp_servers?: unknown }).mcp_servers;
  if (isRecord(direct)) {
    return direct as MCPServerRecord;
  }
  return {};
};

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

export const parseTomlMcpServers = (content: string): MCPServerRecord => {
  const parsed = parseToml(content);
  return extractMcpServers(parsed);
};

export const buildMcpServersFromConfig = (
  servers: MCPServerRecord,
  sourceName: string
): MCPServerUI[] => {
  const serverList: MCPServerUI[] = [];
  for (const [id, config] of Object.entries(servers)) {
    if (!isRecord(config)) continue;
    const cfg = config as Record<string, unknown>;
    const hasUrl = typeof cfg.url === 'string' && cfg.url.length > 0;
    const serverType: 'stdio' | 'http' | 'sse' = hasUrl
      ? ((cfg.type as 'http' | 'sse') || 'http')
      : 'stdio';
    const stdioConfig = !hasUrl && isMcpServerStdio(config) ? config : undefined;

    serverList.push({
      id: `${sourceName}-${id}`,
      name: id,
      type: serverType,
      enabled: true,
      command: stdioConfig?.command,
      args: stdioConfig?.args,
      env: stdioConfig?.env,
      url: hasUrl ? (cfg.url as string) : undefined,
      headers: hasUrl ? (cfg.headers as Record<string, string> | undefined) : undefined,
      autoExecute: true,
      source: sourceName,
    });
  }
  return serverList;
};

export const mergeMcpServers = (
  projectServers: MCPServerUI[],
  globalServers: MCPServerUI[]
): MergedMcpServer[] => {
  const globalMap = new Map<string, MCPServerUI>();
  for (const server of globalServers) {
    globalMap.set(server.name, server);
  }

  const merged: MergedMcpServer[] = [];
  for (const server of projectServers) {
    const overrides = globalMap.has(server.name);
    merged.push({
      ...server,
      scope: 'project',
      overrides,
    });
  }

  for (const server of globalServers) {
    if (projectServers.some((item) => item.name === server.name)) continue;
    merged.push({
      ...server,
      scope: 'global',
    });
  }

  return merged;
};

export const getProjectMcpConfigPath = (
  projectPath: string,
  cliId?: string
): string => {
  if (!projectPath) return projectPath;
  const normalized = projectPath.replace(/[\\/]+$/, '');
  const fileName = cliId ? `${cliId}.json` : 'mcp.json';
  return `${normalized}/.vibework/mcp/${fileName}`;
};

export const ensureParentDir = async (filePath: string): Promise<void> => {
  if (!filePath) return;
  const lastSeparator = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastSeparator <= 0) return;
  const dirPath = filePath.slice(0, lastSeparator);
  if (window.api?.fs?.mkdir) {
    await window.api.fs.mkdir(dirPath);
  }
};

export const getDirectoryPath = (filePath: string): string => {
  if (!filePath) return filePath;
  const lastSeparator = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastSeparator <= 0) return filePath;
  return filePath.slice(0, lastSeparator);
};

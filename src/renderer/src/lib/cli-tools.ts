export type CLIToolInstallState = 'unknown' | 'checking' | 'installed' | 'missing' | 'error';

export interface CLIToolInfo {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  installed?: boolean;
  installState?: CLIToolInstallState;
  configValid?: boolean;
  configState?: 'unknown' | 'valid' | 'missing';
  version?: string;
  installPath?: string;
}

const deriveInstallState = (tool: CLIToolInfo): CLIToolInstallState => {
  if (tool.installState) {
    return tool.installState;
  }
  if (tool.installed === true) {
    return 'installed';
  }
  if (tool.installed === false) {
    return 'missing';
  }
  return 'unknown';
};

export const normalizeCliTool = (tool: CLIToolInfo): CLIToolInfo => {
  const installState = deriveInstallState(tool);

  const installed =
    installState === 'installed'
      ? true
      : installState === 'missing' || installState === 'error'
        ? false
        : tool.installed;

  return {
    ...tool,
    installed,
    installState,
    configState: tool.configState ?? (tool.configValid ? 'valid' : 'unknown'),
  };
};

export const normalizeCliTools = (tools: unknown): CLIToolInfo[] => {
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools
    .filter(
      (tool): tool is CLIToolInfo =>
        Boolean(tool) && typeof tool === 'object' && typeof (tool as { id?: unknown }).id === 'string'
    )
    .map((tool) => normalizeCliTool(tool));
};

export const isCliToolInstalled = (tool: CLIToolInfo): boolean =>
  normalizeCliTool(tool).installState === 'installed';


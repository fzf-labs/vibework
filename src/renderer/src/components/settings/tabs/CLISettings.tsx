import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/providers/language-provider';
import { Terminal, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  const handleDefaultChange = (value: string) => {
    setDefaultCliToolId(value);
    onSettingsChange({ ...settings, defaultCliToolId: value });
  };

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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {t.settings?.cliDescription ||
            'Check whether Agent CLI tools are installed on this machine.'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadTools(true)}
          disabled={loading}
          className="shrink-0"
        >
          {loading
            ? t.settings?.cliDetecting || 'Detecting...'
            : t.settings?.cliRescan || 'Rescan'}
        </Button>
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
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <div className="bg-muted/40 text-muted-foreground hidden grid-cols-[minmax(180px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(220px,2fr)] gap-4 px-4 py-2 text-xs font-medium sm:grid">
            <span>{columnLabels.tool}</span>
            <span>{columnLabels.status}</span>
            <span>{columnLabels.version}</span>
            <span>{columnLabels.path}</span>
          </div>
          <div className="divide-border divide-y">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(180px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(220px,2fr)] sm:gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-muted/60 text-muted-foreground flex size-9 items-center justify-center rounded-md">
                    <Terminal className="size-4" />
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {tool.displayName}
                    </p>
                    <p className="text-muted-foreground text-xs font-mono">
                      {tool.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:block">
                  <span className="text-muted-foreground text-xs sm:hidden">
                    {columnLabels.status}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      tool.installed
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-600'
                    }`}
                  >
                    {tool.installed ? (
                      <Check className="size-3" />
                    ) : (
                      <AlertCircle className="size-3" />
                    )}
                    {statusLabel(tool.installed)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 sm:block">
                  <span className="text-muted-foreground text-xs sm:hidden">
                    {columnLabels.version}
                  </span>
                  <span className="text-foreground text-xs font-mono">
                    {tool.version || '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 sm:block">
                  <span className="text-muted-foreground text-xs sm:hidden">
                    {columnLabels.path}
                  </span>
                  <span className="text-foreground text-xs font-mono break-all">
                    {tool.installPath || '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tools.length === 0 && !error && (
        <div className="border-border rounded-lg border px-4 py-6 text-center text-sm">
          {t.settings?.cliEmpty || 'No CLI tools found.'}
        </div>
      )}
    </div>
  );
}

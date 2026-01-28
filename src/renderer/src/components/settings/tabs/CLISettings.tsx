import { useState } from 'react';
import { useLanguage } from '@/providers/language-provider';
import { Terminal, FolderOpen, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SettingsTabProps } from '../types';

export function CLISettings({ settings, onSettingsChange }: SettingsTabProps) {
  const { t } = useLanguage();
  const [validating, setValidating] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<
    Record<string, boolean | null>
  >({});

  const handleBrowse = async (field: 'claudeCodePath' | 'codexCliPath') => {
    try {
      const result = await window.api?.dialog?.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['*'] }],
      });
      if (result && !result.canceled && result.filePaths[0]) {
        onSettingsChange({ ...settings, [field]: result.filePaths[0] });
        setValidationResults((prev) => ({ ...prev, [field]: null }));
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
    }
  };

  const handleValidate = async (field: 'claudeCodePath' | 'codexCliPath') => {
    const path = settings[field];
    if (!path) return;

    setValidating(field);
    try {
      const result = await window.api?.fs?.exists?.(path);
      setValidationResults((prev) => ({ ...prev, [field]: !!result }));
    } catch {
      setValidationResults((prev) => ({ ...prev, [field]: false }));
    } finally {
      setValidating(null);
    }
  };

  const renderPathInput = (
    field: 'claudeCodePath' | 'codexCliPath',
    label: string,
    description: string
  ) => {
    const value = settings[field];
    const isValid = validationResults[field];
    const isValidating = validating === field;

    return (
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{label}</label>
        <p className="text-muted-foreground text-xs">{description}</p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                onSettingsChange({ ...settings, [field]: e.target.value });
                setValidationResults((prev) => ({ ...prev, [field]: null }));
              }}
              placeholder={t.settings?.enterPath || 'Enter path or browse...'}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring block h-10 w-full rounded-lg border px-3 pr-10 font-mono text-sm focus:border-transparent focus:ring-2 focus:outline-none"
            />
            {isValid !== null && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValid ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <AlertCircle className="size-4 text-red-500" />
                )}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBrowse(field)}
            className="shrink-0"
          >
            <FolderOpen className="mr-1 size-4" />
            {t.settings?.browse || 'Browse'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleValidate(field)}
            disabled={!value || isValidating}
            className="shrink-0"
          >
            {isValidating
              ? t.settings?.validating || 'Validating...'
              : t.settings?.validate || 'Validate'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          {t.settings?.cliDescription ||
            'Configure paths to CLI tools used by VibeWork.'}
        </p>
      </div>

      <div className="space-y-6">
        {/* Claude Code CLI */}
        <div className="border-border rounded-lg border p-4">
          <div className="mb-4 flex items-center gap-2">
            <Terminal className="text-primary size-5" />
            <h3 className="font-medium">Claude Code</h3>
          </div>
          {renderPathInput(
            'claudeCodePath',
            t.settings?.claudeCodePath || 'Claude Code Path',
            t.settings?.claudeCodePathDesc ||
              'Path to the Claude Code CLI executable. Leave empty to use system PATH.'
          )}
        </div>

        {/* Codex CLI */}
        <div className="border-border rounded-lg border p-4">
          <div className="mb-4 flex items-center gap-2">
            <Terminal className="text-primary size-5" />
            <h3 className="font-medium">Codex CLI</h3>
          </div>
          {renderPathInput(
            'codexCliPath',
            t.settings?.codexCliPath || 'Codex CLI Path',
            t.settings?.codexCliPathDesc ||
              'Path to the OpenAI Codex CLI executable. Leave empty to use system PATH.'
          )}
        </div>
      </div>
    </div>
  );
}

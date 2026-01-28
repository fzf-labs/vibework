import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/providers/language-provider';
import type { EditorType } from '@/data/settings';
import type { SettingsTabProps } from '../types';

interface EditorInfo {
  type: EditorType | 'other';
  name: string;
  path: string;
  command: string;
  available: boolean;
}

const DEFAULT_EDITOR_TYPE: EditorType = 'vscode';

export function EditorSettings({
  settings,
  onSettingsChange,
}: SettingsTabProps) {
  const { t } = useLanguage();
  const [editors, setEditors] = useState<EditorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const editorSettings = settings.editor ?? {
    editorType: DEFAULT_EDITOR_TYPE,
    customCommand: '',
  };

  const loadEditors = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await window.api?.editor?.getAvailable?.();
      if (Array.isArray(result)) {
        setEditors(result as EditorInfo[]);
      } else {
        setEditors([]);
      }
    } catch (err) {
      console.error('[EditorSettings] Failed to detect editors:', err);
      setEditors([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEditors();
  }, [loadEditors]);

  const availableEditors = useMemo(
    () => editors.filter((editor) => editor.available),
    [editors]
  );

  const selectedType = editorSettings.editorType;
  const selectedMissing =
    !loading &&
    selectedType !== 'custom' &&
    !availableEditors.some((editor) => editor.type === selectedType);

  const handleEditorTypeChange = (newType: EditorType) => {
    onSettingsChange({
      ...settings,
      editor: {
        ...editorSettings,
        editorType: newType,
      },
    });
  };

  const handleCustomCommandChange = (value: string) => {
    onSettingsChange({
      ...settings,
      editor: {
        ...editorSettings,
        customCommand: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {t.settings?.editorDescription ||
          'Choose the editor VibeWork uses to open files and projects.'}
      </p>

      <div className="flex flex-col gap-2">
        <label className="text-foreground block text-sm font-medium">
          {t.settings?.editorDefault || 'Default Editor'}
        </label>
        <select
          value={selectedType}
          onChange={(e) => handleEditorTypeChange(e.target.value as EditorType)}
          className="border-input bg-background text-foreground focus:ring-ring block h-10 w-full max-w-sm cursor-pointer rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
        >
          {selectedType !== 'custom' && selectedMissing && (
            <option value={selectedType}>
              {t.settings?.editorMissingOption ||
                `Unavailable (${selectedType})`}
            </option>
          )}
          {selectedType !== 'custom' && loading && (
            <option value={selectedType}>
              {t.settings?.editorDetecting || 'Detecting editors...'}
            </option>
          )}
          {selectedType !== 'custom' &&
            !loading &&
            availableEditors.length === 0 && (
              <option value={selectedType}>
                {t.settings?.editorEmpty || 'No editors detected'}
              </option>
            )}
          {availableEditors.map((editor) => (
            <option key={editor.type} value={editor.type}>
              {editor.name}
            </option>
          ))}
          <option value="custom">
            {t.settings?.editorCustomOption || 'Custom'}
          </option>
        </select>
        {error && (
          <p className="text-destructive text-sm">
            {t.settings?.editorDetectError ||
              'Unable to detect editors. You can still use a custom command.'}
          </p>
        )}
        {selectedMissing && (
          <p className="text-muted-foreground text-xs">
            {t.settings?.editorMissingHelper ||
              'The selected editor was not detected on this machine.'}
          </p>
        )}
      </div>

      {selectedType === 'custom' && (
        <div className="flex flex-col gap-2">
          <label className="text-foreground block text-sm font-medium">
            {t.settings?.editorCustomCommand || 'Custom Command'}
          </label>
          <input
            type="text"
            placeholder={
              t.settings?.editorCustomCommandPlaceholder || 'e.g., code'
            }
            value={editorSettings.customCommand}
            onChange={(e) => handleCustomCommandChange(e.target.value)}
            className="border-input bg-background text-foreground focus:ring-ring block h-10 w-full max-w-sm rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
          />
          <p className="text-muted-foreground text-sm">
            {t.settings?.editorCustomCommandDesc ||
              'Enter the command used to launch your editor.'}
          </p>
        </div>
      )}
    </div>
  );
}

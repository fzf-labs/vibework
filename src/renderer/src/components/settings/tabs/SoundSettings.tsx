import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  isAudioFileExtensionSupported,
  playSoundPreset,
  playSoundChoice,
  SOUND_PRESETS,
  type SoundPresetId,
} from '@/lib/notifications';
import { useLanguage } from '@/providers/language-provider';
import { Switch } from '../components/Switch';
import type { SettingsTabProps } from '../types';
import type { SoundChoice } from '@/data/settings';

export function SoundSettings({
  settings,
  onSettingsChange,
}: SettingsTabProps) {
  const { t } = useLanguage();
  const [fileError, setFileError] = useState<string | null>(null);
  const filePickerDisabled =
    typeof window === 'undefined' || !window.api?.dialog || !window.api?.fs;

  const normalizeChoice = (
    choice: SoundChoice | undefined,
    fallbackPreset: SoundPresetId
  ): SoundChoice => ({
    source: choice?.source === 'file' ? 'file' : 'preset',
    presetId: choice?.presetId || fallbackPreset,
    filePath: choice?.filePath || '',
  });

  const taskChoice = normalizeChoice(settings.taskCompleteSound, 'chime');
  const nodeChoice = normalizeChoice(settings.workNodeCompleteSound, 'pulse');

  const resolvePresetLabel = (presetId: SoundPresetId) => {
    switch (presetId) {
      case 'ding':
        return t.settings?.soundPresetDing || 'Ding';
      case 'pulse':
        return t.settings?.soundPresetPulse || 'Pulse';
      case 'silent':
        return t.settings?.soundPresetSilent || 'Silent';
      case 'chime':
      default:
        return t.settings?.soundPresetChime || 'Chime';
    }
  };

  const handleTaskSoundChange = (value: string) => {
    onSettingsChange({
      ...settings,
      taskCompleteSound: {
        ...taskChoice,
        source: 'preset',
        presetId: value as SoundPresetId,
      },
    });
  };

  const handleWorkNodeSoundChange = (value: string) => {
    onSettingsChange({
      ...settings,
      workNodeCompleteSound: {
        ...nodeChoice,
        source: 'preset',
        presetId: value as SoundPresetId,
      },
    });
  };

  const ensureElectron = () => {
    if (typeof window === 'undefined' || !window.api?.dialog || !window.api?.fs) {
      throw new Error(
        t.settings?.soundFileUnavailable || 'File picker is not available.'
      );
    }
  };

  const pickAudioFile = async () => {
    ensureElectron();
    const { dialog, fs } = await import('@/lib/electron-api');
    const filePath = await dialog.open({
      filters: [
        {
          name: t.settings?.soundFileFilterLabel || 'Audio',
          extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
        },
      ],
      multiple: false,
    });

    if (!filePath) return null;
    const path = filePath as string;
    if (!isAudioFileExtensionSupported(path)) {
      throw new Error(
        t.settings?.soundFileUnsupported ||
          'Unsupported audio format. Please choose a supported file.'
      );
    }

    await fs.readFile(path);
    return path;
  };

  const handleTaskFilePick = async () => {
    setFileError(null);
    try {
      const path = await pickAudioFile();
      if (!path) return;
      onSettingsChange({
        ...settings,
        taskCompleteSound: {
          ...taskChoice,
          source: 'file',
          filePath: path,
        },
      });
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleNodeFilePick = async () => {
    setFileError(null);
    try {
      const path = await pickAudioFile();
      if (!path) return;
      onSettingsChange({
        ...settings,
        workNodeCompleteSound: {
          ...nodeChoice,
          source: 'file',
          filePath: path,
        },
      });
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleTaskFileClear = () => {
    onSettingsChange({
      ...settings,
      taskCompleteSound: { ...taskChoice, source: 'preset', filePath: '' },
    });
  };

  const handleNodeFileClear = () => {
    onSettingsChange({
      ...settings,
      workNodeCompleteSound: { ...nodeChoice, source: 'preset', filePath: '' },
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-border rounded-lg border p-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t.settings?.soundTaskCompleteLabel ||
                    'Task completion sound'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t.settings?.soundTaskCompleteDesc ||
                    'Choose the sound for completed tasks.'}
                </p>
              </div>
              <Switch
                checked={settings.taskCompleteSoundEnabled}
                onChange={(enabled) =>
                  onSettingsChange({
                    ...settings,
                    taskCompleteSoundEnabled: enabled,
                  })
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={taskChoice.presetId}
              onChange={(e) => handleTaskSoundChange(e.target.value)}
              disabled={!settings.taskCompleteSoundEnabled}
              className="border-input bg-background text-foreground block h-10 w-full max-w-xs cursor-pointer rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {SOUND_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {resolvePresetLabel(preset.id)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => playSoundPreset(taskChoice.presetId)}
              disabled={!settings.taskCompleteSoundEnabled}
            >
              {t.settings?.soundPreview || 'Preview'}
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {t.settings?.soundCustomFileLabel || 'Custom file'}
            </p>
            <p className="text-muted-foreground text-xs">
              {t.settings?.soundCustomFileDesc ||
                'Use your own audio file for this alert.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTaskFilePick}
              disabled={filePickerDisabled || !settings.taskCompleteSoundEnabled}
            >
              {taskChoice.source === 'file'
                ? t.settings?.soundReplaceFile || 'Replace file'
                : t.settings?.soundChooseFile || 'Choose file'}
            </Button>
            {taskChoice.source === 'file' && taskChoice.filePath && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleTaskFileClear}
                disabled={filePickerDisabled || !settings.taskCompleteSoundEnabled}
              >
                {t.settings?.soundClearFile || 'Clear'}
              </Button>
            )}
            {taskChoice.source === 'file' && taskChoice.filePath && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void playSoundChoice(taskChoice)}
                disabled={filePickerDisabled || !settings.taskCompleteSoundEnabled}
              >
                {t.settings?.soundPreview || 'Preview'}
              </Button>
            )}
          </div>
          {taskChoice.source === 'file' && (
            <p className="text-muted-foreground text-xs">
              {t.settings?.soundSelectedFile || 'Selected file'}:{' '}
              {taskChoice.filePath || t.settings?.soundNoFile || 'None'}
            </p>
          )}
        </div>
      </div>

      <div className="border-border rounded-lg border p-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t.settings?.soundWorkNodeCompleteLabel ||
                    'Work node completion sound'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t.settings?.soundWorkNodeCompleteDesc ||
                    'Choose the sound for completed work nodes.'}
                </p>
              </div>
              <Switch
                checked={settings.workNodeCompleteSoundEnabled}
                onChange={(enabled) =>
                  onSettingsChange({
                    ...settings,
                    workNodeCompleteSoundEnabled: enabled,
                  })
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={nodeChoice.presetId}
              onChange={(e) => handleWorkNodeSoundChange(e.target.value)}
              disabled={!settings.workNodeCompleteSoundEnabled}
              className="border-input bg-background text-foreground block h-10 w-full max-w-xs cursor-pointer rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {SOUND_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {resolvePresetLabel(preset.id)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => playSoundPreset(nodeChoice.presetId)}
              disabled={!settings.workNodeCompleteSoundEnabled}
            >
              {t.settings?.soundPreview || 'Preview'}
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {t.settings?.soundCustomFileLabel || 'Custom file'}
            </p>
            <p className="text-muted-foreground text-xs">
              {t.settings?.soundCustomFileDesc ||
                'Use your own audio file for this alert.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNodeFilePick}
              disabled={filePickerDisabled || !settings.workNodeCompleteSoundEnabled}
            >
              {nodeChoice.source === 'file'
                ? t.settings?.soundReplaceFile || 'Replace file'
                : t.settings?.soundChooseFile || 'Choose file'}
            </Button>
            {nodeChoice.source === 'file' && nodeChoice.filePath && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNodeFileClear}
                disabled={filePickerDisabled || !settings.workNodeCompleteSoundEnabled}
              >
                {t.settings?.soundClearFile || 'Clear'}
              </Button>
            )}
            {nodeChoice.source === 'file' && nodeChoice.filePath && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void playSoundChoice(nodeChoice)}
                disabled={filePickerDisabled || !settings.workNodeCompleteSoundEnabled}
              >
                {t.settings?.soundPreview || 'Preview'}
              </Button>
            )}
          </div>
          {nodeChoice.source === 'file' && (
            <p className="text-muted-foreground text-xs">
              {t.settings?.soundSelectedFile || 'Selected file'}:{' '}
              {nodeChoice.filePath || t.settings?.soundNoFile || 'None'}
            </p>
          )}
        </div>
      </div>

      {fileError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-xs">
          {fileError}
        </div>
      )}

      <div className="text-muted-foreground text-xs">
        {t.settings?.soundAlertsNote ||
          'Sound playback may be blocked until you interact with the app.'}
      </div>
    </div>
  );
}

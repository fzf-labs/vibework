import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  isAudioFileExtensionSupported,
  playSoundChoice,
} from '@/lib/notifications';
import {
  RESOURCE_SOUNDS,
  DEFAULT_TASK_COMPLETE_SOUND_FILE,
  DEFAULT_WORKNODE_COMPLETE_SOUND_FILE,
  getResourceSoundPath,
} from '@/data/settings/sounds';
import { useLanguage } from '@/providers/language-provider';
import { Switch } from '../components/Switch';
import type { SettingsTabProps } from '../types';
import type { SoundChoice } from '@/data/settings';

const RESOURCE_SOUND_OPTIONS = RESOURCE_SOUNDS.map((sound) => ({
  value: getResourceSoundPath(sound.fileName),
  label: sound.label,
}));

const RESOURCE_SOUND_VALUE_SET = new Set(
  RESOURCE_SOUND_OPTIONS.map((option) => option.value)
);

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
    fallbackFile: string
  ): SoundChoice => {
    const hasFile = Boolean(choice?.filePath);
    return {
      source: 'file',
      presetId: choice?.presetId || 'chime',
      filePath: hasFile ? choice?.filePath || '' : getResourceSoundPath(fallbackFile),
    };
  };

  const taskChoice = normalizeChoice(
    settings.taskCompleteSound,
    DEFAULT_TASK_COMPLETE_SOUND_FILE
  );
  const nodeChoice = normalizeChoice(
    settings.workNodeCompleteSound,
    DEFAULT_WORKNODE_COMPLETE_SOUND_FILE
  );

  const handleTaskSoundChange = (pathValue: string) => {
    onSettingsChange({
      ...settings,
      taskCompleteSound: {
        ...taskChoice,
        source: 'file',
        filePath: pathValue,
      },
    });
  };

  const handleWorkNodeSoundChange = (pathValue: string) => {
    onSettingsChange({
      ...settings,
      workNodeCompleteSound: {
        ...nodeChoice,
        source: 'file',
        filePath: pathValue,
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
      taskCompleteSound: { ...taskChoice, source: 'file', filePath: taskSelectValue },
    });
  };

  const handleNodeFileClear = () => {
    onSettingsChange({
      ...settings,
      workNodeCompleteSound: { ...nodeChoice, source: 'file', filePath: nodeSelectValue },
    });
  };

  const resolveResourceSelectValue = (
    choice: SoundChoice,
    fallbackFile: string
  ): string => {
    if (choice.source === 'file' && RESOURCE_SOUND_VALUE_SET.has(choice.filePath)) {
      return choice.filePath;
    }
    return getResourceSoundPath(fallbackFile);
  };

  const taskSelectValue = resolveResourceSelectValue(
    taskChoice,
    DEFAULT_TASK_COMPLETE_SOUND_FILE
  );
  const nodeSelectValue = resolveResourceSelectValue(
    nodeChoice,
    DEFAULT_WORKNODE_COMPLETE_SOUND_FILE
  );
  const taskIsCustomFile =
    taskChoice.source === 'file' &&
    Boolean(taskChoice.filePath) &&
    !RESOURCE_SOUND_VALUE_SET.has(taskChoice.filePath);
  const nodeIsCustomFile =
    nodeChoice.source === 'file' &&
    Boolean(nodeChoice.filePath) &&
    !RESOURCE_SOUND_VALUE_SET.has(nodeChoice.filePath);

  return (
    <div className="space-y-6">
      <div className="border-border rounded-lg border p-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t.settings?.soundTaskCompleteLabel ||
                    'Task sound'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t.settings?.soundTaskCompleteDesc ||
                    'Choose the sound for tasks entering review.'}
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
              value={taskSelectValue}
              onChange={(e) => handleTaskSoundChange(e.target.value)}
              disabled={!settings.taskCompleteSoundEnabled}
              className="border-input bg-background text-foreground block h-10 w-full max-w-xs cursor-pointer rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {RESOURCE_SOUND_OPTIONS.map((sound) => (
                <option key={sound.value} value={sound.value}>
                  {sound.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void playSoundChoice({
                  ...taskChoice,
                  source: 'file',
                  filePath: taskSelectValue,
                })
              }
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
              {taskIsCustomFile
                ? t.settings?.soundReplaceFile || 'Replace file'
                : t.settings?.soundChooseFile || 'Choose file'}
            </Button>
            {taskIsCustomFile && (
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
            {taskIsCustomFile && (
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
          {taskIsCustomFile && (
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
                    'Work node sound'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t.settings?.soundWorkNodeCompleteDesc ||
                    'Choose the sound for work nodes entering review.'}
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
              value={nodeSelectValue}
              onChange={(e) => handleWorkNodeSoundChange(e.target.value)}
              disabled={!settings.workNodeCompleteSoundEnabled}
              className="border-input bg-background text-foreground block h-10 w-full max-w-xs cursor-pointer rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {RESOURCE_SOUND_OPTIONS.map((sound) => (
                <option key={sound.value} value={sound.value}>
                  {sound.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void playSoundChoice({
                  ...nodeChoice,
                  source: 'file',
                  filePath: nodeSelectValue,
                })
              }
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
              {nodeIsCustomFile
                ? t.settings?.soundReplaceFile || 'Replace file'
                : t.settings?.soundChooseFile || 'Choose file'}
            </Button>
            {nodeIsCustomFile && (
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
            {nodeIsCustomFile && (
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
          {nodeIsCustomFile && (
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

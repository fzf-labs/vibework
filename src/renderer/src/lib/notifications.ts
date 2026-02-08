import { getSettings, type SoundChoice, type SoundPresetId } from '@/data/settings';
import { RESOURCE_SOUND_PREFIX } from '@/data/settings/sounds';

export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export const SOUND_PRESETS: { id: SoundPresetId; defaultLabel: string }[] = [
  { id: 'chime', defaultLabel: 'Chime' },
  { id: 'ding', defaultLabel: 'Ding' },
  { id: 'pulse', defaultLabel: 'Pulse' },
  { id: 'silent', defaultLabel: 'Silent' },
];

const SOUND_PRESET_IDS = new Set(SOUND_PRESETS.map((preset) => preset.id));
const AUDIO_FILE_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
]);

const normalizePathSeparators = (value: string): string => value.replace(/\\/g, '/');

const resolveResourceSoundPath = async (filePath: string): Promise<string> => {
  const normalized = normalizePathSeparators(filePath);
  if (!normalized.startsWith(RESOURCE_SOUND_PREFIX)) {
    return filePath;
  }

  if (typeof window === 'undefined' || !window.api?.path || !window.api?.fs) {
    return filePath;
  }

  const candidates: string[] = [];
  try {
    const resourcesDir = await window.api.path.resourcesDir();
    if (resourcesDir) {
      candidates.push(`${normalizePathSeparators(resourcesDir)}/${normalized}`);
    }
  } catch {
    // Ignore path resolution errors
  }

  try {
    const appPath = await window.api.path.appPath();
    if (appPath) {
      candidates.push(`${normalizePathSeparators(appPath)}/${normalized}`);
    }
  } catch {
    // Ignore path resolution errors
  }

  for (const candidate of candidates) {
    try {
      if (await window.api.fs.exists(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore filesystem errors
    }
  }

  return filePath;
};

export const isElectronNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.api?.notification);
};

export const isBrowserNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const isDesktopNotificationSupported = (): boolean => {
  return isElectronNotificationSupported() || isBrowserNotificationSupported();
};

export const getNotificationPermissionState = (): NotificationPermissionState => {
  if (isElectronNotificationSupported()) return 'granted';
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission =
  async (): Promise<NotificationPermissionState> => {
    if (isElectronNotificationSupported()) return 'granted';
    if (!isBrowserNotificationSupported()) return 'unsupported';

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return Notification.permission || 'default';
    }
  };

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextRef =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextRef) return null;
  return new AudioContextRef();
};

const playToneSequence = (
  sequence: Array<{ frequency: number; duration: number }>,
  gapSeconds = 0.05
): number => {
  const audioContext = getAudioContext();
  if (!audioContext) return 0;

  try {
    let time = audioContext.currentTime;
    sequence.forEach(({ frequency, duration }) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.exponentialRampToValueAtTime(0.2, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        time + Math.max(duration, 0.05)
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(time);
      oscillator.stop(time + duration);

      time += duration + gapSeconds;
    });

    const totalDuration = time - audioContext.currentTime + 0.1;
    setTimeout(() => {
      audioContext.close().catch(() => undefined);
    }, Math.max(totalDuration * 1000, 100));
    return totalDuration;
  } catch {
    audioContext.close().catch(() => undefined);
    return 0;
  }
};

const resolvePresetId = (preset?: string): SoundPresetId => {
  if (preset && SOUND_PRESET_IDS.has(preset as SoundPresetId)) {
    return preset as SoundPresetId;
  }
  return 'chime';
};

export const playSoundPreset = (preset?: string): number => {
  const resolved = resolvePresetId(preset);
  if (resolved === 'silent') return 0;

  switch (resolved) {
    case 'ding':
      return playToneSequence([{ frequency: 740, duration: 0.28 }]);
    case 'pulse':
      return playToneSequence(
        [
          { frequency: 520, duration: 0.1 },
          { frequency: 520, duration: 0.1 },
          { frequency: 680, duration: 0.14 },
        ],
        0.04
      );
    case 'chime':
    default:
      return playToneSequence(
        [
          { frequency: 880, duration: 0.14 },
          { frequency: 1320, duration: 0.22 },
        ],
        0.06
      );
  }
};

const getAudioMimeType = (ext: string): string => {
  const normalized = ext.toLowerCase();
  switch (normalized) {
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'mp3':
    default:
      return 'audio/mpeg';
  }
};

const playAudioFile = async (filePath: string, waitForEnd = false): Promise<void> => {
  if (typeof window === 'undefined' || !window.api?.fs) return;

  const resolvedPath = await resolveResourceSoundPath(filePath);
  const ext = resolvedPath.split('.').pop()?.toLowerCase() || 'mp3';
  const mimeType = getAudioMimeType(ext);

  try {
    const data = await window.api.fs.readFile(resolvedPath);
    const blob = new Blob([data.slice().buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.src = '';
    };

    if (!waitForEnd) {
      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });
      await audio.play();
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      audio.play().catch(finish);
    });
  } catch {
    // Ignore file playback errors
  }
};

export const playSoundChoice = async (
  choice: SoundChoice,
  options: { waitForEnd?: boolean } = {}
): Promise<void> => {
  if (choice.source === 'file' && choice.filePath) {
    await playAudioFile(choice.filePath, options.waitForEnd === true);
    return;
  }

  const duration = playSoundPreset(choice.presetId);
  if (options.waitForEnd && duration > 0) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, duration * 1000);
    });
  }
};

export const isAudioFileExtensionSupported = (filePath: string): boolean => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return AUDIO_FILE_EXTENSIONS.has(ext);
};

export const showTaskCompleteNotification = async (
  taskTitle?: string
): Promise<void> => {
  const title = taskTitle?.trim() || '任务完成';
  const body = taskTitle
    ? `任务 "${taskTitle}" 已完成`
    : '任务已完成';

  if (isElectronNotificationSupported()) {
    try {
      await window.api.notification.show({
        title,
        body,
        urgency: 'normal',
        silent: true,
      });
    } catch {
      // Ignore notification errors
    }
    return;
  }

  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, { body });
  } catch {
    // Ignore notification errors
  }
};

export const showTaskNodeCompleteNotification = async (
  nodeName?: string
): Promise<void> => {
  const title = nodeName?.trim() || '任务节点完成';
  const body = nodeName ? `节点 "${nodeName}" 已完成` : '任务节点已完成';

  if (isElectronNotificationSupported()) {
    try {
      await window.api.notification.show({
        title,
        body,
        urgency: 'normal',
        silent: true,
      });
    } catch {
      // Ignore notification errors
    }
    return;
  }

  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, { body });
  } catch {
    // Ignore notification errors
  }
};

export const notifyTaskCompleted = async (taskTitle?: string): Promise<void> => {
  const settings = getSettings();

  if (!settings.taskCompleteNotificationsEnabled) return;

  const permissionState = getNotificationPermissionState();
  if (permissionState !== 'granted') return;

  await showTaskCompleteNotification(taskTitle);
};

export const notifyTaskNodeCompleted = async (nodeName?: string): Promise<void> => {
  const settings = getSettings();

  if (!settings.taskNodeCompleteNotificationsEnabled) return;

  const permissionState = getNotificationPermissionState();
  if (permissionState !== 'granted') return;

  await showTaskNodeCompleteNotification(nodeName);
};

export const playTaskReviewSound = async (): Promise<void> => {
  const settings = getSettings();
  if (!settings.taskCompleteSoundEnabled) return;
  await playSoundChoice(settings.taskCompleteSound);
};

export const playTaskNodeReviewSound = async (): Promise<void> => {
  const settings = getSettings();
  if (!settings.taskNodeCompleteSoundEnabled) return;
  void playSoundChoice(settings.taskNodeCompleteSound);
};

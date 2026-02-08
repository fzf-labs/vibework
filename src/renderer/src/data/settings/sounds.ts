import type { SoundChoice } from './types';

export interface ResourceSoundOption {
  id: string;
  fileName: string;
  label: string;
}

export const RESOURCE_SOUND_PREFIX = 'resources/sound/';

export const RESOURCE_SOUNDS: ResourceSoundOption[] = [
  { id: 'bell', fileName: 'bell.mp3', label: 'Bell' },
  { id: 'cat', fileName: 'cat.mp3', label: 'Cat' },
  { id: 'cow', fileName: 'cow.mp3', label: 'Cow' },
  { id: 'ding', fileName: 'ding.mp3', label: 'Ding' },
  { id: 'dog', fileName: 'dog.mp3', label: 'Dog' },
  { id: 'duang', fileName: 'duang.mp3', label: 'Duang' },
  { id: 'goat', fileName: 'goat.mp3', label: 'Goat' },
  { id: 'horse', fileName: 'horse.mp3', label: 'Horse' },
  { id: 'rooster', fileName: 'rooster.mp3', label: 'Rooster' },
];

export const getResourceSoundPath = (fileName: string): string =>
  `${RESOURCE_SOUND_PREFIX}${fileName}`;

export const DEFAULT_TASK_COMPLETE_SOUND_FILE = 'bell.mp3';
export const DEFAULT_TASK_NODE_COMPLETE_SOUND_FILE = 'ding.mp3';

export const DEFAULT_TASK_COMPLETE_SOUND: SoundChoice = {
  source: 'file',
  presetId: 'chime',
  filePath: getResourceSoundPath(DEFAULT_TASK_COMPLETE_SOUND_FILE),
};

export const DEFAULT_TASK_NODE_COMPLETE_SOUND: SoundChoice = {
  source: 'file',
  presetId: 'pulse',
  filePath: getResourceSoundPath(DEFAULT_TASK_NODE_COMPLETE_SOUND_FILE),
};


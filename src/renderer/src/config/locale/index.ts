import en from './messages/en';
import zh from './messages/zh';

export type Language = 'en-US' | 'zh-CN';

export const translations = {
  'en-US': en,
  'zh-CN': zh,
} as const;

export type TranslationKeys = typeof en;

// Helper function to get nested translation value by path
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): string {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Return the path if not found
    }
  }

  return typeof current === 'string' ? current : path;
}

// Get system language
export function getSystemLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en-US';

  const lang =
    navigator.language ||
    (navigator as { userLanguage?: string }).userLanguage ||
    'en-US';

  // Check if Chinese
  if (lang.startsWith('zh')) {
    return 'zh-CN';
  }

  return 'en-US';
}

// Re-export messages for direct access
export { en, zh };

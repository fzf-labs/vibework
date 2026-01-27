import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getNestedValue,
  getSystemLanguage,
  translations,
  type Language,
  type TranslationKeys,
} from '@/config/locale';
import { getSettings, saveSettings } from '@/data/settings';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  // Helper function for interpolation
  tt: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    const settings = getSettings();
    // If no language set, detect from system
    if (!settings.language || settings.language === '') {
      const systemLang = getSystemLanguage();
      // Save detected language
      saveSettings({ ...settings, language: systemLang });
      return systemLang;
    }
    return settings.language as Language;
  });

  // Get current translations
  const t = translations[language];

  // Translation function with interpolation support
  const tt = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(t as Record<string, unknown>, key);

      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          value = value.replace(`{${paramKey}}`, String(paramValue));
        });
      }

      return value;
    },
    [t]
  );

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    const settings = getSettings();
    saveSettings({ ...settings, language: newLang });
  }, []);

  // Update document lang attribute
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tt }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Shorthand hook for just translations
export function useTranslation() {
  const { t, tt } = useLanguage();
  return { t, tt };
}

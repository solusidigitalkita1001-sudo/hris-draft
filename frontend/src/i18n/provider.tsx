import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { appConfig } from '@/config/app';
import {
  defaultLanguage,
  translations,
  type Language,
  type TranslationKey,
  type TranslationParams,
} from './translations';

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: TranslationParams) {
  if (!params) return template;

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.split(`{{${key}}}`).join(String(value));
  }, template);
}

function resolveInitialLanguage(): Language {
  if (typeof window === 'undefined') return defaultLanguage;

  const storedLanguage = localStorage.getItem(appConfig.languageKey);
  if (storedLanguage === 'id' || storedLanguage === 'en') {
    return storedLanguage;
  }

  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith('id')) {
    return 'id';
  }

  return defaultLanguage;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(resolveInitialLanguage);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(appConfig.languageKey, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => setLanguageState(nextLanguage),
      t: (key, params) => {
        const template = translations[language][key] || translations[defaultLanguage][key] || key;
        return interpolate(template, params);
      },
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return context;
}

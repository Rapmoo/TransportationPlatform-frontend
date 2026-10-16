import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations, DEFAULT_LANGUAGE } from './translations';

const LanguageContext = createContext(null);

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [language]);

  const value = useMemo(() => {
    const dict = translations[language] || translations[DEFAULT_LANGUAGE];

    function t(key) {
      const value = getByPath(dict, key);
      if (value !== undefined) return value;

      // Never fall back to another language. A missing translation must not
      // cause English text to appear inside an Amharic or Afaan Oromo page.
      if (import.meta.env?.DEV) {
        console.warn(`[i18n] Missing ${language} translation for: ${key}`);
      }
      return '';
    }

    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
import { useMemo, useState } from 'react';
import { translations, DEFAULT_LANGUAGE } from './translations';
import { LanguageContext } from './LanguageContext';

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  const value = useMemo(() => {
    const dict = translations[language] || translations[DEFAULT_LANGUAGE];
    const fallbackDict = translations[DEFAULT_LANGUAGE];

    function t(key) {
      const val = getByPath(dict, key);
      if (val !== undefined) return val;
      const fallback = getByPath(fallbackDict, key);
      return fallback !== undefined ? fallback : key;
    }

    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
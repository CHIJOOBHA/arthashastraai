import { useCallback, useEffect, useState } from 'react';
import { SUPPORTED_LANGUAGES } from '../translations';

const KEY = 'arthashastra_language';
const isSupported = (code: string | null): code is string => !!code && SUPPORTED_LANGUAGES.some((l) => l.code === code);

/** Saved language code, or 'en'. Never throws (storage may be blocked). */
export function readStoredLanguage(): string {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (isSupported(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

/** English name sent to the server ("Telugu", "Spanish"…). */
export function languageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || 'English';
}

/** Language code persisted in localStorage, also reflected in <html lang>. */
export function useLanguage(): [string, (code: string) => void] {
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((code: string) => {
    if (!isSupported(code)) return;
    setLanguageState(code);
    try {
      window.localStorage.setItem(KEY, code);
    } catch {
      /* storage unavailable: keep the choice for this session only */
    }
  }, []);

  return [language, setLanguage];
}

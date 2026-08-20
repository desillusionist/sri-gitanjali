/**
 * Паломнический свиток: локаль — часть тихой инфраструктуры, готовой принять
 * дополнительные словари без изменения компонента чтения.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultLocale, translations, type Copy, type Locale } from "./catalog";

const LANGUAGE_STORAGE_KEY = "kirtan-guide.locale";

type LanguageState = {
  locale: Locale;
  copy: Copy;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageState | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored && stored in translations ? (stored as Locale) : defaultLocale;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, copy: translations[locale], setLocale }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useTranslation must be used within LanguageProvider.");
  return value;
}

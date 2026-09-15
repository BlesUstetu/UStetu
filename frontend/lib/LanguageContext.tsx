"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Language } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/* USTETU production UI is English-only. The translation catalog remains
   available for future localization, but the live application always uses EN. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    setLanguageState("en");
    window.localStorage.setItem("ustetu-language", "en");
    window.dispatchEvent(new Event("ustetu-language-change"));
  }, []);

  const setLanguage = (_next: Language) => {
    setLanguageState("en");
    window.localStorage.setItem("ustetu-language", "en");
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key: string) => translations.en[key] ?? key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

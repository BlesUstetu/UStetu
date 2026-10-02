"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getInitialLanguage, translations, type Language } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    setLanguageState(getInitialLanguage());
    const onLanguageChange = () => setLanguageState(getInitialLanguage());
    window.addEventListener("ustetu-language-change", onLanguageChange);
    return () => window.removeEventListener("ustetu-language-change", onLanguageChange);
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem("ustetu-language", next);
    window.dispatchEvent(new Event("ustetu-language-change"));
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key: string) => translations[language][key] ?? translations.en[key] ?? key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Language } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/* English is the default/fallback language. Users can switch to any
   language available in the translation catalog from the language control. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    setLanguageState("en");
    window.localStorage.setItem("ustetu-language", "en");

    const onLanguageChange = () => {
      setLanguageState("en");
    };

    window.addEventListener("ustetu-language-change", onLanguageChange);
    return () => window.removeEventListener("ustetu-language-change", onLanguageChange);
  }, []);

  const setLanguage = (_next: Language) => {
    // USTETU frontend is English-only.
    setLanguageState("en");
    window.localStorage.setItem("ustetu-language", "en");
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

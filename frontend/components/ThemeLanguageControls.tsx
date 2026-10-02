"use client";

import { useEffect, useRef, useState } from "react";
import { languages, type Language } from "@/lib/i18n";
import { useLanguage } from "@/lib/LanguageContext";

export default function ThemeLanguageControls() {
  const { language, setLanguage, t } = useLanguage();
  const [dark, setDark] = useState(true);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("ustetu-theme");
    const isDark = savedTheme ? savedTheme === "dark" : true;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";

    const close = (event: MouseEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) {
        setLanguageOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("ustetu-theme", next ? "dark" : "light");
  }

  return (
    <div className="header-controls">
      <div className="language-control" ref={languageRef}>
        <button
          type="button"
          className="language-trigger"
          aria-label={t("language")}
          aria-expanded={languageOpen}
          onClick={() => setLanguageOpen((open) => !open)}
        >
          <span className="language-globe" aria-hidden="true">◎</span>
          <span className="language-code">{language.toUpperCase()}</span>
          <span className={`language-chevron${languageOpen ? " is-open" : ""}`} aria-hidden="true">⌄</span>
        </button>

        {languageOpen && (
          <div className="language-options" role="listbox" aria-label={t("language")}>
            {(Object.keys(languages) as Language[]).map((code) => (
              <button
                key={code}
                type="button"
                className={`language-option${language === code ? " is-active" : ""}`}
                onClick={() => {
                  setLanguage(code);
                  setLanguageOpen(false);
                }}
              >
                <span>{code.toUpperCase()}</span>
                <small>{languages[code]}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="icon-button"
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        title={dark ? "Light mode" : "Dark mode"}
        onClick={toggleTheme}
      >
        {dark ? "☀" : "☾"}
      </button>
    </div>
  );
}

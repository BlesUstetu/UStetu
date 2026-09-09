"use client";

import { useEffect, useState } from "react";
import { languages, translations, getInitialLanguage, type Language } from "@/lib/i18n";

export default function ThemeLanguageControls() {
  const [dark, setDark] = useState(true);
  const [language, setLanguage] = useState<Language>("en");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLanguage(getInitialLanguage());
    const savedTheme = window.localStorage.getItem("ustetu-theme");
    const isDark = savedTheme ? savedTheme === "dark" : true;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("ustetu-theme", next ? "dark" : "light");
  }

  function changeLanguage(next: Language) {
    setLanguage(next);
    window.localStorage.setItem("ustetu-language", next);
    setOpen(false);
  }

  const t = translations[language];

  return (
    <div className="header-controls">
      <button
        type="button"
        className="icon-button"
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        title={dark ? "Light mode" : "Dark mode"}
        onClick={toggleTheme}
      >
        {dark ? "☀" : "☾"}
      </button>

      <div className="language-wrap">
        <button
          type="button"
          className="icon-button"
          aria-label={t.language}
          aria-expanded={open}
          title={t.language}
          onClick={() => setOpen((value) => !value)}
        >
          ◉
        </button>

        {open && (
          <div className="language-menu">
            {Object.entries(languages).map(([code, label]) => (
              <button
                type="button"
                className={`language-option ${language === code ? "active" : ""}`}
                key={code}
                onClick={() => changeLanguage(code as Language)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

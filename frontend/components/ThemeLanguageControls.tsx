"use client";

import { useEffect, useState } from "react";
import { languages, getInitialLanguage, type Language } from "@/lib/i18n";
import { useLanguage } from "@/lib/LanguageContext";

export default function ThemeLanguageControls() {
  const [dark, setDark] = useState(true);
  const [open, setOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("ustetu-theme");
    const isDark = savedTheme ? savedTheme === "dark" : true;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    const initial = getInitialLanguage();
    if (initial !== language) setLanguage(initial);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("ustetu-theme", next ? "dark" : "light");
  }

  return (
    <div className="header-controls">
      <button type="button" className="icon-button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
        {dark ? "☀" : "☾"}
      </button>
      <div className="language-wrap">
        <button type="button" className="icon-button" aria-label={t("language")} aria-expanded={open} title={t("language")} onClick={() => setOpen((value) => !value)}>◉</button>
        {open && (
          <div className="language-menu">
            {Object.entries(languages).map(([code, label]) => (
              <button type="button" className={`language-option ${language === code ? "active" : ""}`} key={code} onClick={() => { setLanguage(code as Language); setOpen(false); }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { languages, type Language } from "@/lib/i18n";
import { useLanguage } from "@/lib/LanguageContext";

export default function ThemeLanguageControls() {
  const { language, setLanguage, t } = useLanguage();
  const [dark, setDark] = useState(true);

  useEffect(() => {
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

  return (
    <div className="header-controls">
      <label className="language-control" title={t("language")}>
        <span aria-hidden="true">◎</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
          aria-label={t("language")}
        >
          {Object.entries(languages).map(([code]) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </label>
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

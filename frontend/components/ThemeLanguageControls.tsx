"use client";

import { useEffect, useState } from "react";

export default function ThemeLanguageControls() {
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

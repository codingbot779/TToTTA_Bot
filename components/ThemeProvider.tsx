"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { applyTheme, parseTheme, readTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let current = readTheme();
    const sync = (value: ThemePreference) => {
      current = value;
      setTheme(value);
      applyTheme(value, media.matches);
    };
    sync(current);
    const onSystemChange = () => applyTheme(current, media.matches);
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) sync(readTheme());
    };
    const onPreferenceChange = (event: Event) => {
      sync(parseTheme((event as CustomEvent<string>).detail));
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("ttota:theme-change", onPreferenceChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ttota:theme-change", onPreferenceChange);
    };
  }, []);

  const setPreference = (value: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // 저장이 차단되어도 현재 탭의 테마 변경은 허용한다.
    }
    window.dispatchEvent(new CustomEvent("ttota:theme-change", { detail: value }));
  };

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function ThemeControl() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeControl은 ThemeProvider 안에서 사용해야 합니다.");

  return (
    <div role="group" aria-label="테마 설정" className="inline-flex shrink-0 rounded-full border border-border bg-surface p-1 text-xs">
      {([
        ["system", "시스템"],
        ["light", "라이트"],
        ["dark", "다크"],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme.preference === value}
          onClick={() => theme.setPreference(value)}
          className={`min-h-9 rounded-full px-3 transition ${
            theme.preference === value ? "bg-foreground text-background" : "text-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

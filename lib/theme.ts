export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "ttota:theme";

export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function readTheme(): ThemePreference {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function applyTheme(preference: ThemePreference, systemDark: boolean) {
  document.documentElement.dataset.theme = preference === "system"
    ? (systemDark ? "dark" : "light")
    : preference;
}

// 첫 페인트 전에 저장된 설정을 적용해 라이트/다크 화면 깜빡임을 줄인다.
// 저장소 접근이 차단되어도 시스템 테마는 적용한다.
export const THEME_INIT_SCRIPT = `(() => {
  let theme = "system";
  try {
    const saved = localStorage.getItem("${THEME_STORAGE_KEY}");
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {}
  document.documentElement.dataset.theme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
})();`;

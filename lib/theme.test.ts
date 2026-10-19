import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { applyTheme, parseTheme, readTheme, THEME_INIT_SCRIPT, type ThemePreference } from "./theme";

for (const value of [null, "", "invalid", "system", "light", "dark"]) {
  test(`테마 설정 정규화: ${String(value)}`, () => {
    assert.equal(parseTheme(value), value === "light" || value === "dark" ? value : "system");
  });
}

for (const preference of ["system", "light", "dark"] as ThemePreference[]) {
  for (const systemDark of [false, true]) {
    test(`초기 스크립트: ${preference}, 시스템 dark=${systemDark}`, () => {
      const document = { documentElement: { dataset: { theme: "" } } };
      runInNewContext(THEME_INIT_SCRIPT, {
        document,
        localStorage: { getItem: () => preference },
        window: { matchMedia: () => ({ matches: systemDark }) },
      });
      assert.equal(document.documentElement.dataset.theme,
        preference === "system" ? (systemDark ? "dark" : "light") : preference);
    });
  }
}

test("저장소 차단 시 초기 스크립트는 시스템 설정 사용", () => {
  const document = { documentElement: { dataset: { theme: "" } } };
  runInNewContext(THEME_INIT_SCRIPT, {
    document,
    localStorage: { getItem: () => { throw new Error("Blocked"); } },
    window: { matchMedia: () => ({ matches: true }) },
  });
  assert.equal(document.documentElement.dataset.theme, "dark");
});

test("런타임 테마 적용 및 저장소 접근 실패 처리", () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const document = { documentElement: { dataset: { theme: "" } } };
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: document });
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      localStorage: { getItem: () => "light" },
    } });
    assert.equal(readTheme(), "light");
    for (const preference of ["system", "light", "dark"] as ThemePreference[]) {
      for (const systemDark of [false, true]) {
        applyTheme(preference, systemDark);
        assert.equal(document.documentElement.dataset.theme,
          preference === "system" ? (systemDark ? "dark" : "light") : preference);
      }
    }
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      localStorage: { getItem: () => { throw new Error("Blocked"); } },
    } });
    assert.equal(readTheme(), "system");
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

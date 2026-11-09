export const appearanceStorageKey = "wishful-appearance";
export const appearanceChangeEvent = "wishful-appearance-change";
export const defaultAppearance = "light:blue";

export const accentOptions = [
  { value: "blue", label: "Sky blue", color: "#5b8cc5" },
  { value: "violet", label: "Violet", color: "#8662b5" },
  { value: "teal", label: "Teal", color: "#368f91" },
  { value: "rose", label: "Rose", color: "#c5657b" },
  { value: "amber", label: "Amber", color: "#b47b28" },
] as const;

export type ThemeMode = "light" | "dark";
export type AccentName = (typeof accentOptions)[number]["value"];

export function getAppearanceSnapshot() {
  try {
    return window.localStorage.getItem(appearanceStorageKey) ?? defaultAppearance;
  } catch {
    return defaultAppearance;
  }
}

export function getServerAppearanceSnapshot() {
  return defaultAppearance;
}

export function subscribeToAppearance(callback: () => void) {
  window.addEventListener(appearanceChangeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(appearanceChangeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function parseAppearance(value: string): { mode: ThemeMode; accent: AccentName } {
  const [mode, accent] = value.split(":");
  return {
    mode: mode === "dark" ? "dark" : "light",
    accent: accentOptions.some((option) => option.value === accent)
      ? (accent as AccentName)
      : "blue",
  };
}

export function saveAppearance(mode: ThemeMode, accent: AccentName) {
  window.localStorage.setItem(appearanceStorageKey, `${mode}:${accent}`);
  window.dispatchEvent(new Event(appearanceChangeEvent));
}

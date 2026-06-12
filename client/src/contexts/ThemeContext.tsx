import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "AUTO_SYSTEM" | "LIGHT" | "DARK" | "OBSCURE";
export type ResolvedTheme = Exclude<ThemeMode, "AUTO_SYSTEM">;

interface ThemeContextType {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
}

const storageKey = "razon.theme";
const themeModes: readonly ThemeMode[] = ["AUTO_SYSTEM", "LIGHT", "DARK", "OBSCURE"];
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return Boolean(value && themeModes.includes(value as ThemeMode));
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "DARK";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "LIGHT" : "DARK";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "AUTO_SYSTEM") return systemTheme();
  return mode;
}

function readStoredTheme(defaultTheme: ThemeMode): ThemeMode {
  if (typeof window === "undefined") return defaultTheme;
  const stored = window.localStorage.getItem(storageKey);
  return isThemeMode(stored) ? stored : defaultTheme;
}

function applyTheme(mode: ThemeMode, resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.razonThemePreference = mode;
  root.dataset.razonTheme = resolvedTheme.toLowerCase();
  root.classList.toggle("dark", resolvedTheme !== "LIGHT");
  root.style.colorScheme = resolvedTheme === "LIGHT" ? "light" : "dark";

  const themeMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
  if (themeMeta) {
    themeMeta.content =
      resolvedTheme === "LIGHT"
        ? "#f5f7f5"
        : resolvedTheme === "OBSCURE"
          ? "#020303"
          : "#0d0f11";
  }
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
}

export function ThemeProvider({
  children,
  defaultTheme = "AUTO_SYSTEM",
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredTheme(defaultTheme));
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredTheme(defaultTheme)));

  useLayoutEffect(() => {
    const nextResolved = resolveTheme(mode);
    setResolvedTheme(nextResolved);
    applyTheme(mode, nextResolved);
  }, [mode]);

  useEffect(() => {
    if (mode !== "AUTO_SYSTEM") return undefined;

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const syncSystemTheme = () => {
      const nextResolved = resolveTheme("AUTO_SYSTEM");
      setResolvedTheme(nextResolved);
      applyTheme("AUTO_SYSTEM", nextResolved);
    };

    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [mode]);

  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    setMode(nextMode);
    window.localStorage.setItem(storageKey, nextMode);
  }, []);

  const value = useMemo(
    () => ({ mode, resolvedTheme, setThemeMode }),
    [mode, resolvedTheme, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export const availableThemeModes = themeModes;

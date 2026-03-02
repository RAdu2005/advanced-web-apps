import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (nextTheme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "docshare-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    const darkEnabled = theme === "dark";

    root.classList.toggle("dark", darkEnabled);
    root.style.colorScheme = darkEnabled ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light"))
    }),
    [theme]
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

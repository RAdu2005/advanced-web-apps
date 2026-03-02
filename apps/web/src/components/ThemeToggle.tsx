import { useTheme } from "../context/ThemeContext";

//Toggle for light/dark modes
export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-4 top-4 z-50 rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow backdrop-blur transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-700"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}

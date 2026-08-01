import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ theme: "light", toggleTheme: () => {} });

/**
 * Single source of truth for CRM appearance.
 * Theme is the user's explicit choice (localStorage).
 * Never follow the browser OS color preference after first paint — that caused
 * mixed light/dark chrome on pages like the video lesson.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return "light";
  });

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
      html.style.colorScheme = "dark";
    } else {
      html.classList.remove("dark");
      html.style.colorScheme = "light";
    }
    localStorage.setItem("theme", theme);

    const themeColor = theme === "dark" ? "#1A1212" : "#8B1A1A";
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
      el.setAttribute("content", themeColor);
    });
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

import { useState, useEffect } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Check localStorage for saved theme - default to light mode for new users
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    
    const initialTheme = savedTheme || "light";
    setTheme(initialTheme);
    updateDOM(initialTheme);
  }, []);

  const updateDOM = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    updateDOM(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return {
    theme,
    toggleTheme,
    setTheme: (newTheme: Theme) => {
      setTheme(newTheme);
      updateDOM(newTheme);
      localStorage.setItem("theme", newTheme);
    },
  };
}
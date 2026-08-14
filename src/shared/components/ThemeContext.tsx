"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Toaster } from 'sonner';

type Theme = 'light' | 'dark';
interface ThemeContextType { theme: Theme; toggleTheme: () => void; }
interface BaseProps { children: React.ReactNode; }

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<BaseProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  /**
   * Cross-fades colours on the way between themes.
   *
   * The class is only on the document for the length of the fade: a standing
   * `transition` on every element would also animate hovers, menu opens, and
   * anything else that happens to change a colour.
   */
  const toggleTheme = () => {
    const root = window.document.documentElement;
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 220);
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
      <Toaster
        theme={theme}
        closeButton
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgb(37 99 235)',
            color: 'white',
            border: 'none',
            borderRadius: '1rem',
          },
          className: "font-sans font-medium",
        }}
      />
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Toaster } from 'sonner';

type Theme = 'light' | 'dark';
interface ThemeContextType { theme: Theme; toggleTheme: () => void; }
interface BaseProps { children: React.ReactNode; }

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * The class on <html> is the theme, not this module's state.
 *
 * The inline script in the root layout puts it there before the first paint, so
 * reading it back is both what survives a reload and what keeps a second click
 * correct.
 */
const readTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export const ThemeProvider: React.FC<BaseProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');
  /** The theme a switch in flight is heading for, before the DOM says so. */
  const heading = useRef<Theme | null>(null);

  // Adopt what the layout script already applied. This used to be a pair of
  // effects that read localStorage and then wrote the class from `theme` — and
  // the write ran first with the mount default ('light', the only thing the
  // server can render), painting over the script's choice before correcting
  // itself a render later.
  useEffect(() => {
    setTheme(readTheme());
  }, []);

  /**
   * Switches theme as one cross-fade of the whole page.
   *
   * A view transition: the browser takes a picture of the page as it is, the swap is made
   * underneath it, and it fades to a picture of the result. That is two pictures and one
   * animation on the compositor, wherever the page is heavy.
   *
   * This used to give every element on the page its own colour transition for 160ms — two
   * thousand and more of them at once. Each had to be restyled and animated on the main
   * thread, so the click froze the page for a tenth of a second or more before the fade began,
   * and the colours that cannot transition (every gradient) snapped while everything else
   * slowly faded. The React update was also deferred a frame, so the parts of the page painted
   * from `theme` in JS changed after the rest.
   *
   * The swap is the class on <html> (which most of the page is styled from) and the React
   * state (which the rest is painted from), flushed together so both are in the picture it
   * fades to. A browser with no view transitions, or a visitor who asked for less motion,
   * gets the same swap with no fade.
   */
  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    // From the switch already under way, if there is one: its class is not on the page until
    // the browser has taken its first picture, so two quick clicks would both read the old one
    // and be one switch.
    const next: Theme = (heading.current ?? readTheme()) === 'dark' ? 'light' : 'dark';
    heading.current = next;

    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode / storage disabled: the theme just does not persist.
    }

    const swap = () => {
      root.classList.remove('light', 'dark');
      root.classList.add(next);
      flushSync(() => setTheme(next));
      if (heading.current === next) heading.current = null;
    };

    const start = document.startViewTransition?.bind(document);
    const lessMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!start || lessMotion) {
      swap();
      return;
    }

    // `.theme-switching` only for the length of the fade: it tunes the transition's timing in
    // globals.css, and the language switch's own view transition keeps the browser's default.
    root.classList.add('theme-switching');
    const transition = start(swap);
    const done = () => root.classList.remove('theme-switching');
    void transition.finished.then(done, done);
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
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

"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from 'sonner';

type Theme = 'light' | 'dark';
interface ThemeContextType { theme: Theme; toggleTheme: () => void; }
interface BaseProps { children: React.ReactNode; }

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Length of the colour cross-fade, in step with `.theme-transition` in globals.css. */
const FADE_MS = 160;

/**
 * The class on <html> is the theme, not this module's state.
 *
 * The inline script in the root layout puts it there before the first paint, so
 * reading it back is both what survives a reload and what keeps a second click
 * correct while a `startTransition` update is still in flight.
 */
const readTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export const ThemeProvider: React.FC<BaseProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');
  const fadeTimer = useRef<number | undefined>(undefined);

  // Adopt what the layout script already applied. This used to be a pair of
  // effects that read localStorage and then wrote the class from `theme` — and
  // the write ran first with the mount default ('light', the only thing the
  // server can render), painting over the script's choice before correcting
  // itself a render later.
  useEffect(() => {
    setTheme(readTheme());
    return () => window.clearTimeout(fadeTimer.current);
  }, []);

  /**
   * Holds the window open until the last colour has actually changed.
   *
   * The class swap is not the only thing that repaints on a theme change: the
   * search page paints its shell from `theme` in an inline style, and that now
   * lands a commit after the swap. Re-arming here — after that commit — keeps
   * the fade covering it instead of letting it snap in behind the window.
   */
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('theme-transition')) return;
    window.clearTimeout(fadeTimer.current);
    fadeTimer.current = window.setTimeout(() => {
      root.classList.remove('theme-transition');
    }, FADE_MS + 60);
  }, [theme]);

  /**
   * Cross-fades colours on the way between themes.
   *
   * The order here is the whole trick, and it is: paint, then React.
   *
   * `setTheme` on a click is a discrete update, so React flushes it
   * synchronously before the browser gets a chance to paint — and its consumers
   * are the search page, the map container and the header, which is easily
   * 100ms+ of blocked main thread on a heavy route. Everything after the swap
   * was landing behind that: the fade began late, and the timer that ends it
   * had been counting since the click, so it was regularly cut mid-flight or
   * missed altogether. So the swap is written to the DOM first and the React
   * update is queued from inside `requestAnimationFrame`, which runs on the
   * frame that paints it — the fade starts on time, and the re-render lands
   * behind that paint instead of in front of it.
   *
   * Deliberately NOT `startTransition`. A transition is an update React is
   * allowed to postpone, and on the search page — a map, its markers, the card
   * rail and the toolbar, all reading this context — it postponed it well past
   * the fade window: the CSS-driven half of the page changed on the click and
   * the half painted from `theme` in JS snapped in afterwards, which is the
   * lag this used to have. Default priority cannot be deferred that way.
   *
   * `.theme-transition` is only on the document for the length of the fade: a
   * standing `transition` on every element would also animate hovers, menu
   * opens, and anything else that happens to change a colour. Its removal is
   * anchored to a frame rather than to the click for the same reason as above.
   */
  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark';

    root.classList.add('theme-transition');
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode / storage disabled: the theme just does not persist.
    }

    window.clearTimeout(fadeTimer.current);
    requestAnimationFrame(() => {
      // Runs on the frame that paints the swap, so the window covers the fade
      // wherever the frame lands. The margin covers a slow frame at the end.
      setTheme(next);
      fadeTimer.current = window.setTimeout(() => {
        root.classList.remove('theme-transition');
      }, FADE_MS + 60);
    });
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

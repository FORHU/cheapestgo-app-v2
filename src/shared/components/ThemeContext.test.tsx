import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Switching theme.
 *
 * It used to put `.theme-transition` on <html> for a moment, which gave every element on the
 * page — two thousand and more — its own colour transition. Each had to be restyled and animated
 * on the main thread, so the click froze the page for a tenth of a second or more before the
 * fade even started, and gradients, which cannot fade, snapped while everything else slowly did.
 * The switch is now one view transition: the browser snapshots the old page, the swap happens
 * underneath, and it cross-fades the two pictures.
 */

vi.mock('sonner', () => ({ Toaster: () => null }));

import { ThemeProvider, useTheme } from './ThemeContext';

function Probe() {
    const { theme, toggleTheme } = useTheme();
    return <button onClick={toggleTheme}>{theme}</button>;
}

const root = document.documentElement;
const mount = () => render(<ThemeProvider><Probe /></ThemeProvider>);
const click = () => fireEvent.click(screen.getByRole('button'));

/** A `startViewTransition` that holds the update until the test says go. */
function stubViewTransition() {
    const updates: Array<() => void> = [];
    const start = vi.fn((update: () => void) => {
        updates.push(update);
        const done = new Promise<void>((resolve) => { (update as unknown as { done?: () => void }).done = resolve; });
        return { finished: done, ready: done, updateCallbackDone: done, skipTransition: vi.fn() };
    });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    return {
        start,
        /** Run the n-th update the way the browser does, once it has taken its snapshot. */
        run: (n = 0) => act(async () => { updates[n](); (updates[n] as unknown as { done: () => void }).done(); }),
    };
}

function stubReducedMotion(reduced: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: reduced && query.includes('prefers-reduced-motion'),
        media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
    root.className = 'light';
    localStorage.clear();
    stubReducedMotion(false);
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

afterEach(() => {
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

describe('toggleTheme in a browser with view transitions', () => {
    it('swaps the theme inside the transition, not before it — so the old page is what it fades from', async () => {
        const vt = stubViewTransition();
        mount();

        click();
        expect(vt.start).toHaveBeenCalledTimes(1);
        // The browser has the old page; the swap has not been made yet.
        expect(root.classList.contains('light')).toBe(true);

        await vt.run();
        expect(root.classList.contains('dark')).toBe(true);
        expect(root.classList.contains('light')).toBe(false);
        expect(screen.getByRole('button').textContent).toBe('dark');
    });

    it('renders the new theme before the transition takes its second picture', async () => {
        // The pieces of the page painted from `theme` in JS (the search page, the toaster) have
        // to be in the picture it fades to, not arrive a commit after it.
        const vt = stubViewTransition();
        mount();

        click();
        await vt.run();

        expect(screen.getByRole('button').textContent).toBe('dark');
    });

    it('never gives every element its own colour transition', async () => {
        const vt = stubViewTransition();
        mount();

        click();
        expect(root.classList.contains('theme-transition')).toBe(false);
        await vt.run();
        expect(root.classList.contains('theme-transition')).toBe(false);
    });

    it('marks the page as switching only for the length of the transition', async () => {
        const vt = stubViewTransition();
        mount();

        click();
        expect(root.classList.contains('theme-switching')).toBe(true);
        await vt.run();
        await act(async () => { await Promise.resolve(); });
        expect(root.classList.contains('theme-switching')).toBe(false);
    });

    it('lands on the right theme when clicked twice before the first transition has run', async () => {
        const vt = stubViewTransition();
        mount();

        click();
        click();
        await vt.run(0);
        await vt.run(1);

        // Two switches are no switch: it is back where it started.
        expect(root.classList.contains('light')).toBe(true);
        expect(screen.getByRole('button').textContent).toBe('light');
    });

    it('remembers the choice for the next visit', async () => {
        const vt = stubViewTransition();
        mount();

        click();
        await vt.run();

        expect(localStorage.getItem('theme')).toBe('dark');
    });
});

describe('toggleTheme without a transition', () => {
    it('switches at once in a browser that has no view transitions', () => {
        mount();

        click();

        expect(root.classList.contains('dark')).toBe(true);
        expect(screen.getByRole('button').textContent).toBe('dark');
        expect(root.classList.contains('theme-transition')).toBe(false);
    });

    it('switches at once for a visitor who asked for less motion, even where it could fade', () => {
        stubReducedMotion(true);
        const vt = stubViewTransition();
        mount();

        click();

        expect(vt.start).not.toHaveBeenCalled();
        expect(root.classList.contains('dark')).toBe(true);
    });

    it('goes back the other way too', () => {
        mount();

        click();
        click();

        expect(root.classList.contains('light')).toBe(true);
        expect(screen.getByRole('button').textContent).toBe('light');
    });
});

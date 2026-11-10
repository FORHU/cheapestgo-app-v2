import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { startNavigation, finishNavigation, getNavigationPhase } from '@/i18n/navigationProgress';
import { NavigationProgress, NAVIGATION_PROGRESS_TIMEOUT_MS } from '../NavigationProgress';

/**
 * The bar across the top of the screen between a tap and the page it asked for: there from the
 * moment a navigation starts, gone once the new page has rendered — or once the browser's own
 * back and forward have brought one.
 */

const nav = vi.hoisted(() => ({ pathname: '/deals' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

const ui = () => (
    <NextIntlClientProvider locale="en" messages={en as never}>
        <NavigationProgress />
    </NextIntlClientProvider>
);

const bar = () => screen.queryByRole('progressbar', { name: 'Loading page' });

beforeEach(() => {
    vi.useFakeTimers();
    nav.pathname = '/deals';
    window.history.replaceState(null, '', '/deals');
});
afterEach(() => {
    act(() => finishNavigation());
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
});

describe('NavigationProgress', () => {
    it('shows nothing until a navigation starts, then a bar saying the page is loading', () => {
        render(ui());
        expect(bar()).toBeNull();
        act(() => startNavigation());
        expect(bar()).toBeInTheDocument();
    });

    it('completes and leaves once the new page has rendered', () => {
        const { rerender } = render(ui());
        act(() => startNavigation());

        nav.pathname = '/trips';
        rerender(ui());
        expect(getNavigationPhase()).toBe('idle');
        expect(screen.getByRole('progressbar', { hidden: true })).toHaveStyle({ transform: 'scaleX(1)' });

        act(() => vi.advanceTimersByTime(600));
        expect(screen.queryByRole('progressbar', { hidden: true })).toBeNull();
    });

    it('shows for the browser\'s back and forward when they bring another page', () => {
        render(ui());
        window.history.pushState(null, '', '/deals#reviews');
        act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
        expect(bar()).toBeNull();

        window.history.pushState(null, '', '/trips');
        act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
        expect(bar()).toBeInTheDocument();
    });

    it('gives up rather than sit there when no page ever arrives', () => {
        render(ui());
        act(() => startNavigation());
        act(() => vi.advanceTimersByTime(NAVIGATION_PROGRESS_TIMEOUT_MS));
        expect(getNavigationPhase()).toBe('idle');
        act(() => vi.advanceTimersByTime(600));
        expect(screen.queryByRole('progressbar', { hidden: true })).toBeNull();
    });
});

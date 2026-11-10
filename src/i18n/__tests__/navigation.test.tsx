import React from 'react';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { finishNavigation, getNavigationPhase } from '../navigationProgress';

/**
 * The app's Link and useRouter report a navigation the moment one is asked for, so the bar
 * across the top can show before the next page has been fetched. They report only a move to
 * another page — not a page rewriting its own query, not a language switch — and only for a
 * click the browser would follow in this tab.
 */

const base = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

// The real ones need the App Router mounted. These stand in for them as next/link does: call
// the caller's onClick, then take the click over so the browser does not follow it.
vi.mock('next-intl/navigation', () => ({
    createNavigation: () => ({
        Link: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { locale?: string }>(
            function BaseLink({ locale: _locale, onClick, ...rest }, ref) {
                return <a ref={ref} {...rest} onClick={(e) => { onClick?.(e); e.preventDefault(); }} />;
            },
        ),
        redirect: vi.fn(),
        usePathname: () => '/deals',
        useRouter: () => ({ push: base.push, replace: base.replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
        getPathname: ({ href, locale }: { href: string; locale: string }) => (locale === 'en' ? '' : `/${locale}`) + href,
    }),
}));

import { Link, useRouter } from '../navigation';

const inLocale = (locale: string) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
        return <NextIntlClientProvider locale={locale} messages={{}}>{children}</NextIntlClientProvider>;
    };

beforeEach(() => window.history.replaceState(null, '', '/deals'));
afterEach(() => {
    finishNavigation();
    base.push.mockClear();
    base.replace.mockClear();
});

describe('Link', () => {
    it('reports a navigation when it is followed to another page', () => {
        render(<Link href="/trips">Trips</Link>);
        fireEvent.click(screen.getByRole('link', { name: 'Trips' }));
        expect(getNavigationPhase()).toBe('loading');
    });

    it('reports nothing for the page already on screen', () => {
        render(<><Link href="/deals?sort=rating">Sort</Link><Link href="/deals#reviews">Reviews</Link></>);
        fireEvent.click(screen.getByRole('link', { name: 'Sort' }));
        fireEvent.click(screen.getByRole('link', { name: 'Reviews' }));
        expect(getNavigationPhase()).toBe('idle');
    });

    it('reports nothing for a click that opens the page elsewhere', () => {
        render(<><Link href="/trips">Trips</Link><Link href="/help" target="_blank">Help</Link></>);
        fireEvent.click(screen.getByRole('link', { name: 'Trips' }), { ctrlKey: true });
        fireEvent.click(screen.getByRole('link', { name: 'Trips' }), { metaKey: true });
        fireEvent.click(screen.getByRole('link', { name: 'Trips' }), { button: 1 });
        fireEvent.click(screen.getByRole('link', { name: 'Help' }));
        expect(getNavigationPhase()).toBe('idle');
    });

    it('reports nothing when its own onClick keeps the page where it is', () => {
        const onClick = vi.fn((e: React.MouseEvent) => e.preventDefault());
        render(<Link href="/trips" onClick={onClick}>Trips</Link>);
        fireEvent.click(screen.getByRole('link', { name: 'Trips' }));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(getNavigationPhase()).toBe('idle');
    });
});

describe('useRouter', () => {
    it('reports a push to another page, and still makes it', () => {
        const { result } = renderHook(() => useRouter(), { wrapper: inLocale('en') });
        result.current.push('/trips', { scroll: false });
        expect(getNavigationPhase()).toBe('loading');
        expect(base.push).toHaveBeenCalledWith('/trips', { scroll: false });
    });

    it('reports nothing when a page rewrites its own query', () => {
        const { result } = renderHook(() => useRouter(), { wrapper: inLocale('en') });
        result.current.replace('/deals?currency=KRW');
        expect(getNavigationPhase()).toBe('idle');
        expect(base.replace).toHaveBeenCalledWith('/deals?currency=KRW', undefined);
    });

    it('reports nothing for a language switch, which has its own cross-fade', () => {
        const { result } = renderHook(() => useRouter(), { wrapper: inLocale('en') });
        result.current.replace('/deals', { locale: 'ko' });
        expect(getNavigationPhase()).toBe('idle');
    });

    it('compares in the language on screen, whose pages carry a prefix', () => {
        window.history.replaceState(null, '', '/ko/deals');
        const { result } = renderHook(() => useRouter(), { wrapper: inLocale('ko') });
        result.current.push('/deals?sort=price');
        expect(getNavigationPhase()).toBe('idle');
        result.current.push('/trips');
        expect(getNavigationPhase()).toBe('loading');
    });
});

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { finishNavigation } from '@/i18n/navigationProgress';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useSearchStore } from '@/shared/stores/search.store';
import { MobileBottomNav, NAV_SKIN } from '../MobileBottomNav';

/**
 * The phone's bottom bar. A tapped tab answers the tap: it lights up while its page loads,
 * rather than sitting dark until the page arrives and leaving the old tab lit as though the tap
 * had missed. Its gear opens the visitor's settings — language, currency, theme, and their
 * account once signed in. Signing in is the header's job, not the bar's.
 */

const nav = vi.hoisted(() => ({ pathname: '/', replace: vi.fn(), toggleTheme: vi.fn() }));

vi.mock('@/i18n/navigation', async () => {
    const { startNavigation } = await import('@/i18n/navigationProgress');
    return {
        usePathname: () => nav.pathname,
        useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
        // As the app's Link does: report the navigation once the click is followed.
        Link: ({ href, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
            <a href={href} {...rest} onClick={(e) => { onClick?.(e); e.preventDefault(); startNavigation(); }} />
        ),
    };
});
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
// The account panel has its own tests; here it only matters whether the sheet shows it.
vi.mock('@/shared/auth/SignInDropdown', () => ({
    default: ({ variant }: { variant?: string }) => <div data-testid="account-panel" data-variant={variant} />,
}));
vi.mock('@/shared/components/ChromeToneContext', () => ({ useChromeTone: () => 'light' }));
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: nav.toggleTheme }) }));

const ui = () => (
    <NextIntlClientProvider locale="en" messages={en as never}>
        <MobileBottomNav />
    </NextIntlClientProvider>
);

const icon = (name: string) => screen.getByRole('link', { name }).firstElementChild as HTMLElement;
const LIT = { color: NAV_SKIN.light.active };
const DARK = { color: NAV_SKIN.light.icon };

beforeEach(() => {
    nav.pathname = '/';
    nav.replace.mockClear();
    nav.toggleTheme.mockClear();
    useAuthStore.setState({ user: null });
    useSearchStore.getState().setUserCurrency('USD');
});
afterEach(() => act(() => finishNavigation()));

const openSettings = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    return screen.getByRole('dialog', { name: 'Settings' });
};

describe('the settings sheet', () => {
    it('offers no sign in — the header has the button for that', () => {
        render(ui());
        const sheet = openSettings();
        expect(within(sheet).queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
        expect(within(sheet).queryByRole('link', { name: /sign in|create account/i })).not.toBeInTheDocument();
        expect(within(sheet).queryByTestId('account-panel')).not.toBeInTheDocument();
    });

    it('holds the language, the currency and the theme, each showing the one in use', () => {
        render(ui());
        const sheet = openSettings();
        const language = within(sheet).getByRole('group', { name: 'Language' });
        const currency = within(sheet).getByRole('group', { name: 'Currency' });
        const theme = within(sheet).getByRole('group', { name: 'Theme' });

        expect(within(language).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
        expect(within(language).getByRole('button', { name: '한국어' })).toHaveAttribute('aria-pressed', 'false');
        expect(within(currency).getByRole('button', { name: /USD/ })).toHaveAttribute('aria-pressed', 'true');
        expect(within(theme).getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('changes language as the header\'s menu does, keeping the page', () => {
        render(ui());
        fireEvent.click(within(openSettings()).getByRole('button', { name: '한국어' }));
        expect(nav.replace).toHaveBeenCalledWith('/', { locale: 'ko' });
    });

    it('changes the currency prices are shown in', () => {
        render(ui());
        const currency = within(openSettings()).getByRole('group', { name: 'Currency' });
        fireEvent.click(within(currency).getByRole('button', { name: /KRW/ }));
        expect(useSearchStore.getState().userCurrency).toBe('KRW');
        expect(within(currency).getByRole('button', { name: /KRW/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches the theme, and leaves it alone when the one in use is picked again', () => {
        render(ui());
        const theme = within(openSettings()).getByRole('group', { name: 'Theme' });
        fireEvent.click(within(theme).getByRole('button', { name: 'Light' }));
        expect(nav.toggleTheme).not.toHaveBeenCalled();
        fireEvent.click(within(theme).getByRole('button', { name: 'Dark' }));
        expect(nav.toggleTheme).toHaveBeenCalledTimes(1);
    });

    it('carries the account — its settings and sign out — once someone is signed in', () => {
        useAuthStore.setState({
            user: { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' },
        });
        render(ui());
        expect(within(openSettings()).getByTestId('account-panel')).toHaveAttribute('data-variant', 'inline');
    });
});

describe('a tapped tab', () => {
    it('lights up while its page loads, though the page on screen is still the one marked current', () => {
        render(ui());
        fireEvent.click(screen.getByRole('link', { name: 'Trips' }));
        expect(icon('Trips')).toHaveStyle(LIT);
        expect(icon('Home')).toHaveStyle(DARK);
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    });

    it('stays lit once its page has arrived', () => {
        const { rerender } = render(ui());
        fireEvent.click(screen.getByRole('link', { name: 'Trips' }));
        nav.pathname = '/trips';
        act(() => finishNavigation());
        rerender(ui());
        expect(icon('Trips')).toHaveStyle(LIT);
        expect(screen.getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
    });

    it('goes dark again if its page never comes', () => {
        render(ui());
        fireEvent.click(screen.getByRole('link', { name: 'Trips' }));
        act(() => finishNavigation());
        expect(icon('Trips')).toHaveStyle(DARK);
        expect(icon('Home')).toHaveStyle(LIT);
    });
});

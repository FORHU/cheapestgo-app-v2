/**
 * The landing header's account control: a sign-in link for a guest, and once someone is
 * signed in, the round profile button the app header uses, menu and all.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { useAuthStore } from '@/shared/stores/auth.store';

vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
        <a href={href} {...rest}>{children}</a>,
    usePathname: () => '/',
    useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
// The locale and currency menus bring their own stores and router; they are not under test.
vi.mock('@/shared/components/common/LocaleSelector', () => ({ LocaleSelector: () => null }));
vi.mock('@/shared/components/common/CurrencySelector', () => ({ CurrencySelector: () => null }));
const toggleTheme = vi.fn();
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme }) }));

import { LandingHeader } from './landing-header';

const queryWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('LandingHeader', () => {
    beforeEach(() => useAuthStore.setState({ user: null, isAuthModalOpen: false }));

    it('links to the bookings list, signed in or not', async () => {
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });
        expect(await screen.findByRole('link', { name: 'Bookings' })).toHaveAttribute('href', '/trips');
    });

    it('links guests to the full-page sign-in screen', async () => {
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });
        expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    });

    it('becomes a round profile button once someone is signed in', async () => {
        useAuthStore.setState({
            user: { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' },
        });
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });

        const profile = await screen.findByRole('button', { name: 'Account' });
        expect(profile).toHaveTextContent('BB');
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
    });

    // jsdom applies no media queries, so the desktop row and the mobile hamburger both render
    // here; the panel is looked up through the button's aria-controls to keep the two apart.
    const openMobileMenu = async () => {
        const menu = await screen.findByRole('button', { name: 'Menu' });
        expect(menu).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(menu);
        expect(menu).toHaveAttribute('aria-expanded', 'true');
        return document.getElementById(menu.getAttribute('aria-controls')!)!;
    };

    it('puts sign in behind a hamburger on mobile, going to the full-page sign-in screen', async () => {
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });

        const panel = await openMobileMenu();
        expect(within(panel).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    });

    it('shows the account and sign out in the mobile menu once someone is signed in', async () => {
        useAuthStore.setState({
            user: { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' },
        });
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });

        const panel = await openMobileMenu();
        expect(within(panel).getByText('billy@example.com')).toBeInTheDocument();
        expect(within(panel).getByRole('link', { name: 'Account Settings' })).toHaveAttribute('href', '/account');
        expect(within(panel).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
        expect(within(panel).queryByText('Sign in')).not.toBeInTheDocument();
    });

    it('closes the mobile menu on Escape', async () => {
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });

        await openMobileMenu();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('has no theme to switch on the landing page, which is dark whatever the theme', async () => {
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });
        await screen.findByRole('link', { name: 'Bookings' });
        expect(screen.queryByRole('button', { name: /switch to/i })).not.toBeInTheDocument();
    });

    it('carries the theme switch on a themed page, where it stands in for the app header', async () => {
        renderWithIntl(<LandingHeader tone="default" />, { wrapper: queryWrapper });

        expect(await screen.findByRole('link', { name: 'Bookings' })).toHaveAttribute('href', '/trips');
        fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
        expect(toggleTheme).toHaveBeenCalledTimes(1);
    });
});

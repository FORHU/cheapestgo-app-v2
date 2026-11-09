/**
 * The landing header's account control, at every width: a sign-in link for a guest, and once
 * someone is signed in, the round profile button the app header uses, menu and all.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
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
        const [desktop] = await screen.findAllByRole('link', { name: 'Sign in' });
        expect(desktop).toHaveAttribute('href', '/login');
    });

    it('becomes a round profile button once someone is signed in', async () => {
        useAuthStore.setState({
            user: { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' },
        });
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });

        const [profile] = await screen.findAllByRole('button', { name: 'Account' });
        expect(profile).toHaveTextContent('BB');
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
    });

    // jsdom applies no media queries, so the desktop row and the phone's control both render
    // here: two of each, one per width.
    it('gives a phone the same sign-in button as a desktop, not a menu to find it in', async () => {
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });

        const signIns = await screen.findAllByRole('link', { name: 'Sign in' });
        expect(signIns).toHaveLength(2);
        signIns.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
        expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
    });

    it('gives a phone the profile button once someone is signed in, with the account and sign out', async () => {
        useAuthStore.setState({
            user: { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' },
        });
        renderWithIntl(<LandingHeader />, { wrapper: queryWrapper });

        const profiles = await screen.findAllByRole('button', { name: 'Account' });
        expect(profiles).toHaveLength(2);
        expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();

        fireEvent.click(profiles[1]);
        expect(screen.getByText('billy@example.com')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Account Settings' })).toHaveAttribute('href', '/account');
        expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
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

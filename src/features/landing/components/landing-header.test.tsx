/**
 * The landing header's account control: a sign-in link for a guest, and once someone is
 * signed in, the round profile button the app header uses, menu and all.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { useAuthStore } from '@/shared/stores/auth.store';

vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
        <a href={href} {...rest}>{children}</a>,
    usePathname: () => '/',
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
// The locale and currency menus bring their own stores and router; they are not under test.
vi.mock('@/shared/components/common/LocaleSelector', () => ({ LocaleSelector: () => null }));
vi.mock('@/shared/components/common/CurrencySelector', () => ({ CurrencySelector: () => null }));

import { LandingHeader } from './landing-header';

describe('LandingHeader', () => {
    beforeEach(() => useAuthStore.setState({ user: null }));

    it('offers sign in to a guest', () => {
        renderWithIntl(<LandingHeader />);
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    });

    it('becomes a round profile button once someone is signed in', async () => {
        useAuthStore.setState({
            user: { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' },
        });
        renderWithIntl(<LandingHeader />);

        const profile = await screen.findByRole('button', { name: 'Account' });
        expect(profile).toHaveTextContent('BB');
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
    });
});

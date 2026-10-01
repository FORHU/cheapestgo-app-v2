/**
 * The auth shell.
 *
 * Two of these guard things that went wrong before rather than things that might: the brand was
 * drawn as a lucide plane that appears nowhere else in the product, and "Forgot password?"
 * pointed at a route nobody had created — a 404 on the one screen reached by people who cannot
 * get in any other way.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// The locale-aware `Link` reaches for next/navigation, which does not resolve under jsdom. None
// of these assertions are about routing — the link is an anchor here.
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
        <a href={href} {...rest}>{children}</a>,
}));

import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import ForgotPasswordPage from '@/app/[locale]/forgot-password/page';
import en from '@/locales/en.json';

// The password forms are react-query mutations; a client is part of rendering them at all.
const wrap = (ui: React.ReactNode) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>
        </QueryClientProvider>,
    );

describe('AuthLayout', () => {
    it('wears the header’s wordmark, not an icon of its own', () => {
        wrap(<AuthLayout title="Welcome back" subtitle="Sign in" pitch="Your trips."><div /></AuthLayout>);

        // "Cheapest" and "Go" are separate nodes so the tail can carry the accent, exactly as the
        // header splits them — so the assertion is on the accented tail, not the whole string.
        const tail = screen.getAllByText('Go')[0];
        expect(tail).toBeInTheDocument();
        expect(tail.className).toContain('accent');
    });

    it('carries no plane glyph', () => {
        const { container } = wrap(
            <AuthLayout title="Welcome back" subtitle="Sign in" pitch="Your trips."><div /></AuthLayout>);
        expect(container.querySelector('.lucide-plane-takeoff')).toBeNull();
    });

    it('shows the title, the subtitle and the form it was given', () => {
        wrap(
            <AuthLayout title="Welcome back" subtitle="Sign in to continue" pitch="Your trips.">
                <button type="button">Sign in</button>
            </AuthLayout>);

        expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
        expect(screen.getByText('Sign in to continue')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('keeps the brand panel off small screens, where it would push the form below the fold', () => {
        const { container } = wrap(
            <AuthLayout title="Welcome back" subtitle="Sign in" pitch="Your trips."><div /></AuthLayout>);

        const panel = screen.getByText('Your trips.').closest('div')?.parentElement;
        expect(panel?.className).toContain('hidden');
        expect(panel?.className).toContain('lg:block');
        // The backdrop is decoration and says nothing a screen reader needs.
        expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(0);
    });
});

describe('the password-reset route', () => {
    it('exists, because the sign-in page has always linked to it', () => {
        // Rendering the page module is what makes this a regression test rather than a note:
        // the link was live for as long as the route was missing.
        wrap(<ForgotPasswordPage />);
        // Level 1: the form under it carries a heading of its own.
        expect(screen.getByRole('heading', { level: 1, name: /reset your password/i })).toBeInTheDocument();
    });
});

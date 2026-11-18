import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { useAuthStore } from '@/shared/auth/store';
import { useAuthStore as useSessionStore } from '@/shared/stores/auth.store';
import { ResetPasswordView } from './reset-password-view';

/**
 * Setting a new password ends every session the account had, so the page that did it must not
 * go on looking signed in: both client stores forget the user, the person is told they are
 * signed out, and they are sent to sign in again with the new password.
 */

const m = vi.hoisted(() => ({ put: vi.fn(), push: vi.fn() }));

vi.mock('@/shared/lib/http', () => ({ http: { put: m.put } }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('token=tok') }));
vi.mock('@/i18n/navigation', () => ({
    useRouter: () => ({ push: m.push }),
    Link: ({ href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest} />,
}));
vi.mock('@/features/auth/components/auth-layout', () => ({
    AuthLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const SIGNED_IN = { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' } as never;

beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: SIGNED_IN });
    useSessionStore.setState({ user: SIGNED_IN });
});

const submit = () => {
    render(
        <NextIntlClientProvider locale="en" messages={en as never}>
            <ResetPasswordView />
        </NextIntlClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: en.auth.resetPassword }));
};

describe('after a password is set', () => {
    it('forgets the signed-in user in both stores and says they are signed out', async () => {
        m.put.mockResolvedValue({});
        submit();
        expect(await screen.findByText(/signed out everywhere/i)).toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();
        expect(useSessionStore.getState().user).toBeNull();
    });

    it('keeps the user signed in as far as the page knows when the reset is refused', async () => {
        m.put.mockRejectedValue(new Error('Invalid or expired reset token.'));
        submit();
        await waitFor(() => expect(screen.getByText('Invalid or expired reset token.')).toBeInTheDocument());
        expect(useAuthStore.getState().user).not.toBeNull();
    });
});

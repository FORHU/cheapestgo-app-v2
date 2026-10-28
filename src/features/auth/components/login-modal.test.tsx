import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/shared/stores/auth.store';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { LoginModal } from './login-modal';

vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
        <a href={href} {...rest}>{children}</a>,
    useRouter: () => ({ push: vi.fn() }),
}));

describe('LoginModal', () => {
    beforeEach(() => useAuthStore.setState({ isAuthModalOpen: false }));

    it('shows the login form and closes on request', () => {
        useAuthStore.getState().openAuthModal();
        const queryClient = new QueryClient();

        renderWithIntl(
            <QueryClientProvider client={queryClient}>
                <LoginModal />
            </QueryClientProvider>,
        );

        expect(screen.getByRole('dialog', { name: 'Welcome back' })).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

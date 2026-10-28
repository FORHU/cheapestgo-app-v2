/**
 * The sign-in form writes `@/shared/auth/store`, but both headers read
 * `@/shared/stores/auth.store`. Until the two are consolidated, every sign-in and sign-out
 * has to reach the second one too, or the header keeps saying "Sign in" until a reload.
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authApi = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), logout: vi.fn() }));
const http = vi.hoisted(() => ({ post: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock('../api/auth.api', () => ({ authApi }));
vi.mock('@/shared/lib/http', () => ({ http }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { useLogin, useRegister, useLogout } from './use-auth';
import { useAuthStore as useLegacyStore } from '@/shared/auth/store';
import { useAuthStore as useSessionStore } from '@/shared/stores/auth.store';

// What api-v2 actually sends: the `users` row, snake_case, minus the hash.
const apiUser = {
    id: 'u1', email: 'billy@example.com', role: 'user',
    first_name: 'Billy', last_name: 'Busilan', avatar_url: null,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('auth hooks keep the header store in step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useLegacyStore.setState({ user: null });
        useSessionStore.setState({ user: null });
    });

    it('signing in reaches it, names and all', async () => {
        authApi.login.mockResolvedValue({ user: apiUser });
        const { result } = renderHook(() => useLogin(), { wrapper });

        result.current.mutate({ email: 'billy@example.com', password: 'secret123' });

        await waitFor(() => expect(useSessionStore.getState().user).toMatchObject({
            id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan',
        }));
    });

    it('modal sign-in keeps the current page and closes on success', async () => {
        const onSuccess = vi.fn();
        authApi.login.mockResolvedValue({ user: apiUser });
        const { result } = renderHook(
            () => useLogin({ redirectAfterLogin: false, onSuccess }),
            { wrapper },
        );

        result.current.mutate({ email: 'billy@example.com', password: 'secret123' });

        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
        expect(push).not.toHaveBeenCalled();
    });

    it('signing up reaches it', async () => {
        authApi.register.mockResolvedValue({ user: apiUser });
        const { result } = renderHook(() => useRegister(), { wrapper });

        result.current.mutate({ email: 'billy@example.com', password: 'secret123' });

        await waitFor(() => expect(useSessionStore.getState().user).toMatchObject({ id: 'u1' }));
    });

    it('signing out clears it', async () => {
        useLegacyStore.setState({
            user: { id: 'u1', email: 'billy@example.com', role: 'user' },
        });
        useSessionStore.setState({
            user: { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' },
        });
        http.post.mockResolvedValue({ success: true });
        const { result } = renderHook(() => useLogout(), { wrapper });

        result.current.mutate();

        await waitFor(() => expect(useSessionStore.getState().user).toBeNull());
        expect(useLegacyStore.getState().user).toBeNull();
        expect(http.post).toHaveBeenCalledWith('/auth/logout', {});
        expect(push).toHaveBeenCalledWith('/');
    });

    it('keeps the account signed in and reports a failed sign-out', async () => {
        useLegacyStore.setState({
            user: { id: 'u1', email: 'billy@example.com', role: 'user' },
        });
        useSessionStore.setState({
            user: { id: 'u1', email: 'billy@example.com', firstName: 'Billy', lastName: 'Busilan', role: 'user' },
        });
        http.post.mockRejectedValue(new Error('Network unavailable'));
        const { result } = renderHook(() => useLogout(), { wrapper });

        result.current.mutate();

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network unavailable'));
        expect(useSessionStore.getState().user).not.toBeNull();
        expect(useLegacyStore.getState().user).not.toBeNull();
        expect(push).not.toHaveBeenCalled();
    });
});

/**
 * Checkout sends someone who has to sign in to `/login?redirect=<where they were>`. Signing in
 * has to put them back there, or the room they picked is gone.
 */
describe('signing in returns to where it was asked from', () => {
    const signInFrom = async (search: string) => {
        window.history.replaceState(null, '', `/login${search}`);
        authApi.login.mockResolvedValue({ user: apiUser });
        const { result } = renderHook(() => useLogin(), { wrapper });
        result.current.mutate({ email: 'billy@example.com', password: 'secret123' });
        await waitFor(() => expect(push).toHaveBeenCalled());
        return push.mock.calls[0][0];
    };

    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, '', '/');
    });

    it('goes back to the hotel checkout, query and all', async () => {
        // Built the way checkout builds it: URLSearchParams, then window.location.
        const checkout = '/checkout?' + new URLSearchParams({ hotelId: 'h1', checkIn: '2026-11-10', roomName: 'Standard Room' });
        expect(await signInFrom(`?redirect=${encodeURIComponent(checkout)}`)).toBe(checkout);
    });

    it('does not double the locale the return address already carries', async () => {
        // Checkout builds the address from window.location, so on Korean it starts with /ko —
        // and the locale-aware router adds the current locale on its own.
        expect(await signInFrom(`?redirect=${encodeURIComponent('/ko/checkout?hotelId=h1')}`)).toBe('/checkout?hotelId=h1');
    });

    it('goes home when nothing asked', async () => {
        expect(await signInFrom('')).toBe('/');
    });

    it.each([
        ['another site', 'https://evil.example/checkout'],
        ['a protocol-relative address', '//evil.example/checkout'],
        ['a backslash trick', '/\\evil.example'],
        ['a script', 'javascript:alert(1)'],
        ['an address that does not parse', '//['],
    ])('ignores %s and goes home', async (_label, target) => {
        expect(await signInFrom(`?redirect=${encodeURIComponent(target)}`)).toBe('/');
    });
});

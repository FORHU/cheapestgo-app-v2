'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '@/shared/auth/store';
import { useAuthStore as useSessionStore, toSessionUser } from '@/shared/stores/auth.store';
import { routing } from '@/i18n/routing';

// app-v2 carries two auth stores, and the headers read the second one. Each sign-in and
// sign-out here sets both, or the header still says "Sign in" until a reload.

const LOCALE_PREFIX = new RegExp(`^/(?:${routing.locales.join('|')})(?=/|$)`);

/**
 * Where signing in goes next: the `redirect` it was asked with (checkout sends one, so the
 * room someone picked is still there), else home.
 *
 * Only a path on this site is followed. Anything that resolves elsewhere — another site,
 * `//host`, `/\host` — goes home instead, so the link cannot send someone off-site. A
 * leading locale is dropped because the locale-aware router puts the current one back.
 */
function returnPath(): string {
    const raw = new URLSearchParams(window.location.search).get('redirect');
    if (!raw?.startsWith('/')) return '/';
    try {
        const url = new URL(raw, window.location.origin);
        if (url.origin !== window.location.origin) return '/';
        return (url.pathname.replace(LOCALE_PREFIX, '') || '/') + url.search + url.hash;
    } catch {
        return '/';
    }
}

export function useLogin() {
    const { setUser } = useAuthStore();
    const setSessionUser = useSessionStore((s) => s.setUser);
    const router = useRouter();

    return useMutation({
        mutationFn: authApi.login,
        onSuccess: ({ user }) => {
            setUser(user);
            setSessionUser(toSessionUser(user));
            toast.success('Welcome back!');
            router.push(returnPath());
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Invalid email or password.');
        },
    });
}

export function useRegister() {
    const { setUser } = useAuthStore();
    const setSessionUser = useSessionStore((s) => s.setUser);
    const router = useRouter();

    return useMutation({
        mutationFn: authApi.register,
        onSuccess: ({ user }) => {
            setUser(user);
            setSessionUser(toSessionUser(user));
            toast.success('Account created successfully!');
            router.push('/');
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Registration failed. Please try again.');
        },
    });
}

export function useLogout() {
    const { setUser } = useAuthStore();
    const setSessionUser = useSessionStore((s) => s.setUser);
    const router = useRouter();

    return useMutation({
        mutationFn: authApi.logout,
        onSuccess: () => {
            setUser(null);
            setSessionUser(null);
            toast.success('Signed out.');
            router.push('/');
        },
    });
}

export function useResetPassword() {
    return useMutation({
        mutationFn: (email: string) => authApi.requestReset(email),
        onSuccess: () => {
            toast.success('Password reset link sent! Check your inbox.');
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Failed to send reset link.');
        },
    });
}

'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '@/shared/auth/store';

export function useLogin() {
    const { setUser } = useAuthStore();
    const router = useRouter();

    return useMutation({
        mutationFn: authApi.login,
        onSuccess: ({ user }) => {
            setUser(user);
            toast.success('Welcome back!');
            router.push('/');
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Invalid email or password.');
        },
    });
}

export function useRegister() {
    const { setUser } = useAuthStore();
    const router = useRouter();

    return useMutation({
        mutationFn: authApi.register,
        onSuccess: ({ user }) => {
            setUser(user);
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
    const router = useRouter();

    return useMutation({
        mutationFn: authApi.logout,
        onSuccess: () => {
            setUser(null);
            toast.success('Signed out.');
            router.push('/');
        },
    });
}

export function useResetPassword() {
    return useMutation({
        mutationFn: (email: string) => authApi.resetPassword(email),
        onSuccess: () => {
            toast.success('Password reset link sent! Check your inbox.');
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Failed to send reset link.');
        },
    });
}

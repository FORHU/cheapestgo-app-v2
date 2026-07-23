import type { User } from '@/shared/auth/store';

export interface LoginBody { email: string; password: string; }
export interface RegisterBody { email: string; password: string; firstName?: string; lastName?: string; }
export interface AuthResponse { user: User; }

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw Object.assign(new Error(err.error ?? 'Request failed'), { status: res.status });
    }
    return res.json();
}

export const authApi = {
    login: (body: LoginBody) =>
        authFetch<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

    register: (body: RegisterBody) =>
        authFetch<AuthResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),

    logout: () =>
        authFetch<void>('/api/auth/logout', { method: 'POST' }),

    me: () =>
        authFetch<AuthResponse>('/api/auth/me'),

    resetPassword: (email: string) =>
        authFetch<{ success: boolean }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ email }) }),

    updatePassword: (token: string, password: string) =>
        authFetch<{ success: boolean }>('/api/auth/reset-password', { method: 'PUT', body: JSON.stringify({ token, password }) }),
};
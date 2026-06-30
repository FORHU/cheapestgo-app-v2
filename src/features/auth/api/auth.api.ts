import { http } from '@/shared/lib/http';
import type { User } from '@/shared/types';

export interface LoginBody {
    email: string;
    password: string;
}

export interface RegisterBody {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

export interface AuthResponse {
    user: User;
}

export const authApi = {
    login: (body: LoginBody) =>
        http.post<AuthResponse>('/api/v2/auth/login', body),

    register: (body: RegisterBody) =>
        http.post<AuthResponse>('/api/v2/auth/signup', body),

    logout: () =>
        http.post<void>('/api/v2/auth/logout'),

    me: () =>
        http.get<AuthResponse>('/api/v2/auth/me'),

    resetPassword: (email: string) =>
        http.post<{ message: string }>('/api/v2/auth/reset-password', { email }),

    updatePassword: (token: string, password: string) =>
        http.post<{ message: string }>('/api/v2/auth/reset-password/confirm', { token, password }),
};

import { http } from '@/shared/lib/http';
import type { User } from '@/shared/types';

export interface LoginBody { email: string; password: string; }
/**
 * The names are snake_case because that is what api-v2 reads. It strips keys it does not know,
 * so a camelCase name is dropped without an error and the account is saved nameless.
 */
export interface RegisterBody { email: string; password: string; first_name?: string; last_name?: string; }
export interface AuthResponse { user: User; }

/**
 * Auth lives in api-v2, which issues the JWT cookie. app-v2 holds no session of
 * its own — see ADR-0017. Paths are relative to NEXT_PUBLIC_API_URL, which
 * already carries the /api/v2 prefix.
 */
export const authApi = {
    login: (body: LoginBody) =>
        http.post<AuthResponse>('/auth/login', body),

    register: (body: RegisterBody) =>
        http.post<AuthResponse>('/auth/register', body),

    logout: () =>
        http.post<{ success: boolean }>('/auth/logout'),

    me: () =>
        http.get<AuthResponse>('/auth/me'),

    requestReset: (email: string) =>
        http.post<{ success: boolean }>('/auth/request-reset', { email }),

    resetPassword: (token: string, password: string) =>
        http.put<{ success: boolean }>('/auth/reset-password', { token, password }),
};

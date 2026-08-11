import { create } from "zustand";
import type { User, AuthStep } from "@/types/auth";
import { loginSchema, registerSchema, emailSchema, profileSchema, updatePasswordSchema, type RegisterInput, type ProfileInput } from "@/lib/schemas/auth";
import { http } from "@/shared/lib/http";

interface AuthState {
    user: User | null;
    authStep: AuthStep;
    email: string;
    redirectTo: string | null;
    isLoading: boolean;
    isAuthModalOpen: boolean;

    setAuthStep: (step: AuthStep) => void;
    setEmail: (email: string) => void;
    openAuthModal: (step?: AuthStep, redirectTo?: string) => void;
    closeAuthModal: () => void;
    setUser: (user: User | null) => void;

    login: (email: string, password: string) => Promise<void>;
    register: (data: RegisterInput) => Promise<void>;
    logout: () => Promise<void>;
    socialLogin: (provider: "google" | "apple" | "facebook") => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    resendConfirmation: (email: string) => Promise<void>;
    updateProfile: (data: ProfileInput) => Promise<void>;
    updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    syncProfile: (profile: Partial<User>) => void;
    fetchAndSyncRole: () => Promise<void>;
    initSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
    const withLoading = <T>(fn: () => Promise<T>): Promise<T> => {
        set({ isLoading: true });
        return fn().finally(() => set({ isLoading: false }));
    };

    return {
        user: null,
        authStep: "email",
        email: "",
        redirectTo: null,
        isLoading: true,
        isAuthModalOpen: false,

        setAuthStep: (authStep) => set({ authStep }),
        setEmail: (email) => set({ email }),
        openAuthModal: (step = 'email', redirectTo?: string) =>
            set({ isAuthModalOpen: true, authStep: step, redirectTo: redirectTo ?? get().redirectTo }),
        closeAuthModal: () => set({ isAuthModalOpen: false, redirectTo: null }),
        setUser: (user) => set({ user, isLoading: false }),

        initSession: async () => {
            try {
                const res = await http.get<{ user: User }>('/auth/me');
                set({ user: res.user ?? null, isLoading: false });
            } catch {
                set({ user: null, isLoading: false });
            }
        },

        login: async (email, password) => {
            loginSchema.parse({ email, password });
            set({ email });
            return withLoading(async () => {
                const { user } = await http.post<{ user: User }>('/auth/login', { email, password });
                set({
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName ?? '',
                        lastName: user.lastName ?? '',
                        avatar: user.avatar,
                        role: user.role ?? 'user',
                    },
                });
            });
        },

        register: async (data) => {
            registerSchema.parse(data);
            set({ email: data.email });
            return withLoading(async () => {
                const { user } = await http.post<{ user: User }>('/auth/signup', {
                    email: data.email,
                    password: data.password,
                    firstName: data.firstName,
                    lastName: data.lastName,
                });
                set({
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: data.firstName ?? '',
                        lastName: data.lastName ?? '',
                        role: 'user',
                    },
                    authStep: 'email',
                });
            });
        },

        logout: () =>
            withLoading(async () => {
                await http.post<void>('/auth/logout', {});
                set({ user: null });
            }),

        socialLogin: async (provider) => {
            if (provider === 'google') {
                window.location.href = '/api/auth/oauth/google';
                return;
            }
            throw new Error(`OAuth provider "${provider}" is not configured yet.`);
        },

        resetPassword: (email) => {
            emailSchema.parse({ email });
            return withLoading(async () => {
                await http.post('/auth/reset-password', { email });
            });
        },

        resendConfirmation: (email) => {
            emailSchema.parse({ email });
            return withLoading(async () => {
                console.warn('[authStore] resendConfirmation: not implemented');
            });
        },

        updateProfile: (data) => {
            profileSchema.parse(data);
            return withLoading(async () => {
                await http.put('/preferences', {
                    firstName: data.firstName,
                    lastName: data.lastName,
                });
                const { user } = get();
                if (user) {
                    set({
                        user: {
                            ...user,
                            firstName: data.firstName ?? user.firstName,
                            lastName: data.lastName ?? user.lastName,
                        },
                    });
                }
            });
        },

        updatePassword: (currentPassword, newPassword) => {
            updatePasswordSchema.parse({ currentPassword, newPassword });
            return withLoading(async () => {
                const { user } = get();
                if (!user?.email) throw new Error("No user logged in");
                await http.post('/auth/login', { email: user.email, password: currentPassword });
                await http.put('/auth/reset-password', { token: '__current__', password: newPassword });
            });
        },

        syncProfile: (profile) => {
            const { user } = get();
            if (user) set({ user: { ...user, ...profile } });
        },

        fetchAndSyncRole: async () => {
            try {
                const res = await http.get<{ user: User }>('/auth/me');
                if (res.user?.role) {
                    set({ user: { ...get().user!, role: res.user.role } });
                }
            } catch (err: unknown) {
                const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
                if (status !== 401) {
                    console.error('[authStore] Failed to sync role:', err);
                }
            }
        },
    };
});

export const useUser = () => useAuthStore((s) => s.user);
export const useAuthStep = () => useAuthStore((s) => s.authStep);
export const useAuthLoading = () => useAuthStore((s) => s.isLoading);

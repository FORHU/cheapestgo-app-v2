import { create } from 'zustand';

// ─── User type — matches the shape returned by /api/auth/me ──────────────────

export interface User {
    id: string;
    email: string;
    role: 'user' | 'admin';
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface AuthState {
    user: User | null;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    fetchUser: () => Promise<void>;
    initSession: () => Promise<void>;
    fetchAndSyncRole: () => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isLoading: true,

    setUser: (user) => set({ user, isLoading: false }),

    /** Fetch the current session from the server on app boot. */
    fetchUser: async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const { user } = await res.json();
                set({ user: user ?? null, isLoading: false });
            } else {
                set({ user: null, isLoading: false });
            }
        } catch {
            set({ user: null, isLoading: false });
        }
    },

    /** Alias for fetchUser — called by AuthListener on mount. */
    initSession: async () => {
        await get().fetchUser();
    },

    /** Refresh the user's role (e.g. after admin promotion). */
    fetchAndSyncRole: async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const { user } = await res.json();
                if (user?.role) {
                    set({ user: { ...get().user!, role: user.role } });
                }
            }
        } catch (err) {
            console.error('[authStore] Failed to sync role:', err);
        }
    },

    logout: async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // Ignore logout errors — clear client state regardless
        }
        set({ user: null });
    },
}));

// ─── Selectors ───────────────────────────────────────────────────────────────

export const useUser = () => useAuthStore((s) => s.user);
export const useAuthLoading = () => useAuthStore((s) => s.isLoading);
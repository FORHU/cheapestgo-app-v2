import { create } from 'zustand';
import { http } from '@/shared/lib/http';

interface User {
    id:         string;
    email:      string;
    role:       'user' | 'admin';
    first_name?: string;
    last_name?:  string;
    avatar_url?: string;
}

interface AuthState {
    user:        User | null;
    isLoading:   boolean;
    fetchUser:   () => Promise<void>;
    logout:      () => Promise<void>;
    setUser:     (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user:      null,
    isLoading: true,

    fetchUser: async () => {
        try {
            const { user } = await http.get<{ user: User }>('/auth/me');
            set({ user, isLoading: false });
        } catch {
            set({ user: null, isLoading: false });
        }
    },

    logout: async () => {
        await http.post('/auth/logout');
        set({ user: null });
    },

    setUser: (user) => set({ user }),
}));

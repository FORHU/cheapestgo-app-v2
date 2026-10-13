import { create } from 'zustand';
import { http } from '@/shared/lib/http';
import { claimRecentSearches, stashRecentSearches } from '@/shared/lib/recentSearchHandoff';
import { clearBookingInProgress } from '@/shared/lib/bookingInProgress';

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

    /**
     * Who is signed in, asked once on boot.
     *
     * Bounded on purpose. Every sign-in screen disables itself on `isLoading`, which starts
     * `true` and clears only here, so a request stalled on a poor connection left those
     * screens disabled with no way out (QA BG-15). A check that has not answered in 10s is
     * treated as "not signed in" — the server still decides on every real request, so the
     * worst case is one extra sign-in, not a wrong answer.
     */
    fetchUser: async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
            const { user } = await http.get<{ user: User }>('/auth/me', { signal: controller.signal });
            set({ user, isLoading: false });
        } catch {
            set({ user: null, isLoading: false });
        } finally {
            clearTimeout(timer);
        }
    },

    logout: async () => {
        try {
            await http.post('/auth/logout');
            set({ user: null });
            // Filed under this account, not thrown away: signing back in brings it back,
            // and nobody else at this browser sees where they had been looking (BG-12).
            stashRecentSearches();
        } finally {
            // Even if the request failed: the person clicked sign out, and the next one at
            // this browser must not pick up their half-finished booking (BG-1).
            clearBookingInProgress();
        }
    },

    setUser: (user) => set({ user }),
}));

// Whichever way an account becomes the signed-in one — password, sign-up, the OAuth
// return, or a session restored on load — the recent searches on screen must belong to
// it. One subscription covers every path that sets `user`.
//
// app-v2 carries two auth stores today and a sign-in through either one has to do this,
// so both subscribe. Consolidating them is its own job.
if (typeof window !== 'undefined') {
    useAuthStore.subscribe((state, prev) => {
        const id = state.user?.id;
        if (id && id !== prev.user?.id) claimRecentSearches(id);
    });
}

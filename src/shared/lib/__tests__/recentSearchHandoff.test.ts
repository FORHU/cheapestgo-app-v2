import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSearchStore, MAX_RECENT_SEARCHES } from '@/shared/stores/search.store';
import { useAuthStore } from '@/shared/auth/store';
import type { Destination } from '@/shared/types';

/**
 * QA BG-1: search a destination, sign out, and the next person at the same browser sees
 * where you had been looking — the list is persisted and nothing cleared it.
 * QA BG-12: clearing it outright instead loses the history every time you sign back in.
 *
 * It is put away per account, not thrown away, and never shown to anyone else.
 */

const dest = (title: string): Destination => ({ type: 'city', title, subtitle: title, countryCode: 'JP' });
const titles = () => useSearchStore.getState().recentSearches.map(d => d.title);
const signIn = (id: string) => useAuthStore.setState({ user: { id, email: `${id}@example.test`, role: 'user' } });
const searched = (...names: string[]) => useSearchStore.setState({ recentSearches: names.map(dest) });

async function signOut() {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await useAuthStore.getState().logout();
    vi.unstubAllGlobals();
}

beforeEach(() => {
    localStorage.clear();
    useSearchStore.setState({ recentSearches: [] });
    useAuthStore.setState({ user: null });
});

describe('recent searches across sign-out', () => {
    it('comes back when the same account signs in again', async () => {
        signIn('user-a');
        searched('Hakodate', 'Sapporo');

        await signOut();
        expect(titles()).toEqual([]);           // nothing on screen for the next person

        signIn('user-a');
        expect(titles()).toEqual(['Hakodate', 'Sapporo']);
    });

    it('is not shown to a different account on the same browser', async () => {
        signIn('user-a');
        searched('Hakodate');
        await signOut();

        signIn('user-b');
        expect(titles()).toEqual([]);

        // …and A still has it when they come back.
        await signOut();
        signIn('user-a');
        expect(titles()).toEqual(['Hakodate']);
    });

    it('keeps what was searched while signed out, for whoever signs in', () => {
        searched('Osaka');
        signIn('user-a');
        expect(titles()).toEqual(['Osaka']);
    });

    it("merges a signed-out search with the account's own history, newest first, without duplicates", async () => {
        signIn('user-a');
        searched('Hakodate', 'Sapporo');
        await signOut();

        searched('Osaka', 'Hakodate');
        signIn('user-a');
        expect(titles()).toEqual(['Osaka', 'Hakodate', 'Sapporo']);
    });

    it('files a list left by an expired session under its owner, not the newcomer', () => {
        signIn('user-a');
        searched('Hakodate');
        useAuthStore.setState({ user: null });   // session expired, no sign-out ran

        signIn('user-b');
        expect(titles()).toEqual([]);

        useAuthStore.setState({ user: null });
        signIn('user-a');
        expect(titles()).toEqual(['Hakodate']);
    });

    it("caps the restored list at the store's own maximum", async () => {
        signIn('user-a');
        searched(...Array.from({ length: MAX_RECENT_SEARCHES + 4 }, (_, i) => `City ${i}`));
        await signOut();
        searched('Fresh');
        signIn('user-a');
        expect(titles()).toHaveLength(MAX_RECENT_SEARCHES);
        expect(titles()[0]).toBe('Fresh');
    });
});

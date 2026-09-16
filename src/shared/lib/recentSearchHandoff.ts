import { useSearchStore, MAX_RECENT_SEARCHES } from '@/shared/stores/search.store';
import type { Destination } from '@/shared/types';

/**
 * Recent searches belong to an account, not to a browser.
 *
 * They are persisted, so they outlive a sign-out: the next person at a shared computer
 * sees where the last one had been looking (QA BG-1). Clearing them outright is not the
 * answer either — signing back in then loses every destination the customer had looked
 * at (QA BG-12).
 *
 * So they are put away rather than thrown away. Sign-out files the list under the account
 * that made it; signing in takes back that account's own list. Nobody else's is ever on
 * screen, and the list stays in this browser — it is a convenience, not a synced record.
 */

/** Which account the visible list belongs to. Absent = nobody signed in made it. */
const OWNER_KEY = 'cheapestgo-search-owner';
const bucketKey = (userId: string) => `cheapestgo-search-history:${userId}`;

function read(key: string): Destination[] {
    try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function write(key: string, value: Destination[]) {
    try {
        if (value.length) localStorage.setItem(key, JSON.stringify(value));
        else localStorage.removeItem(key);
    } catch { /* storage blocked — the list is a convenience */ }
}

/** Newest first, one entry per destination, capped like the store itself. */
function merge(...lists: Destination[][]): Destination[] {
    const seen = new Set<string>();
    const merged: Destination[] = [];
    for (const item of lists.flat()) {
        const key = item?.title?.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
    }
    return merged.slice(0, MAX_RECENT_SEARCHES);
}

/** Sign-out: file the visible list under whoever was signed in, then take it off screen. */
export function stashRecentSearches(): void {
    if (typeof window === 'undefined') return;
    const store = useSearchStore.getState();
    let owner: string | null = null;
    try { owner = localStorage.getItem(OWNER_KEY); } catch { /* nothing to file it under */ }
    if (owner) write(bucketKey(owner), merge(store.recentSearches, read(bucketKey(owner))));
    try { localStorage.removeItem(OWNER_KEY); } catch { /* ignore */ }
    store.clearRecentSearches();
}

/**
 * Sign-in: show this account's own list again.
 *
 * Destinations looked at while signed out are kept and merged in. A list left on screen by
 * a *different* account is filed under that account instead of being handed over — that is
 * a session that expired without a sign-out, not a gift.
 */
export function claimRecentSearches(userId: string): void {
    if (typeof window === 'undefined') return;
    const store = useSearchStore.getState();
    let previousOwner: string | null = null;
    try { previousOwner = localStorage.getItem(OWNER_KEY); } catch { /* treat as nobody */ }

    const onScreen = store.recentSearches;
    const someoneElses = !!previousOwner && previousOwner !== userId;

    if (someoneElses) {
        write(bucketKey(previousOwner!), merge(onScreen, read(bucketKey(previousOwner!))));
    }

    const restored = merge(someoneElses ? [] : onScreen, read(bucketKey(userId)));
    useSearchStore.setState({ recentSearches: restored });
    try { localStorage.setItem(OWNER_KEY, userId); } catch { /* ignore */ }
}

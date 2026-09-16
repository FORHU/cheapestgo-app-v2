import { useBookingStore } from '@/shared/stores/booking.store';
import { useSavedStore } from '@/features/landing/stores/saved.store';

/**
 * A booking in progress lives in the browser, not on an account.
 *
 * v1 learned this as QA BG-1: it kept the whole checkout form in persisted storage, so after
 * one account signed out and another signed in on the same computer, the second opened
 * /checkout onto the first one's booking with their name, email and phone already filled in.
 *
 * app-v2 is mostly clear of that by construction — its booking store is in memory and the
 * checkout form is component state — so what is left is smaller and none of it is personal
 * details: the flight someone picked (session storage, which survives a sign-out in the same
 * tab) and the wishlist of places they hearted. Both still say something about the last
 * person, and a shared computer is the case that matters.
 *
 * One rule, not two: signing out wipes it. Unlike a recent-searches list, a half-finished
 * booking is not worth handing back — the offer has expired by the next sign-in anyway.
 * See [[recentSearchHandoff]] for the list that *is* kept.
 */

/** What the flight flow writes outside the stores. */
const SESSION_KEYS = ['selectedFlight', 'flightSearchPassengers'];

function quietly(fn: () => void) {
    try { fn(); } catch { /* storage blocked (private mode, sandbox) — nothing stored to leak */ }
}

export function clearBookingInProgress(): void {
    if (typeof window === 'undefined') return;
    useBookingStore.getState().reset();
    useSavedStore.getState().clear();
    quietly(() => {
        for (const key of SESSION_KEYS) sessionStorage.removeItem(key);
    });
}

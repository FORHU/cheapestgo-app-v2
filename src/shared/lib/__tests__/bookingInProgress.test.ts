import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/shared/auth/store';
import { useBookingStore } from '@/shared/stores/booking.store';
import { useSavedStore } from '@/features/landing/stores/saved.store';
import type { FlightOffer } from '@/shared/types';

/**
 * QA BG-1: a shared computer. Whatever the last person was part-way through must not be
 * waiting for the next one, whether or not the sign-out request itself succeeded.
 */

const offer = { offerId: 'off_1', price: 100 } as unknown as FlightOffer;

async function signOut({ failing = false } = {}) {
    vi.stubGlobal('fetch', failing
        ? vi.fn().mockRejectedValue(new Error('offline'))
        : vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await useAuthStore.getState().logout().catch(() => {});
    vi.unstubAllGlobals();
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useBookingStore.getState().reset();
    useSavedStore.setState({ saved: [] });
    useAuthStore.setState({ user: { id: 'user-a', email: 'a@example.test', role: 'user' } });
});

describe('a booking in progress, on sign-out', () => {
    it('does not leave the flight the last person picked', async () => {
        sessionStorage.setItem('selectedFlight', JSON.stringify(offer));
        sessionStorage.setItem('flightSearchPassengers', JSON.stringify({ adults: 2 }));

        await signOut();

        expect(sessionStorage.getItem('selectedFlight')).toBeNull();
        expect(sessionStorage.getItem('flightSearchPassengers')).toBeNull();
    });

    it('does not leave the offer selected in the store', async () => {
        useBookingStore.getState().selectFlightOffer(offer);
        useBookingStore.getState().setStep('payment');

        await signOut();

        expect(useBookingStore.getState().selectedFlightOffer).toBeNull();
        expect(useBookingStore.getState().step).toBe('select');
    });

    it('does not leave the places they hearted', async () => {
        useSavedStore.getState().toggle('stay:123');
        expect(useSavedStore.getState().saved).toHaveLength(1);

        await signOut();

        expect(useSavedStore.getState().saved).toEqual([]);
    });

    it('clears even when the sign-out request fails', async () => {
        // The person clicked sign out. Whether our server heard about it is our problem,
        // not theirs, and the next person at this browser is already sitting down.
        sessionStorage.setItem('selectedFlight', JSON.stringify(offer));

        await signOut({ failing: true });

        expect(sessionStorage.getItem('selectedFlight')).toBeNull();
    });
});

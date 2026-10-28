'use client';

/**
 * A booking's status, kept fresh until it settles.
 *
 * The confirmation page is where a traveller lands after paying, after a refresh, or from an
 * email — and in the first of those the booking may still be being made. This reads the status
 * endpoint and keeps reading it while the answer is "not yet", so the page that says "we are
 * confirming" turns into the page that says "you are booked" without anyone pressing anything.
 *
 * It stops, deliberately: a booking stuck with a supplier can stay that way for an hour, and a
 * tab polling every few seconds for an hour is not a service to anyone. After its budget it
 * says the answer is still not settled (`exhausted`) and offers `refresh`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { http } from '@/shared/lib/http';
import { fetchBookingOutcome, type CheckoutHttp } from '../lib/hotel-checkout-api';
import type { ConfirmOutcome } from '../lib/checkout-errors';

export type BookingLoad = 'loading' | 'ready' | 'not_found' | 'error';

export interface UseBookingStatus {
    load:      BookingLoad;
    outcome:   ConfirmOutcome | null;
    /** The polling budget is spent and the booking has still not settled. */
    exhausted: boolean;
    refresh:   () => Promise<void>;
}

export function useBookingStatus(
    reference: string,
    options: { client?: CheckoutHttp; pollMs?: number; maxPolls?: number } = {},
): UseBookingStatus {
    const client   = options.client ?? (http as unknown as CheckoutHttp);
    const pollMs   = options.pollMs ?? 3000;
    const maxPolls = options.maxPolls ?? 40;

    const [load, setLoad]           = useState<BookingLoad>(reference ? 'loading' : 'not_found');
    const [outcome, setOutcome]     = useState<ConfirmOutcome | null>(null);
    const [exhausted, setExhausted] = useState(false);

    // Bumped to restart the loop, by `refresh`.
    const [epoch, setEpoch] = useState(0);
    const clientRef = useRef(client);
    clientRef.current = client;

    useEffect(() => {
        if (!reference) { setLoad('not_found'); return; }

        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let polls = 0;
        setExhausted(false);

        const tick = async () => {
            if (stopped) return;
            polls += 1;
            try {
                const next = await fetchBookingOutcome(clientRef.current, reference);
                if (stopped) return;
                setOutcome(next);
                setLoad('ready');
                // Settled: a booking that is confirmed or failed will not change by being asked again.
                if (next.kind === 'confirmed' || next.kind === 'failed') return;
            } catch (err) {
                if (stopped) return;
                const code = (err as { code?: string; status?: number })?.code;
                const status = (err as { status?: number })?.status;
                if (status === 404 || code === 'BOOKING_NOT_FOUND') {
                    setLoad('not_found');
                    return;
                }
                // Keep whatever was already shown; only a first load can be an outright error.
                setLoad((current) => (current === 'ready' ? current : 'error'));
                if (polls === 1) return;
            }

            if (polls >= maxPolls) { setExhausted(true); return; }
            timer = setTimeout(tick, pollMs);
        };

        void tick();
        return () => { stopped = true; if (timer) clearTimeout(timer); };
    }, [reference, pollMs, maxPolls, epoch]);

    const refresh = useCallback(async () => {
        setLoad((current) => (current === 'ready' ? current : 'loading'));
        setEpoch((e) => e + 1);
    }, []);

    return { load, outcome, exhausted, refresh };
}

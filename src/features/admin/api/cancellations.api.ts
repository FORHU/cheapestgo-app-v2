import { http } from '@/shared/lib/http';

/**
 * Cancelling on a customer's behalf.
 *
 * These hit the same service methods the traveller's own Cancel button does, with an admin on
 * them — see ADR-0004 in api-v2. There is deliberately no "refund without cancelling" call here:
 * that route exists but has no button, because it moves money while leaving the supplier holding
 * the room and the booking reading as live.
 */

export interface HotelCancelPreview {
    reference: string;
    refundable: boolean;
    /** What the recorded terms give back, in `currency`. */
    refundAmount: number;
    penaltyAmount: number;
    currency: string;
    refundType: string;
    /** Why this is the figure — the deadline, the tier, the policy that applied. */
    message: string;
    policyUsed?: string;
}

export interface CancelResult {
    success: boolean;
    data?: { bookingId: string; status: string; message: string };
    /** Flights answer in their own shape. */
    status?: string;
    refundAmount?: number;
    refundCurrency?: string;
    stripeError?: string;
}

export interface FlightCancelQuote {
    success: boolean;
    refundAmount?: number;
    refundCurrency?: string;
    penaltyAmount?: number;
    cancellationId?: string | null;
    /** The supplier would not price it — usually a non-Duffel booking. */
    noQuote?: boolean;
    requiresManualCancellation?: boolean;
    alreadyCancelled?: boolean;
    status?: string;
    error?: string;
}

export const adminCancellationsApi = {
    hotelPreview: (reference: string) =>
        http.get<{ success: boolean; data: HotelCancelPreview }>(
            `/admin/bookings/hotel/${encodeURIComponent(reference)}/cancel-preview`,
        ),

    /**
     * `refundInFull` returns the whole charge regardless of the recorded terms. It is an override,
     * recorded as one against the admin who asked, because on a non-refundable stay the supplier
     * still bills us and the difference is a loss somebody chose to take.
     */
    cancelHotel: (reference: string, opts: { refundInFull?: boolean; reason?: string } = {}) =>
        http.post<CancelResult>(`/admin/bookings/hotel/${encodeURIComponent(reference)}/cancel`, {
            refundInFull: opts.refundInFull ?? false,
            reason:       opts.reason,
        }),

    flightQuote: (id: string) =>
        http.get<FlightCancelQuote>(`/admin/bookings/flight/${encodeURIComponent(id)}/cancel-quote`),

    /** No override: a flight refund is whatever the airline gave back, applied to what was paid. */
    cancelFlight: (id: string, opts: { cancellationId?: string | null; reason?: string } = {}) =>
        http.post<CancelResult>(`/admin/bookings/flight/${encodeURIComponent(id)}/cancel`, {
            cancellationId: opts.cancellationId ?? undefined,
            reason:         opts.reason,
        }),
};

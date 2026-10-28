/**
 * Cancelling a hotel booking, with the figure shown first and checked again before it is acted on.
 *
 * The cancel button used to be `window.confirm("Are you sure?")`: it told the traveller nothing
 * about what they would get back, which is the only thing they are deciding on. The API now
 * answers that (`/hotels/bookings/:reference/cancel-preview`, from the recorded terms and by the
 * same engine that will decide the cancellation), and this puts it in front of them.
 *
 * One thing makes a preview different from a quote: it is true *now*. A penalty tier can begin
 * while the dialog is open, and a traveller who agreed to "132 back" must not be given "0" by a
 * cancellation they confirmed a minute earlier. So confirming re-reads the preview first and, if
 * what they would receive has moved, stops and shows them the new figure instead of acting.
 */

export interface CancelHttp {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
}

export interface CancelPreview {
    reference:   string;
    cancellable: boolean;
    reason?:     'already_cancelled' | 'refund_retry' | 'not_cancellable';
    status:      string | null;
    paid:        { amount: number; currency: string };
    refund:      { amount: number; currency: string; type: 'full_refund' | 'partial_refund' | 'no_refund'; ratio: number };
    penalty:     { amount: number; currency: string };
    /** When these terms stop applying and worse ones begin. Null when nothing is ahead. */
    deadline:    string | null;
    policy:      string;
    message:     string;
}

export async function fetchCancelPreview(client: CancelHttp, reference: string): Promise<CancelPreview> {
    const res = await client.get<{ success?: boolean; data?: CancelPreview }>(
        `/hotels/bookings/${encodeURIComponent(reference)}/cancel-preview`,
    );
    if (!res?.data || typeof res.data !== 'object' || !('refund' in res.data)) {
        throw new Error('The cancellation terms were not understood. Please try again.');
    }
    return res.data;
}

/** Whether what the traveller would receive is no longer what they were shown. */
export function previewChanged(shown: CancelPreview, now: CancelPreview): boolean {
    return shown.refund.amount !== now.refund.amount
        || shown.refund.type !== now.refund.type
        || shown.refund.currency !== now.refund.currency;
}

export interface CancelResult {
    /** The booking's status afterwards, as the API names it. */
    status:       string;
    refunded:     boolean;
    /** Cancelled, but the money did not go back and needs another attempt. */
    refundFailed: boolean;
    message:      string;
}

export async function cancelHotelBooking(client: CancelHttp, reference: string): Promise<CancelResult> {
    const res = await client.post<{ success?: boolean; data: { status: string; message?: string } }>(
        '/hotels/cancel',
        { bookingRef: reference },
    );
    const { status, message } = res.data;
    return {
        status,
        refunded:     status === 'cancelled_refunded',
        refundFailed: status === 'cancelled_refund_failed',
        message:      message ?? '',
    };
}

export type ConfirmCancellation =
    | { kind: 'cancelled'; result: CancelResult }
    /** The figure moved (or the booking can no longer be cancelled): nothing was cancelled. */
    | { kind: 'changed'; preview: CancelPreview };

/**
 * Cancels, but only on the figure the traveller agreed to.
 *
 * A failure to re-check is thrown, not shrugged off: cancelling on a figure that could not be
 * confirmed is exactly the surprise this exists to prevent.
 */
export async function confirmCancellation(
    client: CancelHttp,
    reference: string,
    shown: CancelPreview,
): Promise<ConfirmCancellation> {
    const fresh = await fetchCancelPreview(client, reference);

    if (!fresh.cancellable || previewChanged(shown, fresh)) {
        return { kind: 'changed', preview: fresh };
    }
    return { kind: 'cancelled', result: await cancelHotelBooking(client, reference) };
}

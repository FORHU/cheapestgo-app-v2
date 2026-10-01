/**
 * Which travel documents a booking has earned.
 *
 * Three different documents, because they evidence three different things and they do not
 * become true at the same moment:
 *
 *   - a **Payment Receipt** says money was taken;
 *   - an **E-ticket** says an airline issued a ticket;
 *   - a **Hotel Voucher** says a property is holding a room.
 *
 * A single "receipt" for all of it is what lets a traveller arrive at a desk holding proof
 * of payment and nothing the airline can act on. Payment succeeding does not issue a
 * ticket, and a PNR is not a ticket either — a booking can hold a record locator for
 * minutes or hours before the ticket is issued, and sometimes it never is.
 *
 * So the gate for an e-ticket is issuance, never the PNR. Duffel and Mystifly both hand
 * back a PNR first.
 */
import type { AnyBooking, FlightBooking, HotelBooking } from '@/shared/types';

export type TravelDocument = 'eticket' | 'voucher' | 'receipt';

/** Statuses where money has been taken and not returned. */
const PAID = new Set(['confirmed', 'ticketed', 'booked', 'completed', 'cancelled', 'refunded']);

/** A ticket exists only once the airline says so. */
export function isTicketed(b: FlightBooking): boolean {
    return Boolean(b.ticketed_at) || (b.ticket_numbers?.length ?? 0) > 0 || b.status === 'ticketed';
}

/** The ticket numbers to print, from either shape the API returns them in. */
export function ticketNumbers(b: FlightBooking): string[] {
    const fromRow = b.ticket_numbers ?? [];
    if (fromRow.length) return fromRow;
    return (b.passengers ?? []).map((p) => p.ticket_number).filter((n): n is string => Boolean(n));
}

/**
 * The reference the property's own system holds.
 *
 * Not the `GG-` one — that is ours, and a front desk has never seen it. Both go on the
 * voucher, this one as the headline, because a guest at a desk cannot look up a second
 * number and the supplier's is the one that finds the reservation.
 */
export function supplierReference(b: HotelBooking): string | null {
    return b.provider_metadata?.supplierRef ?? b.voucher_code ?? null;
}

/** Cancelled bookings keep their receipt — it is the evidence of what was charged. */
function isCancelled(b: AnyBooking): boolean {
    return String(b.status).startsWith('cancel') || String(b.status) === 'refunded';
}

export function availableDocuments(b: AnyBooking): TravelDocument[] {
    const docs: TravelDocument[] = [];

    // Paid is paid, even afterwards: a refund is a second entry on the record, not a
    // reason to withdraw the first.
    if (PAID.has(String(b.status))) docs.push('receipt');

    if (isCancelled(b)) return docs;

    if (b.type === 'flight' && isTicketed(b)) docs.push('eticket');
    if (b.type === 'hotel' && String(b.status) === 'confirmed') docs.push('voucher');

    return docs;
}

/**
 * Why a travel document is not there yet, when the booking is paid but has nothing to
 * show. Silence reads as a fault; "we are waiting on the airline" does not.
 */
export function pendingReason(b: AnyBooking): 'awaiting_ticket' | 'awaiting_confirmation' | null {
    if (isCancelled(b)) return null;
    if (b.type === 'flight' && !isTicketed(b)) return 'awaiting_ticket';
    if (b.type === 'hotel' && String(b.status) !== 'confirmed') return 'awaiting_confirmation';
    return null;
}

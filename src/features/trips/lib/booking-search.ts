import type { AnyBooking } from '@/shared/types';
import type { GolfBooking } from '@/features/golf/types';

/**
 * Finding a booking in My Bookings by what the traveller remembers of it: a hotel's or a
 * course's name, an airport code, a passenger, or a reference from an email.
 *
 * Every word typed has to appear somewhere in the booking, in any order, so "seoul jeju"
 * narrows rather than widens. Case and accents are ignored: "cebu" finds "Cebú".
 */

/** Lower case, without accents. */
export function fold(text: string): string {
    return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * The words of a query. Dashes, arrows and slashes separate words as spaces do, so "MNL-ICN"
 * and "MNL → ICN" both find the route, and a reference typed whole, "GG-AB12CD", still finds
 * itself as its two halves.
 */
export function queryTerms(query: string): string[] {
    return fold(query).split(/[\s,\-–—→>/·|]+/).filter(Boolean);
}

/** What a hotel or flight booking can be found by: what its card shows, and the references it was given. */
export function bookingSearchText(booking: AnyBooking): string {
    const parts: Array<string | null | undefined> = booking.type === 'hotel'
        ? [
            booking.property_name,
            booking.room_name,
            booking.booking_reference,
            booking.booking_id,
            booking.provider_metadata?.supplierRef,
            booking.voucher_code,
            booking.holder_first_name,
            booking.holder_last_name,
        ]
        : [
            booking.pnr,
            booking.booking_reference,
            ...(booking.flight_segments ?? []).flatMap((s) => [
                s.origin,
                s.destination,
                s.airline,
                s.flight_number,
                // The number with its airline's code in front, as a traveller types it: PR468.
                s.airline && s.flight_number ? `${s.airline}${s.flight_number}` : null,
            ]),
            ...(booking.passengers ?? []).flatMap((p) => [p.first_name, p.last_name]),
            ...(booking.ticket_numbers ?? []),
        ];
    return fold(parts.filter(Boolean).join(' '));
}

/** What a golf booking can be found by. */
export function golfSearchText(booking: GolfBooking): string {
    return fold([
        booking.course?.name,
        booking.course?.city,
        booking.course?.country,
        booking.reference,
        booking.leadName,
    ].filter(Boolean).join(' '));
}

/** Whether every word of the query is in the text. No words, no narrowing. */
export function matchesTerms(text: string, terms: string[]): boolean {
    return terms.every((term) => text.includes(term));
}

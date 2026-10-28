/**
 * The traveller's bookings, as the API actually returns them.
 *
 * Four screens read this endpoint and each assumed a different shape:
 *
 *   trips list        a bare array
 *   trip detail       a bare booking
 *   invoice, voucher  `{ booking }`
 *
 * The API returns `{ success, data: [...] }` for the list and — for a single booking — a
 * different, camelCase *summary* of hotel bookings only. None of the four matched, so the list
 * crashed on `.filter` of an object and the detail page rendered a summary as if it were a
 * booking. And the trip cards link by row id while the single-booking endpoint looks up by
 * booking reference, so even when the shapes agreed the lookup would not have.
 *
 * The list endpoint is the one that returns whole rows, hotels and flights alike, so this reads
 * that and picks the booking out of it — by row id *or* reference, since both are in circulation
 * (cards use one, emails and the confirmation page the other). A traveller's own bookings are a
 * short list; a dedicated by-id endpoint would be better, and is an API change.
 */

import type { AnyBooking, FlightBooking, HotelBooking } from '@/shared/types';

export interface BookingsHttp {
    get<T>(path: string): Promise<T>;
}

/** Reads a list response in any of the shapes it has been sent in. Throws on one it does not know. */
export function unwrapBookings(res: unknown): AnyBooking[] {
    if (Array.isArray(res)) return res as AnyBooking[];

    if (res && typeof res === 'object') {
        const body = res as { data?: unknown; bookings?: unknown };
        if (Array.isArray(body.data)) return body.data as AnyBooking[];
        if (Array.isArray(body.bookings)) return body.bookings as AnyBooking[];
    }

    // An empty list is a real answer; an unreadable one must not look like it.
    throw new Error('The trips response was not understood. Please try again.');
}

/** Every identifier a booking is addressed by: its row, and its reference (named differently per kind). */
function identifiersOf(b: AnyBooking): Array<string | undefined> {
    return [b.id, (b as HotelBooking).booking_id, (b as FlightBooking).booking_reference];
}

export function findBooking(list: readonly AnyBooking[], idOrReference: string): AnyBooking | undefined {
    if (!idOrReference) return undefined;
    return list.find((b) => identifiersOf(b).includes(idOrReference));
}

export async function fetchBookings(client: BookingsHttp, type?: 'hotel' | 'flight'): Promise<AnyBooking[]> {
    const res = await client.get<unknown>(type ? `/bookings?type=${type}` : '/bookings');
    return unwrapBookings(res);
}

export async function fetchBooking(
    client: BookingsHttp,
    idOrReference: string,
    type?: 'hotel' | 'flight',
): Promise<AnyBooking> {
    const found = findBooking(await fetchBookings(client, type), idOrReference);
    if (found) return found;

    // Shaped like what `shared/lib/http` throws, so the screens' existing 404 handling applies.
    throw Object.assign(new Error('Booking not found'), { status: 404, code: 'NOT_FOUND' });
}

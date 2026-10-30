import type { FlightBooking, FlightOffer, NormalizedSegment } from '@/shared/types';
import type { ItineraryClock } from '@/features/flights/components/flight-itinerary';
import { formatBookingDateTime, formatBookingTime } from '@/features/flights/lib/flight-utils';

/**
 * A booked flight in the shape the results page's itinerary draws (`FlightItinerary`).
 *
 * A booking's segment times are each airport's own clock as api-v2 stored it, not instants
 * (see `FlightBooking.flight_segments`). So nothing here is worked out by subtracting one
 * airport's clock from another's: no leg is given a duration, and no direction a run time.
 * A layover is the one difference that holds — both of its ends are at the same airport.
 */

type BookingSegment = NonNullable<FlightBooking['flight_segments']>[number];

/** "KE 624" — or "KE624" as stored, when the number already carries its airline. */
export function flightLabel(airline?: string, flightNumber?: string): string {
    if (airline && flightNumber?.toUpperCase().startsWith(airline.toUpperCase())) return flightNumber;
    return [airline, flightNumber].filter(Boolean).join(' ');
}

function toSegment(s: BookingSegment): NormalizedSegment {
    return {
        segmentIndex: s.segment_index ?? 0,
        airline: s.airline ?? '',
        origin: s.origin,
        destination: s.destination,
        flightNumber: flightLabel(s.airline, s.flight_number),
        departure: { airport: s.origin, terminal: s.origin_terminal ?? undefined, time: s.departure },
        arrival: { airport: s.destination, terminal: s.destination_terminal ?? undefined, time: s.arrival ?? '' },
        duration: 0,
        stops: 0,
        cabinClass: s.cabin_class,
    };
}

/**
 * Every leg, direction by direction and in the order flown. The API sorts by direction alone,
 * which leaves a connection's two legs in whatever order the database returns them.
 */
export function bookingItinerary(booking: FlightBooking): Pick<FlightOffer, 'segments'> {
    const segments = (booking.flight_segments ?? []).map(toSegment);
    segments.sort((a, b) =>
        a.segmentIndex - b.segmentIndex || Date.parse(a.departure.time) - Date.parse(b.departure.time));
    return { segments };
}

/**
 * The first direction's legs — what the card's summary describes, as the results card's does.
 * Read across every leg, a round trip went MNL → MNL.
 */
export function outboundSegments(booking: FlightBooking): NormalizedSegment[] {
    const { segments } = bookingItinerary(booking);
    const first = segments[0]?.segmentIndex;
    return segments.filter((s) => s.segmentIndex === first);
}

/** Calendar days apart as the reader's clock prints the two ends, so the "+1" agrees with the times. */
function bookingDayOffset(from?: string, to?: string): number {
    if (!from || !to) return 0;
    const a = new Date(from);
    const b = new Date(to);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(0, Math.round((day(b) - day(a)) / 86_400_000));
}

function bookingLayover(arrival?: string, departure?: string): number | null {
    if (!arrival || !departure) return null;
    const minutes = (Date.parse(departure) - Date.parse(arrival)) / 60_000;
    return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) : null;
}

/** A booking's timestamps, read the way the rest of the trips screens read them. */
export const BOOKING_CLOCK: ItineraryClock = {
    time: formatBookingTime,
    dateTime: formatBookingDateTime,
    dayOffset: bookingDayOffset,
    layover: bookingLayover,
};

import type { NormalizedSegment } from '@/shared/types';
import type { GolfCourse } from '@/features/golf/types';
import { hotelSearchUrl } from '@/features/landing/lib/links';
import { DEFAULT_NIGHTS } from '@/shared/lib/stay';

/**
 * What the flight confirmation offers next: a hotel where the flight lands, and a tee time there.
 *
 * Everything is read off the offer just bought. A segment's times are Local Airport Times, so the
 * first ten characters are the calendar day at that airport — the day a hotel would check in on.
 */

/** Where the flight leaves the traveller, and the stay that fills the time until they fly on. */
export interface ArrivalStay {
    city:     string;
    checkIn:  string;
    checkOut: string;
}

/** `YYYY-MM-DD` plus whole days, counted in UTC so neither end moves with the browser's zone. */
function plusDays(day: string, days: number): string {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/**
 * The outbound's last arrival, from the day it lands until the next slice leaves.
 *
 * The outbound, not the last slice: a round trip's last slice lands back home. A one-way has
 * nothing to end the stay, and neither does a return that leaves the day it lands, so those get
 * the Default Stay's length — the hotel search would push them there anyway.
 *
 * Null without an arrival city: an airport code is not something the hotel search can find.
 */
export function arrivalStay(slices: NormalizedSegment[][]): ArrivalStay | null {
    const outbound = slices[0];
    const landing = outbound?.[outbound.length - 1]?.arrival;
    if (!landing?.city || !landing.time) return null;
    const checkIn = landing.time.slice(0, 10);
    const leaves = slices[1]?.[0]?.departure?.time?.slice(0, 10);
    return {
        city: landing.city,
        checkIn,
        checkOut: leaves && leaves > checkIn ? leaves : plusDays(checkIn, DEFAULT_NIGHTS),
    };
}

/** The hotel search for that stay, for everyone who flew but the infants, in one room. */
export function hotelLink(stay: ArrivalStay, adults: number, children: number): string {
    return hotelSearchUrl({
        destination: stay.city,
        checkIn:     stay.checkIn,
        checkOut:    stay.checkOut,
        adults:      Math.max(1, adults),
        children,
        rooms:       1,
    });
}

/** Admins type a course's city by hand; an airline names it its own way. Compare the letters. */
const cityKey = (city: string) => city.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** The most players a tee time takes — what the course page reads from `players`. */
const MAX_PLAYERS = 4;

export interface TeeTimeLink {
    href: string;
    /** The arrival city when a course is there; null when the link is to every course. */
    city: string | null;
}

/**
 * Where to book a tee time on this trip, among the courses that have tee times to book.
 *
 * One course in the arrival city opens on its page, on the first full day there and for the
 * adults who flew — the tee-time picker reads both from the address. Several open the list,
 * narrowed to their country: the list cannot be narrowed to a city. None there is still an
 * offer, of every course; no bookable course anywhere is none.
 */
export function teeTimeLink(courses: GolfCourse[], stay: ArrivalStay, players: number): TeeTimeLink | null {
    const bookable = courses.filter((c) => c.bookable);
    if (bookable.length === 0) return null;

    const here = bookable.filter((c) => cityKey(c.city) === cityKey(stay.city));
    if (here.length === 0) return { href: '/golf', city: null };
    if (here.length > 1) return { href: `/golf?country=${encodeURIComponent(here[0].country)}`, city: stay.city };

    const dayAfter = plusDays(stay.checkIn, 1);
    const qs = new URLSearchParams({
        date:    dayAfter < stay.checkOut ? dayAfter : stay.checkIn,
        players: String(Math.min(MAX_PLAYERS, Math.max(1, players))),
    });
    return { href: `/golf/${encodeURIComponent(here[0].slug)}?${qs}`, city: stay.city };
}

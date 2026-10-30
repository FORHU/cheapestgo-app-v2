'use client';

import type { NormalizedSegment, SegmentEnd } from '@/shared/types';

export function formatPrice(amount: number, currency: string, targetCurrency?: string): string {
    const ccy = targetCurrency || currency;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: ccy,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * An OFFER's departure or arrival clock, in **Local Airport Time**.
 *
 * The digits in the string are the answer. Providers quote a flight the way a boarding pass
 * does — 08:15 at the gate it leaves from — with no UTC offset attached, so there is nothing
 * for a `Date` to convert *from*. Building one anyway makes the browser guess a zone and
 * then renders the result in another, which silently prints a departure hours off. The same
 * string reaching a server in a different region would print differently again.
 *
 * A BOOKING's times are a different thing and must not use this — see `formatBookingTime`.
 */
export function formatTime(iso?: string): string {
    if (!iso) return '--:--';
    const m = /T(\d{2}):(\d{2})/.exec(iso);
    if (!m) return '--:--';
    const hour = Number(m[1]);
    if (!Number.isFinite(hour) || hour > 23) return '--:--';
    return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

/**
 * The calendar day of a Local Airport Time.
 *
 * Pinned to UTC before formatting so the digits survive: building a Date from an
 * offset-less time and formatting it elsewhere moves a 00:30 departure to the previous day
 * for every reader east of Greenwich.
 */
export function formatOfferDate(iso?: string): string {
    if (!iso) return '';
    const day = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(day)) return '';
    return new Date(day).toLocaleDateString('en-US', {
        timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
    });
}

/**
 * A BOOKED flight's clock — "6:40 PM".
 *
 * Distinct from `formatTime` above, and the distinction matters. A booking's times come out
 * of a `timestamptz` column as real instants, so they must go through a Date. Using the
 * wrong one of these two silently prints a time off by the gap between two zones.
 */
export function formatBookingTime(iso?: string): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "Thu, Nov 26, 2026, 7:21 PM" — a BOOKING's date and time, read the way `formatBookingTime` reads it. */
export function formatBookingDateTime(iso: string | undefined, locale: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const date = d.toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    return `${date}, ${formatBookingTime(iso)}`;
}

/**
 * "Wed, Oct 14, 2026, 18:40" — the day pinned to UTC before formatting so the
 * digits in the string survive, for the reason `formatTime` gives.
 */
export function formatDateTime(iso: string | undefined, locale: string): string {
    if (!iso) return '';
    const day = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(day)) return '';
    const date = new Date(day).toLocaleDateString(locale, {
        timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
    return `${date}, ${formatTime(iso)}`;
}

/**
 * "Thu, Oct 29, 2026, 9:40 AM" — `formatDateTime`, with the clock written the way the reader's
 * language writes it (12-hour where that is the custom, 24-hour where it is not) rather than
 * always as 24-hour digits.
 *
 * Pinned to UTC for the same reason: the digits are the airport's own clock, and a zone must
 * not be allowed to move them.
 */
export function formatDateTimeLocale(iso: string | undefined, locale: string): string {
    if (!iso) return '';
    const at = Date.parse(`${iso.slice(0, 16)}Z`);
    if (!Number.isFinite(at)) return '';
    const when = new Date(at);
    const date = when.toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const time = when.toLocaleTimeString(locale, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
    return `${date}, ${time}`;
}

/** "Hamad International Airport (DOH)", or the bare code when the provider named none. */
export function airportLabel(end: SegmentEnd | undefined, fallbackCode: string): string {
    const code = end?.airport || fallbackCode;
    const name = end?.airportName;
    return name && name !== code ? `${name} (${code})` : code;
}

export function formatDuration(minutes?: number): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function providerLabel(provider: string): string {
    if (provider === 'mystifly_v2' || provider === 'mystifly') return 'Mystifly';
    if (provider === 'duffel') return 'Duffel';
    return provider;
}

export function stopsLabel(stops: number): string {
    if (stops === 0) return 'Nonstop';
    if (stops === 1) return '1 stop';
    return `${stops} stops`;
}

export function stopsLabelShort(stops: number): string {
    if (stops === 0) return 'Direct';
    if (stops === 1) return '1 stop';
    return `${stops} stops`;
}

export function groupSegmentsIntoSlices(segments: NormalizedSegment[]): NormalizedSegment[][] {
    const map = new Map<number, NormalizedSegment[]>();
    for (const seg of segments) {
        const idx = seg.segmentIndex ?? 0;
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(seg);
    }
    return Array.from(map.values());
}

/**
 * The same slices, ordered and keyed: `index` is the segments' `segmentIndex`, which is
 * also the index into the offer's `sliceDurations`.
 */
export function groupSegmentsBySlice(segments: NormalizedSegment[]): { index: number; segments: NormalizedSegment[] }[] {
    const map = new Map<number, NormalizedSegment[]>();
    for (const seg of segments) {
        const idx = seg.segmentIndex ?? 0;
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(seg);
    }
    return [...map.keys()].sort((a, b) => a - b).map((index) => ({ index, segments: map.get(index)! }));
}

/**
 * Whole calendar days between two Local Airport Times — the "+1" on a flight that
 * lands the day after it leaves. Dates only, so neither end's zone matters.
 */
export function dayOffset(from?: string, to?: string): number {
    if (!from || !to) return 0;
    const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
    const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function cabinLabel(cabinClass?: string): string {
    return (cabinClass || 'economy').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Minutes on the ground between two legs.
 *
 * Both clocks are Local Airport Time at the same airport (see `formatTime`), so
 * their digits are compared as they stand — read as UTC, which no zone or DST
 * rule can shift — rather than handed to a `Date` to guess a zone for.
 */
export function layoverMinutes(arrival?: string, departure?: string): number | null {
    if (!arrival || !departure) return null;
    const a = Date.parse(`${arrival.slice(0, 16)}Z`);
    const d = Date.parse(`${departure.slice(0, 16)}Z`);
    if (!Number.isFinite(a) || !Number.isFinite(d) || d <= a) return null;
    return Math.round((d - a) / 60_000);
}
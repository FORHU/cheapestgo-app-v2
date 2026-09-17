'use client';

import type {  NormalizedSegment } from '@/shared/types';

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
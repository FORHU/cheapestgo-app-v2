'use client';

import type { FlightOffer, NormalizedSegment } from '@/shared/types';

export function formatPrice(amount: number, currency: string, targetCurrency?: string): string {
    const ccy = targetCurrency || currency;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: ccy,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatTime(iso?: string): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
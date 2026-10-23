import { describe, it, expect } from 'vitest';
import { buildPassState } from '@/features/landing/journey/passState';

/**
 * The Boarding Pass is the Journey's one claim to being more than decoration: each line
 * states something about the visitor's trip, and the button then runs it. So each line
 * has to be true. The first version hardcoded the nights and hardcoded the route to
 * null, meaning two of three rows could never be right however the page was used.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const SUGGESTED = { city: 'Seoul', countryCode: 'KR', nights: 3 };
const base = { chosen: null, dates: null, firstFlight: null, aiNote: null, suggested: SUGGESTED, toIso: iso };

describe('buildPassState', () => {
    it('suggests before the visitor has done anything, and says so', () => {
        const p = buildPassState(base);
        expect(p.destination).toBe('Seoul');
        expect(p.nights).toBe(3);
        expect(p.route).toBeNull();
        expect(p.touched).toBe(false);
        expect(p.checkIn).toBeNull();
    });

    it('prefers the visitor\'s destination over the suggestion', () => {
        const p = buildPassState({ ...base, chosen: { title: 'Muntinlupa', countryCode: 'PH' } });
        expect(p.destination).toBe('Muntinlupa');
        expect(p.countryCode).toBe('PH');
        expect(p.touched).toBe(true);
    });

    // Was hardcoded to the suggestion, so a five-night stay advertised as three.
    it('counts real nights from the picked dates', () => {
        const p = buildPassState({
            ...base,
            dates: { checkIn: new Date('2026-11-02'), checkOut: new Date('2026-11-07') },
        });
        expect(p.nights).toBe(5);
        expect(p.checkIn).toBe('2026-11-02');
        expect(p.checkOut).toBe('2026-11-07');
        expect(p.touched).toBe(true);
    });

    it('never claims zero or negative nights', () => {
        const same = new Date('2026-11-02');
        expect(buildPassState({ ...base, dates: { checkIn: same, checkOut: same } }).nights).toBe(1);
    });

    it('falls back to the suggested nights when only one date is set', () => {
        const p = buildPassState({ ...base, dates: { checkIn: new Date('2026-11-02'), checkOut: null } });
        expect(p.nights).toBe(3);
        expect(p.checkOut).toBeNull();
    });

    // Was hardcoded null: FLYING could never fill in.
    it('reads the route from the first flight segment, preferring airport codes', () => {
        const p = buildPassState({
            ...base,
            firstFlight: {
                origin: { code: 'MNL', title: 'Manila' },
                destination: { code: 'NRT', title: 'Tokyo Narita' },
            },
        });
        expect(p.route).toBe('MNL → NRT');
        expect(p.touched).toBe(true);
    });

    it('falls back to city names when a segment has no code', () => {
        const p = buildPassState({
            ...base,
            firstFlight: { origin: { title: 'Manila' }, destination: { title: 'Tokyo' } },
        });
        expect(p.route).toBe('Manila → Tokyo');
    });

    it('shows no route until both ends are known', () => {
        const half = buildPassState({
            ...base,
            firstFlight: { origin: { code: 'MNL', title: 'Manila' }, destination: null },
        });
        expect(half.route).toBeNull();
        expect(half.touched).toBe(false);
    });

    it('carries the AI note through and counts it as the visitor\'s input', () => {
        const p = buildPassState({ ...base, aiNote: 'Beach, direct flight, leaving Friday' });
        expect(p.aiNote).toBe('Beach, direct flight, leaving Friday');
        expect(p.touched).toBe(true);
    });
});

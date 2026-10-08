import { describe, it, expect } from 'vitest';
import {
    guessDistanceUnit, formatDistance, RADIUS_OPTIONS, nearestRadius, haversineMeters,
} from '@/shared/lib/distance';

describe('guessDistanceUnit', () => {
    it.each([
        [['en-US'], 'mi'],
        [['en-GB'], 'mi'],
        [['ko-KR'], 'km'],
        [['en'], 'km'],
        [['en', 'en-US'], 'mi'],
        [['ja-JP', 'en-US'], 'km'],
        [[], 'km'],
        [['not a tag!!'], 'km'],
    ])('%j → %s', (languages, unit) => {
        expect(guessDistanceUnit(languages)).toBe(unit);
    });
});

describe('formatDistance', () => {
    it.each([
        [990, 'km', '990 m'],
        [995, 'km', '1 km'],
        [1234, 'km', '1.2 km'],
        [144.8, 'mi', '480 ft'],
        [160.9344, 'mi', '0.1 mi'],
        [1609.344, 'mi', '1 mi'],
    ] as const)('%d m in %s → %s', (meters, unit, text) => {
        expect(formatDistance(meters, unit, 'en')).toBe(text);
    });

    it('localises the number and unit', () => {
        expect(formatDistance(1234, 'km', 'ko')).toContain('1.2');
    });
});

describe('RADIUS_OPTIONS', () => {
    it('are round numbers in each unit', () => {
        expect(RADIUS_OPTIONS.km.map((m) => formatDistance(m, 'km', 'en'))).toEqual(['1 km', '2 km', '5 km', '10 km']);
        expect(RADIUS_OPTIONS.mi.map((m) => formatDistance(m, 'mi', 'en'))).toEqual(['0.5 mi', '1 mi', '3 mi', '5 mi']);
    });
});

describe('nearestRadius', () => {
    it.each([
        [2000, 'mi', 1609],
        [1609, 'km', 2000],
        [8047, 'km', 10000],
        [805, 'km', 1000],
    ] as const)('%d m snaps to %d in %s', (meters, unit, expected) => {
        expect(nearestRadius(meters, unit)).toBe(expected);
    });
});

describe('haversineMeters', () => {
    it('measures a short north–south hop', () => {
        expect(Math.round(haversineMeters({ lat: 37.55, lng: 126.98 }, { lat: 37.5532, lng: 126.98 }))).toBe(356);
    });
});

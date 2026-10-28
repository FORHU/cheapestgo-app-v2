import { describe, it, expect } from 'vitest';
import { birthDateBounds, passportExpiryBounds } from '../flight-date-bounds';

const TODAY = '2026-10-19';
const DEPARTS = '2026-12-01';

describe('birthDateBounds — the ages an airline accepts for each kind of passenger, on the day they fly', () => {
    it('an adult is twelve or over on departure', () => {
        expect(birthDateBounds('ADT', DEPARTS, TODAY)).toEqual({ min: '1906-12-01', max: '2014-12-01', anchor: '1996-12-01' });
    });

    it('a child is two or over, and under twelve, on departure', () => {
        expect(birthDateBounds('CHD', DEPARTS, TODAY)).toEqual({ min: '2014-12-02', max: '2024-12-01', anchor: '2019-12-01' });
    });

    it('an infant is under two on departure, and already born', () => {
        expect(birthDateBounds('INF', DEPARTS, TODAY)).toEqual({ min: '2024-12-02', max: TODAY, anchor: '2025-12-01' });
    });

    it('measures from today when the departure is not known', () => {
        expect(birthDateBounds('ADT', '', TODAY).max).toBe('2014-10-19');
    });

    it('handles a departure on the 29th of February', () => {
        // 2028-02-29 less two years is a day that does not exist; the 28th is the last day
        // someone can have been born and be two on it.
        expect(birthDateBounds('CHD', '2028-02-29', TODAY).max).toBe('2026-02-28');
    });
});

describe('passportExpiryBounds', () => {
    it('must still be valid on the day of departure, and no more than twenty years out', () => {
        expect(passportExpiryBounds(DEPARTS, TODAY)).toEqual({ min: DEPARTS, max: '2046-10-19', anchor: DEPARTS });
    });

    it('measures from today when the departure is not known', () => {
        expect(passportExpiryBounds('', TODAY).min).toBe(TODAY);
    });
});

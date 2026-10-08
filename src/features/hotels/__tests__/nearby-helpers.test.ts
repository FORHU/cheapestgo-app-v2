import { describe, it, expect } from 'vitest';
import { groupOpeningHours } from '@/features/hotels/components/nearby/opening-hours';
import { googleMapsUrl } from '@/features/hotels/components/nearby/links';

describe('groupOpeningHours', () => {
    it('joins consecutive days with the same hours and marks today', () => {
        expect(groupOpeningHours(['Monday: 9 AM – 5 PM', 'Tuesday: 9 AM – 5 PM', 'Wednesday: Closed'], 'Tuesday')).toEqual([
            { text: 'Monday - Tuesday: 9 AM – 5 PM', includesToday: true },
            { text: 'Wednesday: Closed', includesToday: false },
        ]);
    });

    it('keeps a line with no day as it is', () => {
        expect(groupOpeningHours(['Open 24 hours'], 'Monday')).toEqual([{ text: 'Open 24 hours', includesToday: false }]);
    });

    it('returns nothing for no hours', () => {
        expect(groupOpeningHours(undefined, 'Monday')).toEqual([]);
        expect(groupOpeningHours([], 'Monday')).toEqual([]);
    });
});

describe('googleMapsUrl', () => {
    it('names the place and pins Google’s id when there is one', () => {
        const url = new URL(googleMapsUrl({ name: 'Cafe Onion', placeId: 'g-1' }));
        expect(url.searchParams.get('query')).toBe('Cafe Onion');
        expect(url.searchParams.get('query_place_id')).toBe('g-1');
    });

    it('searches by name alone without one', () => {
        const url = new URL(googleMapsUrl({ name: 'Cafe Onion' }));
        expect(url.searchParams.has('query_place_id')).toBe(false);
    });
});

import { describe, it, expect } from 'vitest';
import { distanceLabel } from '@/features/search/utils/distanceLabel';

/**
 * ADR-0051. A Tokyo search reaches Hachioji, 33 km out and genuinely Tokyo, and the card read
 * "Hachioji, Tokyo" and a price with nothing to say how far that was.
 *
 * Whether to show anything is api-v2's decision — it sends `distanceKm` only past the threshold
 * for the rung searched. This only formats what arrives.
 */
describe('distanceLabel', () => {
    it('names the anchor, because a bare number does not say from what', () => {
        expect(distanceLabel(33, 'Tokyo')).toBe('33 km from Tokyo');
        expect(distanceLabel(2.4, 'Shibuya')).toBe('2.4 km from Shibuya');
    });

    it('keeps a decimal below 10km and drops it above', () => {
        expect(distanceLabel(6.44, 'Shibuya')).toBe('6.4 km from Shibuya');
        expect(distanceLabel(32.7, 'Tokyo')).toBe('33 km from Tokyo');
        expect(distanceLabel(10, 'Tokyo')).toBe('10 km from Tokyo');
    });

    /** A card with no distance is a central one. It must never render a half-sentence. */
    it('says nothing at all when the server sent nothing', () => {
        expect(distanceLabel(null, 'Tokyo')).toBeNull();
        expect(distanceLabel(undefined, 'Tokyo')).toBeNull();
        expect(distanceLabel(NaN, 'Tokyo')).toBeNull();
        expect(distanceLabel(0, 'Tokyo')).toBeNull();
    });

    /**
     * CONTEXT.md, `Search Anchor`: use the name or say nothing. "33 km from centre" does not
     * say the centre of what, and the traveller picked somewhere with a name.
     */
    it('says nothing when it cannot name what the distance is from', () => {
        expect(distanceLabel(33, null)).toBeNull();
        expect(distanceLabel(33, undefined)).toBeNull();
        expect(distanceLabel(33, '   ')).toBeNull();
    });
});

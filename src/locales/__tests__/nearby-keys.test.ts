import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * The nearby-places explorer reads these in every language the storefront serves. A missing key
 * falls back to English mid-sentence, so coverage is asserted here; wording of the strings v1 never
 * had is listed in NEEDS_NATIVE_REVIEW.md for a native speaker.
 */

type Messages = Record<string, unknown>;
const LANGS: Array<[string, Messages]> = [['ko', ko], ['ja', ja], ['zh', zh]];

const read = (messages: Messages, path: string): unknown =>
    path.split('.').reduce<unknown>(
        (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
        messages,
    );

const leaves = (node: unknown, prefix: string): string[] =>
    node && typeof node === 'object'
        ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, `${prefix}.${k}`))
        : [prefix];

const NEARBY = leaves(read(en, 'property.nearby'), 'property.nearby');

const REUSED = [
    'property.mapOverlay.viewOnMaps', 'property.mapOverlay.recenterMap', 'property.mapOverlay.fullscreen',
    'property.mapOverlay.exitFullscreen', 'property.mapOverlay.layers',
    'property.poiDetails.openingHours', 'property.poiDetails.openNow', 'property.poiDetails.closed',
    'property.poiDetails.googleReviews', 'property.poiDetails.noReviews',
    'hotels.nearby.none', 'property.v2.loadingNearby',
];

describe('nearby messages', () => {
    it('exist in English', () => {
        expect(NEARBY.length).toBeGreaterThan(40);
    });

    it.each([...NEARBY, ...REUSED])('%s exists in English', (path) => {
        expect(read(en, path)).toBeTypeOf('string');
    });

    describe.each(LANGS)('%s', (_lang, messages) => {
        it.each([...NEARBY, ...REUSED])('%s', (path) => {
            expect(read(messages, path)).toBeTypeOf('string');
        });
    });
});

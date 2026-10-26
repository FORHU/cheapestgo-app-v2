import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';
import { STAGES, stageFaces } from '@/features/landing/journey/stages';

/**
 * The landing page's Journey — hero, the stages, the closing options — in every language the
 * storefront serves.
 *
 * Its copy used to be English literals in `Journey.tsx` and `stages.ts`, so the language selector
 * changed the header and footer and left everything between them in English. Coverage is asserted
 * here so a string added to the Journey without its translations fails a test instead of
 * shipping as English in /ko. The Korean, Japanese and Chinese are listed in
 * NEEDS_NATIVE_REVIEW.md.
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

const argNames = (value: unknown): string[] =>
    [...new Set([...String(value).matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]))].sort();

/**
 * The search bar the stages mount has strings of its own, filed with the rest of its wording:
 * the stamp and the traveller panel's heading, and the stand-ins its sentence shows until
 * something is picked.
 */
const SEARCH_BAR = [
    'landing.search.go',
    'landing.search.whosComing',
    'search.prose.origin',
    'search.prose.aDate',
    'search.prose.yourDates',
    'search.prose.flexibleTrip',
];

const JOURNEY = [...leaves(read(en, 'landing.journey'), 'landing.journey'), ...SEARCH_BAR];

/** Reused from elsewhere in the catalogue rather than written twice. */
const REUSED = [
    'landing.search.searchMode.stays',
    'landing.search.searchMode.flights',
    'landing.search.adults',
    'landing.search.children',
    'checkout.flight.whosFlying',
];

/** The same word in every language: a unit, not a sentence. */
const SAME_EVERYWHERE = ['landing.journey.altitude.unit'];

describe('landing journey messages', () => {
    it('exist in English', () => {
        expect(JOURNEY.length).toBeGreaterThan(25);
    });

    it.each([...JOURNEY, ...REUSED])('%s exists in English', (path) => {
        expect(read(en, path)).toBeTypeOf('string');
    });

    it('cover every stage the page can show, and the one parked for later', () => {
        const ids = [...new Set([...STAGES.flatMap(stageFaces).map((f) => f.id), 'ai'])];
        for (const id of ids) {
            for (const field of ['eyebrow', 'titleLead', 'titleRest', 'caption']) {
                expect(read(en, `landing.journey.stages.${id}.${field}`), `${id}.${field}`).toBeTypeOf('string');
            }
        }
    });

    describe.each(LANGS)('%s', (_lang, messages) => {
        it.each([...JOURNEY, ...REUSED])('%s is translated', (path) => {
            expect(read(messages, path)).toBeTypeOf('string');
            expect(String(read(messages, path)).trim()).not.toBe('');
        });

        it.each(JOURNEY.filter((p) => !SAME_EVERYWHERE.includes(p)))('%s is not left in English', (path) => {
            expect(read(messages, path)).not.toBe(read(en, path));
        });

        it.each(JOURNEY)('%s uses the same arguments as English', (path) => {
            expect(argNames(read(messages, path))).toEqual(argNames(read(en, path)));
        });
    });
});

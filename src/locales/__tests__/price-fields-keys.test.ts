import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * The stays filter's typed price range reads these in every language the storefront serves. A
 * missing key falls back to English mid-panel, so coverage is asserted here; the wording is listed
 * in NEEDS_NATIVE_REVIEW.md for a native speaker.
 */

type Messages = Record<string, unknown>;
const LANGS: Array<[string, Messages]> = [['en', en], ['ko', ko], ['ja', ja], ['zh', zh]];

const KEYS = [
    'min', 'max', 'minPerNight', 'maxPerNight', 'priceEmpty', 'priceMinAboveMax', 'priceMaxBelowMin',
].map((k) => `hotels.filters.${k}`);

const read = (messages: Messages, path: string): unknown =>
    path.split('.').reduce<unknown>(
        (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
        messages,
    );

describe.each(LANGS)('price field messages in %s', (_lang, messages) => {
    it.each(KEYS)('%s', (path) => {
        expect(read(messages, path)).toBeTypeOf('string');
    });
});

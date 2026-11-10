import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * My Bookings' search, in every language the storefront serves. A missing key falls back to
 * English mid-page; the wording is listed in NEEDS_NATIVE_REVIEW.md for a native speaker.
 */

type Messages = Record<string, unknown>;
const LANGS: Array<[string, Messages]> = [['ko', ko], ['ja', ja], ['zh', zh]];

const read = (messages: Messages, path: string): unknown =>
    path.split('.').reduce<unknown>(
        (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
        messages,
    );

const argNames = (value: unknown): string[] =>
    [...new Set([...String(value).matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]))].sort();

const KEYS = ['label', 'placeholder', 'clear', 'noMatch', 'noMatchHint', 'results'].map((k) => `trips.search.${k}`);

describe('trips search messages', () => {
    it.each(KEYS)('%s exists in English', (path) => {
        expect(read(en, path)).toBeTypeOf('string');
    });

    describe.each(LANGS)('%s', (_lang, messages) => {
        it.each(KEYS)('%s exists and takes the same arguments as English', (path) => {
            expect(read(messages, path)).toBeTypeOf('string');
            expect(argNames(read(messages, path))).toEqual(argNames(read(en, path)));
        });
    });
});

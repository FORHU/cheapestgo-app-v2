import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * The note over a new flight search when the fare picked had gone, in every language the
 * storefront serves. It says whether money moved, so a missing key — English mid-page, or the
 * key itself — costs more than it would elsewhere. The wording is listed in NEEDS_NATIVE_REVIEW.md.
 */

type Messages = Record<string, unknown>;

const read = (messages: Messages, path: string): unknown =>
    path.split('.').reduce<unknown>(
        (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
        messages,
    );

const KEYS = ['flights.results.fareGoneTitle', 'flights.results.fareGoneBody'];

describe.each([['en', en], ['ko', ko], ['ja', ja], ['zh', zh]] as Array<[string, Messages]>)('%s', (_lang, messages) => {
    it.each(KEYS)('%s', (path) => {
        expect(read(messages, path)).toBeTypeOf('string');
    });
});

import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * What the flight results card says on a phone, in every language the storefront serves: its
 * button and link, and the badges it borrows from the filter panel's sort names. A missing key
 * falls back to English mid-card; the new wording is listed in NEEDS_NATIVE_REVIEW.md.
 */

type Messages = Record<string, unknown>;

const read = (messages: Messages, path: string): unknown =>
    path.split('.').reduce<unknown>(
        (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
        messages,
    );

const KEYS = ['flights.card.select', 'flights.card.flightDetails', 'flights.filters.cheapest', 'flights.filters.fastest'];

describe.each([['en', en], ['ko', ko], ['ja', ja], ['zh', zh]] as Array<[string, Messages]>)('%s', (_lang, messages) => {
    it.each(KEYS)('%s', (path) => {
        expect(read(messages, path)).toBeTypeOf('string');
    });
});

import { describe, it, expect } from 'vitest';
import en from '@/locales/en.json';
import ko from '@/locales/ko.json';
import ja from '@/locales/ja.json';
import zh from '@/locales/zh.json';
import { GOLF_AMENITIES, GOLF_EXTRAS } from '@/features/golf/types';

/**
 * Golf's strings exist in every language. next-intl shows a missing key as the key itself, so a
 * Korean page with one gap reads "golf.emptyTitle" where a sentence should be.
 */

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ''): string[] =>
    Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));

describe('golf messages', () => {
    it.each([['ko', ko], ['ja', ja], ['zh', zh]] as const)('%s has exactly the keys English has', (_, messages) => {
        expect(keys(messages.golf as Tree).sort()).toEqual(keys(en.golf as Tree).sort());
    });

    it('labels every amenity a course can list', () => {
        expect(Object.keys(en.golf.amenities).sort()).toEqual([...GOLF_AMENITIES].sort());
    });

    it('names every extra a course can offer', () => {
        expect(Object.keys(en.golf.booking.extraNames).sort()).toEqual([...GOLF_EXTRAS].sort());
    });

    it.each([['en', en], ['ko', ko], ['ja', ja], ['zh', zh]] as const)('%s names the search bar Golf tab', (_, messages) => {
        expect(messages.landing.search.searchMode.golf).toBeTruthy();
    });
});

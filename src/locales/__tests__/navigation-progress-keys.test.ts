import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * The name of the bar across the top while another page loads, for a screen reader, in every
 * language the storefront serves. The wording is listed in NEEDS_NATIVE_REVIEW.md.
 */

const LANGS: Array<[string, { common: Record<string, unknown> }]> = [['en', en], ['ko', ko], ['ja', ja], ['zh', zh]];

describe('common.loadingPage', () => {
    it.each(LANGS)('exists in %s', (_lang, messages) => {
        expect(messages.common.loadingPage).toBeTypeOf('string');
        expect(String(messages.common.loadingPage).length).toBeGreaterThan(0);
    });
});

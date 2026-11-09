import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * The theme choice in the phone's settings sheet, in every language the storefront serves. The
 * wording is listed in NEEDS_NATIVE_REVIEW.md.
 */

const LANGS: Array<[string, { common: Record<string, unknown> }]> = [['en', en], ['ko', ko], ['ja', ja], ['zh', zh]];
const KEYS = ['theme', 'themeLight', 'themeDark'];

describe.each(LANGS)('the settings sheet in %s', (_lang, messages) => {
    it.each(KEYS)('has common.%s', (key) => {
        expect(messages.common[key]).toBeTypeOf('string');
        expect(String(messages.common[key]).length).toBeGreaterThan(0);
    });
});

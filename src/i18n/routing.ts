import { defineRouting } from 'next-intl/routing';

/**
 * The locale lives in the URL, not in a cookie - see ADR-0015 in cheapest-go-app.
 *
 * `zh` is the BCP-47 language subtag for Chinese. `cn` is the ISO-3166 country
 * code for China and is not a language; next-intl, hreflang and Accept-Language
 * all expect the former.
 *
 * `as-needed` keeps English unprefixed, so existing `/property/123` links stay
 * valid and only ko/ja/zh gain a prefix.
 */
export const routing = defineRouting({
    locales:       ['en', 'ko', 'ja', 'zh'],
    defaultLocale: 'en',
    localePrefix:  'as-needed',
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string): value is Locale {
    return (routing.locales as readonly string[]).includes(value);
}

import { getRequestConfig } from 'next-intl/server';
import { routing, isLocale } from './routing';
import { applyBrand } from './applyBrand';

/**
 * Merge a locale's messages over English so a missing key falls back to the
 * English string rather than rendering as a raw key. This matters more here than
 * it does in v1: v2's locale files are still a fraction of v1's, so most keys are
 * absent from ko/ja/zh and would otherwise show up as `nav.search` on screen.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key of Object.keys(source) as (keyof T)[]) {
        const srcVal = source[key];
        if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
            result[key] = deepMerge(
                (result[key] as Record<string, unknown>) || {},
                srcVal as Record<string, unknown>,
            ) as T[keyof T];
        } else if (srcVal !== undefined) {
            result[key] = srcVal as T[keyof T];
        }
    }
    return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
    // Priority: brand lock > the [locale] route segment > default.
    //
    // The brand lock is how GeomeeGo is served in Korean only (ADR-0005). There
    // is deliberately no cookie in this chain: a cookie that outranked the URL
    // would make a shared /ko/... link render in the recipient's language.
    const locked = process.env.NEXT_PUBLIC_LOCALE;

    let locale: string;
    if (locked && isLocale(locked)) {
        locale = locked;
    } else {
        const fromSegment = await requestLocale;
        // Routes outside app/[locale] - /admin - have no segment and get the default.
        locale = fromSegment && isLocale(fromSegment) ? fromSegment : routing.defaultLocale;
    }

    const enMessages = (await import('../locales/en.json')).default;

    if (locale === routing.defaultLocale) {
        return { locale, messages: applyBrand(enMessages) };
    }

    const localeMessages = (await import(`../locales/${locale}.json`)).default;

    // Brand after merging, so keys a locale hasn't translated yet inherit the English
    // string and get branded too rather than falling back to the wrong name.
    return {
        locale,
        messages: applyBrand(deepMerge(enMessages, localeMessages)),
    };
});

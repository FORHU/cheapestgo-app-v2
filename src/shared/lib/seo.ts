/**
 * Canonical and `hreflang` URLs, and the single place that knows which locales a deployment
 * serves.
 *
 * Two shapes of deployment, decided by `NEXT_PUBLIC_LOCALE`:
 *
 * - **Locked** (AirangGo sets `ko`). It serves exactly one language, at the root, with no URL
 *   prefix. A prefix does not switch language there — `airanggo.com/ja/about` renders Korean —
 *   so a locked deployment has no alternates to declare and every canonical is unprefixed.
 *   That also folds those prefixed URLs onto the real one rather than letting them stand as
 *   separate pages.
 * - **Unlocked** (CheapestGo). English at the root, `PREFIXED_LOCALES` under a prefix.
 *
 * Korean is deliberately missing from `PREFIXED_LOCALES`: a language has exactly one home and
 * Korean's is `airanggo.com` (ADR-0037). `/ko` still answers — it is simply no longer
 * advertised in a sitemap or an alternate. A visitor who reaches it still gets a canonical
 * naming that same Korean URL, because claiming to be the English page is what made Google
 * discard it.
 *
 * This list is not duplicated anywhere. Two copies is how v1's sitemap came to advertise URLs
 * its own pages did not agree with.
 */

import { getLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

const DEFAULT_LOCALE = routing.defaultLocale;

/** Locales advertised under a URL prefix. Not the same as the locales that are *served*. */
const PREFIXED_LOCALES = ['ja', 'zh'] as const;

/** The locale this deployment is locked to, or null when it serves several. */
function lockedLocale(): string | null {
    const value = (process.env.NEXT_PUBLIC_LOCALE ?? '').trim();
    return value.length > 0 ? value : null;
}

/**
 * Where a path is served for a given locale: `/about` + `ja` → `/ja/about`.
 *
 * The default locale, and every locale on a locked deployment, are served unprefixed.
 */
export function localePath(path: string, locale: string, locked: string | null = lockedLocale()): string {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    if (locked !== null || locale === DEFAULT_LOCALE) return normalised;
    return `/${locale}${normalised === '/' ? '' : normalised}`;
}

/** Every locale this deployment serves, each with the path it is served at. */
export function servedLocalePaths(
    path: string,
    locked: string | null = lockedLocale(),
): { locale: string; path: string }[] {
    const locales = locked !== null ? [locked] : [DEFAULT_LOCALE, ...PREFIXED_LOCALES];
    return locales.map((locale) => ({ locale, path: localePath(path, locale, locked) }));
}

/**
 * The `alternates.languages` map, or undefined on a locked deployment — one language has
 * nothing to alternate with, and declaring alternates it does not serve is a false claim.
 */
export function hreflang(path: string, locked: string | null = lockedLocale()): Record<string, string> | undefined {
    if (locked !== null) return undefined;
    const languages = Object.fromEntries(servedLocalePaths(path, null).map(({ locale, path: at }) => [locale, at]));
    // x-default is what a crawler serves for a language we do not publish.
    return { ...languages, 'x-default': localePath(path, DEFAULT_LOCALE, null) };
}

/**
 * The URL this page should name as its own.
 *
 * It carries the locale prefix the page is actually served under. Returning the unprefixed
 * path made every `/ja` and `/zh` page declare the English page as canonical, which tells
 * Google they are duplicates rather than pages of their own — the reason a whole language can
 * be absorbed into the English site instead of indexed.
 */
export function canonicalPath(path: string, locale: string, locked: string | null = lockedLocale()): string {
    return localePath(path, locale, locked);
}

/**
 * Canonical plus languages for the locale of the current request.
 *
 *   export async function generateMetadata() {
 *     return { title, alternates: await hreflangAlternates('/terms') };
 *   }
 *
 * Async because the canonical depends on the request's locale, which is why a page using it
 * cannot export a static `metadata` object.
 */
export async function hreflangAlternates(path: string) {
    const locale = await getLocale();
    return {
        canonical: canonicalPath(path, locale),
        languages: hreflang(path),
    };
}

export { DEFAULT_LOCALE, PREFIXED_LOCALES };

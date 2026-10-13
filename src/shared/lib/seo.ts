/**
 * Canonical and `hreflang` URLs, and the single place that knows which locales a deployment
 * serves.
 *
 * Two shapes of deployment, decided by `NEXT_PUBLIC_LOCALE`:
 *
 * - **Locked** (AirangGo sets `ko`). It serves exactly one language, at the root, with no URL
 *   prefix. A prefix does not switch language there — `airanggo.com/ja/about` renders Korean —
 *   so every canonical is unprefixed, which folds those prefixed URLs onto the real one rather
 *   than letting them stand as separate pages.
 * - **Unlocked** (CheapestGo). English at the root, `PREFIXED_LOCALES` under a prefix.
 *
 * Both domains declare the same `hreflang` set: all four languages, each at its own home in
 * `LANGUAGE_HOMES`. Google ignores alternates that are not confirmed from the other side, so a
 * set only one domain declared would be discarded — AirangGo naming CheapestGo's English,
 * Japanese and Chinese pages is what lets CheapestGo's Korean alternate count.
 *
 * `cheapestgo.com/ko` still answers until the redirect lands. It is in no sitemap and no
 * alternate, and a visitor who reaches it gets a canonical naming that same Korean URL,
 * because claiming to be the English page is what made Google discard it.
 *
 * The list of languages is not duplicated in `src/app/sitemap.ts`. Two copies are how v1's
 * sitemap came to advertise URLs its own pages did not agree with.
 */

import { getLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

const DEFAULT_LOCALE = routing.defaultLocale;

/**
 * Where each language is served in production — the decision in ADR-0037, written down once.
 *
 * Production origins on purpose, not `NEXT_PUBLIC_SITE_URL`: an alternate names the page in
 * another language on the live site. A deployment's own languages are still emitted as
 * relative paths, so a local or staging build points at itself for those.
 */
const LANGUAGE_HOMES: Record<string, string> = {
    en: 'https://cheapestgo.com',
    ja: 'https://cheapestgo.com',
    zh: 'https://cheapestgo.com',
    ko: 'https://airanggo.com',
};

/** Languages served under a prefix beside the default: those sharing the default's home. */
const PREFIXED_LOCALES = Object.keys(LANGUAGE_HOMES).filter(
    (locale) => locale !== DEFAULT_LOCALE && LANGUAGE_HOMES[locale] === LANGUAGE_HOMES[DEFAULT_LOCALE],
);

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
 * Where `path` lives in `locale`: relative when this deployment serves that language,
 * otherwise absolute at the language's home. A home holding a single language is shaped like a
 * locked deployment and serves it unprefixed.
 */
function alternateUrl(path: string, locale: string, locked: string | null): string {
    if (servedLocalePaths(path, locked).some((served) => served.locale === locale)) {
        return localePath(path, locale, locked);
    }
    const home = LANGUAGE_HOMES[locale];
    const languagesAtHome = Object.keys(LANGUAGE_HOMES).filter((l) => LANGUAGE_HOMES[l] === home);
    return `${home}${localePath(path, locale, languagesAtHome.length === 1 ? locale : null)}`;
}

/**
 * The `alternates.languages` map: every language at its home, plus `x-default` at the default
 * language's page. Identical on both domains, which is what makes it count.
 */
export function hreflang(path: string, locked: string | null = lockedLocale()): Record<string, string> {
    const languages = Object.fromEntries(
        Object.keys(LANGUAGE_HOMES).map((locale) => [locale, alternateUrl(path, locale, locked)]),
    );
    return { ...languages, 'x-default': alternateUrl(path, DEFAULT_LOCALE, locked) };
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

export { DEFAULT_LOCALE, PREFIXED_LOCALES, LANGUAGE_HOMES };

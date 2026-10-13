import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for next/link and next/navigation.
 *
 * They have the same API as the originals, so a call site only changes its
 * import. What they add is the locale prefix: a `<Link href="/deals">` rendered
 * on /ko/about navigates to /ko/deals rather than dropping to English. That is
 * the whole point of ADR-0015 - the language belongs to the URL, so a link
 * someone shares carries it, and a crawler stays in one language across the site.
 *
 * Import these everywhere under app/[locale]. Routes outside the locale segment
 * (/admin) keep next/navigation: they are staff-facing and English-only.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);

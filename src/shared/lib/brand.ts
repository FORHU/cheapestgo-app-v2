/**
 * How a brand's name is written on screen.
 *
 * Four surfaces rendered the wordmark by splitting the name inline so the trailing "Go"
 * could be accented — the header, the footer, the landing wordmark and the landing
 * copyright. Written out by hand in each, none of them could follow a rename, and v1
 * learned what that costs: its admin sidebar shipped "GeomeGo", one `e` short of the
 * brand it was naming, and nothing caught it.
 *
 * Centralised so a rename is one edit, and so the legacy-name mapping below exists in
 * exactly one place.
 */

/**
 * Brand names that have changed, mapped to what they are called now.
 *
 * The Korean brand was GeomeeGo until the 2026-09 rebrand to AirangGo. This mapping is
 * what lets the UI show the new name before the Korean instance is redeployed — that
 * process is still started with `NEXT_PUBLIC_BRAND_NAME=GeomeeGo`, and will be until it
 * is rebuilt with the new value. Remove an entry only once no running deployment can
 * still be serving it.
 */
const RENAMED_BRANDS: Record<string, string> = {
    GeomeeGo: 'AirangGo',
};

/** The brand's current name, whatever historical name the process was started with. */
export function canonicalBrandName(brandName?: string | null): string {
    const raw = (brandName ?? '').trim() || 'CheapestGo';
    return RENAMED_BRANDS[raw] ?? raw;
}

/**
 * The brand this build was made for.
 *
 * Not "the brand being shown": a deployment with the brand preview on (below) can show the other
 * one, so anything that prints the brand reads `getBrandName()` on the server or `useBrandName()`
 * in the browser. This is the answer they fall back to, and the only answer on production.
 */
export const DEPLOYMENT_BRAND_NAME = canonicalBrandName(process.env.NEXT_PUBLIC_BRAND_NAME);

/**
 * ── Brand preview ──────────────────────────────────────────────────────────────────────────
 *
 * ADR-0005 builds one deployment per brand and rejects switching on the request, because a
 * runtime brand makes every brand conditional a runtime branch and ties the two brands'
 * rollbacks together. That reasoning is about production, and it stands: with the preview off
 * (the default) nothing below changes the brand.
 *
 * An unfinished v2 is not production. It is deployed so the work can be looked at, and looking
 * at both brands from one deployment — rather than standing up a second build for each branch —
 * is what the preview is for. It is off unless the deployment sets `BRAND_PREVIEW=1`, or the
 * process is a local dev server, so a production build cannot be switched by a link.
 *
 * The preview is display-only. It changes what the storefront says and shows; api-v2 still
 * attributes a booking to the brand it was itself started with.
 */

/** The brands a preview may switch between. An allowlist, not a free string: the value is
 *  printed into titles, copy and the privacy policy. */
const PREVIEW_BRANDS = ['CheapestGo', 'AirangGo'] as const;
export type PreviewBrand = (typeof PREVIEW_BRANDS)[number];

/** The cookie that remembers a visitor's choice. Set by the middleware, read on the server. */
export const BRAND_PREVIEW_COOKIE = 'brand_preview';
/** `?brand_preview=airanggo` picks a brand; `?brand_preview=default` clears the choice. A name
 *  of its own rather than `brand`, which reads as a hotel-chain filter. */
export const BRAND_PREVIEW_PARAM = 'brand_preview';
export const BRAND_PREVIEW_RESET = 'default';

/** Whether this process lets a visitor choose the brand. */
export function brandPreviewEnabled(
    env: { BRAND_PREVIEW?: string; NODE_ENV?: string } = {
        BRAND_PREVIEW: process.env.BRAND_PREVIEW,
        NODE_ENV:      process.env.NODE_ENV,
    },
): boolean {
    // Spelled out rather than "any non-empty value": "0" and "false" are truthy strings.
    const flag = (env.BRAND_PREVIEW ?? '').trim().toLowerCase();
    return flag === '1' || flag === 'true' || env.NODE_ENV === 'development';
}

/** A brand a visitor asked for, if it is one the preview offers. */
export function parsePreviewBrand(value?: string | null): PreviewBrand | null {
    const raw = (value ?? '').trim();
    if (!raw) return null;
    const wanted = raw.toLowerCase();
    // A renamed brand is asked for by its old name too, case-insensitively as a link would be.
    const renamed = Object.entries(RENAMED_BRANDS).find(([old]) => old.toLowerCase() === wanted)?.[1];
    const target = (renamed ?? raw).toLowerCase();
    return PREVIEW_BRANDS.find((brand) => brand.toLowerCase() === target) ?? null;
}

/** Each brand's own domains, geomeego.com included until DNS moves (ADR-0005 amendment). */
const BRAND_DOMAINS: Record<PreviewBrand, readonly string[]> = {
    CheapestGo: ['cheapestgo.com'],
    AirangGo:   ['airanggo.com', 'geomeego.com'],
};

/**
 * The brand whose domain `host` is on — `airanggo.com`, `v2.airanggo.com:3000`.
 *
 * Whole-label matches only. A host that merely contains a brand's name — a Vercel project called
 * `cheapestgo-app-v2` — says nothing, or it would override a build made for the other brand.
 */
export function brandFromHost(host?: string | null): PreviewBrand | null {
    const name = (host ?? '').trim().toLowerCase().replace(/:\d+$/, '');
    if (!name) return null;
    for (const brand of PREVIEW_BRANDS) {
        if (BRAND_DOMAINS[brand].some((domain) => name === domain || name.endsWith(`.${domain}`))) {
            return brand;
        }
    }
    return null;
}

/**
 * The brand to show: what the visitor picked, then what the host implies, then what the build is.
 * With the preview off it is the build's brand, whatever the cookie and host say.
 */
export function resolveBrandName(input: {
    deployment?: string | null;
    enabled:     boolean;
    cookie?:     string | null;
    host?:       string | null;
}): string {
    const own = canonicalBrandName(input.deployment);
    if (!input.enabled) return own;
    return parsePreviewBrand(input.cookie) ?? brandFromHost(input.host) ?? own;
}

/**
 * What a brand looks like outside the page's own markup: its origin, tab icon and share logo.
 *
 * The share logo is the wordmark on a light ground — Open Graph cards and link previews are
 * drawn on white, so the dark-background variants v1 also ships (`AirangGo.png`, whose "Airang"
 * is white) would show only "Go".
 */
export interface BrandProfile {
    /** The brand's own site, for structured data. */
    origin:  string;
    /** Tab and home-screen icon. */
    favicon: string;
    /** The wordmark for a share card. */
    logo:    string;
    /** The square mark structured data names as the logo. */
    icon:    string;
}

const CHEAPESTGO_PROFILE: BrandProfile = {
    origin:  'https://cheapestgo.com',
    favicon: '/Fav_Icon_Light.png',
    logo:    '/Web_Logo_Light.png',
    icon:    '/icon-192.png',
};

const AIRANGGO_PROFILE: BrandProfile = {
    origin:  'https://airanggo.com',
    favicon: '/Airang_Fav.png',
    logo:    '/Airanggo_transparent.png',
    icon:    '/Airang_Fav.png',
};

/** A brand with no art of its own gets CheapestGo's, as every brand did before this existed. */
export function brandProfile(brandName?: string | null): BrandProfile {
    return canonicalBrandName(brandName) === 'AirangGo' ? AIRANGGO_PROFILE : CHEAPESTGO_PROFILE;
}

/**
 * The wordmark split into the part rendered plainly and the part rendered in the accent
 * colour — "Cheapest" + "Go", "Airang" + "Go". A brand whose name does not end in "Go"
 * gets the whole name as `head` and an empty `tail`, so the caller's markup still works.
 */
export function brandWordmark(brandName?: string | null): { head: string; tail: string } {
    const name = canonicalBrandName(brandName);
    return name.endsWith('Go') && name.length > 2
        ? { head: name.slice(0, -2), tail: 'Go' }
        : { head: name, tail: '' };
}

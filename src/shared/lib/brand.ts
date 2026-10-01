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

/** The brand this deployment serves. */
export const BRAND_NAME = canonicalBrandName(process.env.NEXT_PUBLIC_BRAND_NAME);

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

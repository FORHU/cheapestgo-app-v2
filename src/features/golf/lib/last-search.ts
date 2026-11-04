/**
 * Where a course page's back arrow goes: the golf search that led there.
 *
 * Not the browser's history, which cannot say: someone who went on to the checkout and came back
 * has the checkout behind them, and "back" put them on it, again and again. Nor `document.referrer`,
 * which is fixed when the tab loads and does not move as the visitor goes from page to page.
 *
 * Per tab, which is one visit: it lasts through the sign-in a checkout may send someone to, and a
 * shared link opened in a new tab has no search behind it, so that goes to the catalogue.
 */
const KEY = 'golfSearch';
const CATALOGUE = '/golf';

/** The landing page's search on its Golf face. `Journey` docks there when it opens on this address. */
export const GOLF_FACE = '/?search=golf';

export const isGolfFace = (search: string) => new URLSearchParams(search).get('search') === 'golf';

export function rememberGolfSearch(href: string): void {
    try { sessionStorage.setItem(KEY, href); } catch { /* storage blocked: back goes to the catalogue */ }
}

export function lastGolfSearch(): string {
    try { return sessionStorage.getItem(KEY) ?? CATALOGUE; } catch { return CATALOGUE; }
}

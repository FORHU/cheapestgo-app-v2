import { BRAND } from '@/shared/lib/palette';

/**
 * The tokens the search toolbar and everything sitting on it are drawn from.
 *
 * In the original CheapestGo palette (`shared/lib/palette.ts`): slate surfaces, slate
 * ink, v1's blue for the one accent.
 *
 * Split out of the search page when the map view's bar became the list view's
 * too: the bar, the search field and the sort pill all read the same palette,
 * and they were only ever in one file because the bar was only ever in one
 * view.
 */

export type SortValue = 'recommended' | 'price-low' | 'price-high' | 'rating' | 'most-reviewed';

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
    { value: 'recommended',   label: 'Recommended' },
    { value: 'price-low',     label: 'Cheapest first' },
    { value: 'rating',        label: 'Top Rated' },
    { value: 'most-reviewed', label: 'Most Reviewed' },
    { value: 'price-high',    label: 'Price: High to Low' },
];

/**
 * The map's chrome, as three tones rather than one: the toolbar `bar` is the
 * ground, the controls sitting on it are a step lighter (`surface`), and the
 * search `field` is a step darker still, which is what makes it read as an
 * input rather than another button.
 */
export function sortPalette(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    return {
        bar:     dark ? '#0f172a' : '#f1f5f9',   // slate-900 / slate-100
        surface: dark ? '#1e293b' : '#FFFFFF',   // slate-800 / white
        field:   dark ? '#020617' : '#FFFFFF',   // obsidian / white
        text:    dark ? '#f8fafc' : '#0f172a',
        border:  dark ? 'rgba(255,255,255,0.10)' : '#e2e8f0',
        menu:    dark ? '#0f172a' : '#FFFFFF',
        hover:   dark ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
        shadow:  dark ? '0 8px 28px rgba(0,0,0,0.55)' : '0 8px 24px rgba(15,23,42,0.16)',
    };
}


/**
 * The map toolbar's circular icon buttons — back, nearby places, theme.
 *
 * 40px on desktop — the size they were before the map and list toolbars were
 * merged — and 24px on the phone bar, where the row has to fit more controls in
 * less width. Shared as a constant because several buttons carrying the same
 * geometry inline is how they drift apart.
 */
export const ICON_BTN =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full cursor-pointer ' +
    'transition-opacity hover:opacity-80 md:h-10 md:w-10';

/**
 * The one accent the search page paints with — the brand's blue-to-cyan gradient, the
 * same as every button on the landing page. It is a CSS gradient, so it can only be a
 * `background`; an icon takes it through `BRAND_STROKE` (`shared/components/BrandStroke`).
 */
export const ACCENT = BRAND.gradient;

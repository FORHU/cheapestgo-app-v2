/**
 * The tokens the search toolbar and everything sitting on it are drawn from.
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
        bar:     dark ? '#16171A' : '#ECECEF',
        surface: dark ? '#232428' : '#FFFFFF',
        field:   dark ? '#000000' : '#FFFFFF',
        text:    dark ? '#FFFFFF' : '#111111',
        border:  dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        menu:    dark ? '#1B1C20' : '#FFFFFF',
        hover:   dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
        shadow:  dark ? '0 8px 28px rgba(0,0,0,0.55)' : '0 8px 24px rgba(15,23,42,0.16)',
    };
}


/**
 * The map toolbar's circular icon buttons — back, nearby places, theme.
 *
 * 28px on desktop, down from 40. Small enough to read as chrome beside the
 * search field rather than competing with it, and still clear of the 24px
 * minimum target size WCAG 2.5.8 asks for. Shared as a constant because three
 * buttons carrying the same geometry inline is how they drift apart.
 */
export const ICON_BTN =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full cursor-pointer ' +
    'transition-opacity hover:opacity-80 md:h-7 md:w-7';

/** The one accent the search page paints with. */
export const ACCENT = '#FF6B4B';

/**
 * Shared look for the small header dropdowns (locale, currency).
 *
 * Both are glass: a white wash over a blurred backdrop, borrowed from the
 * search bar's Stays/Flights slider (`immersive-search-bar.tsx`) so the two
 * controls read as the same material. `onDark` takes that slider's exact
 * recipe — 18% white on a 32% white hairline. `default` sits in the themed app
 * header over ordinary page content rather than the hero video, so it carries
 * the same idea at a weight that stays legible on a light canvas.
 *
 * The blur is deeper than the slider's 8px: these panels cover far more
 * backdrop, and 8px leaves whatever is behind them legible through the text.
 *
 * Both menus are one column of edge-to-edge rows split by hairlines, so the
 * tone carries a `divider` and a `glyph` (the bright trailing mark: a currency
 * symbol) alongside the row colours.
 */

export type SelectorVariant = 'default' | 'onDark';

/**
 * A palette handed in by the caller, for a selector sitting on chrome whose
 * colours are not the app theme's.
 *
 * The search map's toolbar is the case this exists for. Its tone is the app
 * theme *inverted* — it contrasts the basemap rather than following the page —
 * and the view hardcodes `dark` on its own root, so a `dark:` variant resolves
 * to the dark skin there no matter which way the bar underneath is drawn.
 * Neither variant above can express that: the values have to arrive from
 * whoever drew the bar.
 *
 * Shaped to what the toolbar's own `sortPalette` returns, so it passes its
 * palette straight through and the bar and the controls on it cannot drift.
 */
export interface SelectorChrome {
    /** A control at rest, against the bar. */
    surface: string;
    text: string;
    border: string;
    /** The dropdown's ground — a step off `surface`, as on the sort menu. */
    menu: string;
    /** A row under the cursor, and the row already chosen. */
    hover: string;
    shadow: string;
}

interface SelectorTone {
    trigger: string;
    menu: string;
    divider: string;
    item: (selected: boolean) => string;
    glyph: (selected: boolean) => string;
    /** Hairline around a flag chip. `onDark` cannot use the themed default:
     *  the landing page is dark even when the app theme is light. */
    flagRing: string;
}

export const SELECTOR_TONES: Record<SelectorVariant, SelectorTone> = {
    default: {
        trigger: 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5',
        menu:
            'rounded-2xl ' +
            'bg-white/60 dark:bg-white/[0.12] backdrop-blur-[18px] backdrop-saturate-150 ' +
            'shadow-[0_18px_40px_-16px_rgba(15,23,42,0.35)]',
        divider: '',
        item: (selected) =>
            selected
                ? 'bg-blue-500/15 text-blue-700 dark:bg-white/20 dark:text-white'
                : 'text-slate-800 dark:text-white/85 hover:bg-white/50 dark:hover:bg-white/10',
        glyph: (selected) =>
            selected ? 'text-blue-700 dark:text-white' : 'text-slate-900 dark:text-white',
        flagRing: '',
    },
    onDark: {
        trigger: 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/[0.07]',
        menu:
            'rounded-[20px] bg-white/[0.18] ' +
            'backdrop-blur-[18px] backdrop-saturate-150 ' +
            'shadow-[0_26px_55px_-18px_rgba(0,0,0,0.7)]',
        divider: '',
        item: (selected) =>
            selected ? 'bg-white/25 text-white' : 'text-white/85 hover:bg-white/[0.14]',
        glyph: () => 'text-white',
        flagRing: 'ring-white/25',
    },
};

import { BRAND, brandTheme } from '@/shared/lib/palette';

// The colours the checkout paints with. Lived at the top of the checkout page; moved here so
// the panels that explain a changed price or a settling booking can share them rather than
// copy them.

/**
 * The checkout's accent: the brand's blue (blue-500), as a solid colour — for text, icons,
 * rules and the `${ACCENT}14` tints the notices use. Readable on both grounds.
 */
export const ACCENT = BRAND.primary;
/** The brand gradient, blue-600 → cyan-500: what fills the main action and the current step,
 *  and rings the field being typed in. A CSS gradient, so only ever a `background`. */
export const ACCENT_FILL = BRAND.gradient;
export const GREEN  = '#2FB67F';
export const DANGER = '#E4685A';

/**
 * Every colour the checkout paints with, picked by theme rather than a `dark:` variant.
 *
 * The brand's own (`shared/lib/palette.ts`), as on the landing, search and property pages
 * the checkout is reached from: the obsidian / alabaster ground, slate ink, and the blue
 * family for anything interactive. The checkout used to carry its own violet field fill and
 * an orange accent, and read as a different product from the page before it.
 */
export function checkoutPalette(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    const brand = brandTheme(theme);
    return {
        bg:            brand.ground,
        title:         brand.title,
        text:          brand.text,
        soft:          dark ? '#cbd5e1' : '#475569',   // slate-300 / slate-600
        muted:         brand.muted,
        faint:         dark ? '#64748b' : '#94a3b8',   // slate-500 / slate-400
        hairline:      brand.hairline,
        /** An input: slate-800 on the dark ground; white, ruled in slate-200, on the light. */
        fieldBg:       dark ? '#1e293b' : '#ffffff',
        fieldBorder:   dark ? 'rgba(255,255,255,.08)' : '#e2e8f0',
        /** An icon beside a label — the search form's blue-400 / blue-600. */
        icon:          brand.link,
        summaryBg:     dark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.03)',
        summaryBorder: dark ? 'rgba(255,255,255,.08)' : '#e2e8f0',
        menuBg:        brand.surface,
        /** The one raised plate — the summary card, the payment panel, the toolbar discs:
         *  slate-900 on the dark ground, slate-100 on the light. */
        surface:       dark ? BRAND.surface : '#f1f5f9',
        /** Rules inside the summary card, a step louder than `hairline` so they still read
         *  against `surface` rather than against the page. */
        cardLine:      dark ? 'rgba(255,255,255,.14)' : '#cbd5e1',
        /** A step the traveller is not on — before or after it alike. */
        stepIdle:      dark ? '#1e293b' : '#e2e8f0',
        stepLine:      dark ? '#334155' : '#cbd5e1',
    };
}

export type Palette = ReturnType<typeof checkoutPalette>;

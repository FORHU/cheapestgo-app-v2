/**
 * The original CheapestGo palette, carried over from v1
 * (`cheapest-go-app/src/app/globals.css`) so v2's screens read as the same brand.
 *
 * v1 is slate neutrals with one blue family for everything interactive: blue-600 for
 * a filled action, blue-500 / blue-400 on dark ground, a blue-to-cyan gradient for the
 * things that should glow, "obsidian" `#020617` as the dark ground and "alabaster"
 * `#f8fafc` as the light one.
 *
 * Inline-style code reads these; Tailwind code uses the same stops by name
 * (`blue-600`, `cyan-500`, `slate-900`, …) — the stock scale, which is what v1 used too.
 */
/** The brand gradient's two ends — blue-600 and cyan-500 — for the places a CSS
 *  gradient string cannot go: an SVG stroke, a Mapbox line. */
export const BRAND_STOPS = { from: '#2563eb', to: '#06b6d4' } as const;

export const BRAND = {
    /** v1 `--color-obsidian` — the darkest ground. */
    obsidian:      '#020617',
    /** v1 `--color-alabaster` — the light ground. */
    alabaster:     '#f8fafc',
    /** slate-900, v1's raised dark surface (its dropdowns, selects and cards). */
    surface:       '#0f172a',
    /** blue-500 — v1 dark `--primary`: a selected date, a switched-on toggle. */
    primary:       '#3b82f6',
    /** blue-600 — v1 light `--primary` and every filled button. */
    primaryStrong: '#2563eb',
    /** blue-700 — v1's hover and selected state for a blue fill. */
    primaryDeep:   '#1d4ed8',
    /** blue-400 — v1 dark `--accent`: marks drawn on dark ground, which need to be a
     *  step brighter than `primary` to hold against it. */
    accent:        '#60a5fa',
    /** cyan-400 — v1 `--color-obsidian-accent`, the far end of the gradient. */
    glow:          '#22d3ee',
    /** v1's TravelTypeTabs pill, blue-600 → cyan-500: the brand's one gradient. White
     *  text holds on both ends. */
    gradient:      `linear-gradient(90deg,${BRAND_STOPS.from} 0%,${BRAND_STOPS.to} 100%)`,
    /** The gradient's own shadow, for a filled control lifting off the page. */
    gradientShadow: '0 8px 20px -8px rgba(37,99,235,.6)',
    /** primary at the tint v1 uses for a range or a hover wash. */
    primaryWash:   'rgba(59,130,246,0.18)',
    /** v1 `--color-obsidian-surface` / `-border`: glass over dark imagery. */
    glass:         'rgba(255,255,255,0.05)',
    glassBorder:   'rgba(255,255,255,0.10)',
    /** v1's landing canvas — slate-900 at the top falling to obsidian: the blue dark
     *  ground, for a screen that drops the graph-paper grid. Mirrored by
     *  `body.flat-ground` in globals.css, which cannot read this file. */
    canvas:        'radial-gradient(120% 80% at 50% 0%,#0f172a 0%,#0b1222 45%,#020617 100%)',
} as const;

/**
 * v1's tokens for a themed screen, picked by theme rather than by a `dark:` variant
 * (several v2 screens hardcode the `dark` class on their root, so the variant would
 * never resolve to the light design).
 */
export function brandTheme(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    return {
        /** The page ground: obsidian / alabaster. */
        ground:   dark ? BRAND.obsidian : BRAND.alabaster,
        /** A card or panel on the ground: slate-900 / white. */
        surface:  dark ? BRAND.surface  : '#ffffff',
        /** A control on a surface: slate-800 / slate-100. */
        raised:   dark ? '#1e293b' : '#f1f5f9',
        /** Headings: white / slate-900. */
        title:    dark ? '#f8fafc' : '#0f172a',
        /** Body: slate-100 / slate-800. */
        text:     dark ? '#f1f5f9' : '#1e293b',
        /** Secondary: slate-400 / slate-500. */
        muted:    dark ? '#94a3b8' : '#64748b',
        /** Rules and outlines: white/10 / slate-200. */
        hairline: dark ? 'rgba(255,255,255,0.10)' : '#e2e8f0',
        /** The theme's interactive blue — v1's `--primary` per theme. */
        primary:  dark ? BRAND.primary : BRAND.primaryStrong,
        /** Blue text on the theme's ground — readable on both. */
        link:     dark ? BRAND.accent : BRAND.primaryStrong,
    };
}

import { BRAND } from '@/shared/lib/palette';

// The colours the checkout paints with. Lived at the top of the checkout page; moved here so
// the panels that explain a changed price or a settling booking can share them rather than
// copy them.

export const ACCENT = '#FF6B4B';
export const GREEN  = '#2FB67F';
export const DANGER = '#E4685A';

/**
 * Every colour the checkout paints with, picked by theme rather than a `dark:`
 * variant — the same shape and reasoning as `propertyPalette` on the property
 * page, so the two screens read as one product: dark is pure black, light is
 * white, and the greys are the app's cream at opacity over black / ink over
 * white.
 */
export function checkoutPalette(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    return {
        // Obsidian, as on the property page this flow comes from and in the design.
        bg:            dark ? BRAND.obsidian : '#FFFFFF',
        title:         dark ? '#FFFFFF' : '#111111',
        text:          dark ? '#F5EFE4' : '#111111',
        soft:          dark ? 'rgba(245,239,228,.7)'  : 'rgba(17,17,17,.65)',
        muted:         dark ? 'rgba(245,239,228,.5)'  : 'rgba(17,17,17,.5)',
        faint:         dark ? 'rgba(245,239,228,.4)'  : 'rgba(17,17,17,.4)',
        hairline:      dark ? 'rgba(255,255,255,.1)'  : 'rgba(0,0,0,.1)',
        // The design's input fill: a violet-leaning grey, not a neutral one.
        fieldBg:       dark ? '#2C2836' : '#EEEDF2',
        summaryBg:     dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
        summaryBorder: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)',
        menuBg:        dark ? '#141018' : '#FFFFFF',
        /** The one raised plate the design uses — the summary card, the payment
         *  panel and the toolbar circles all sit on it. */
        surface:       dark ? '#1E1E1E' : '#F4F4F5',
        /** Rules inside the summary card, a step louder than `hairline` so they
         *  still read against `surface` rather than against the page. */
        cardLine:      dark ? 'rgba(255,255,255,.2)'  : 'rgba(0,0,0,.12)',
        /** A step the traveller is not on — before or after it alike. */
        stepIdle:      dark ? '#383A3E' : '#E4E4E7',
        stepLine:      dark ? '#808080' : 'rgba(0,0,0,.25)',
    };
}

export type Palette = ReturnType<typeof checkoutPalette>;

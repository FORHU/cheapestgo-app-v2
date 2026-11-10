import type { Appearance } from '@stripe/stripe-js';
import { BRAND } from '@/shared/lib/palette';
import { DANGER, type Palette } from './palette';

/** How round a field's corners are: softer than the pill the main action keeps, so a field
 *  does not read as a button. */
export const FIELD_RADIUS = 14;

/**
 * When the checkout's own fields take their touch sizes: the media query in globals.css that
 * sets `--cg-field-*` to 48px fields and 16px text. Stripe's iframe cannot read those
 * variables, so the card form is told separately, by `stripeAppearance`'s `touch`.
 */
export const TOUCH_SIZING_QUERY = '(max-width: 639px), (pointer: coarse)';

/**
 * The Payment Element dressed as the rest of the form: pill inputs on the
 * field fill, labels in body colour, the accordion flattened onto the panel.
 * Stripe draws it in its own iframe, so its text and placeholders are Stripe's
 * and can only be restyled, not reworded.
 *
 * `touch` gives it the sizes the details step's fields have on a phone or a touch screen:
 * 16px text (below that, iOS zooms the page in when a field is tapped) in fields about 48px
 * tall, and 14px labels. Without it the card form sat a size smaller than the form before it.
 */
export function stripeAppearance(palette: Palette, theme: 'light' | 'dark', touch = false): Appearance {
    return {
        theme: theme === 'dark' ? 'night' : 'stripe',
        variables: {
            // Neutral, so the "Card" heading and its icon read as the panel's title, as in
            // the design; the accent stays on the focus ring, set on `.Input:focus` below.
            colorPrimary:         palette.text,
            colorBackground:      palette.fieldBg,
            colorText:            palette.text,
            colorTextSecondary:   palette.muted,
            colorTextPlaceholder: palette.faint,
            colorDanger:          DANGER,
            // Stripe's own containers (Link's save-info block, menus) take this; only the
            // inputs are pills, below. At 999px here the save-info block became an oval.
            borderRadius:         '12px',
            fontSizeBase:         touch ? '16px' : '14px',
            spacingUnit:          '4px',
            accordionItemLabelFontSize:           '16px',
            accordionItemLabelFontWeight:         '400',
            accordionItemLabelSelectedFontWeight: '400',
        },
        rules: {
            // As the fields on the details step: a hairline at rest and the same corners. Stripe's
            // rules take no gradient, so the focused edge is the gradient's blue, the nearest the
            // iframe can come to it.
            '.Input':         { border: `1px solid ${palette.fieldLine}`, boxShadow: 'none', padding: touch ? '14px 16px' : '12px 16px', borderRadius: `${FIELD_RADIUS}px` },
            '.Input:hover':   { borderColor: palette.fieldLineHover },
            '.Input:focus':   { borderColor: BRAND.primary, boxShadow: `0 0 0 4px ${BRAND.primaryWash}` },
            '.Label':         { color: palette.text, fontSize: touch ? '14px' : '13px', fontWeight: '500', marginBottom: '8px' },
            '.AccordionItem': { backgroundColor: 'transparent', border: 'none', boxShadow: 'none', paddingTop: '0', paddingLeft: '0', paddingRight: '0' },
            '.Tab':           { border: 'none', boxShadow: 'none' },
            // The optional save-info fields sit straight on the panel, as in the design.
            '.Block':         { backgroundColor: 'transparent', border: 'none', boxShadow: 'none', padding: '0' },
        },
    };
}

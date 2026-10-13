import { BRAND_STOPS } from '@/shared/lib/palette';

/**
 * The brand gradient as an SVG stroke, for icons and spinners — CSS gradients
 * cannot paint a stroke, so the gradient has to be an SVG `<linearGradient>`.
 *
 * Usage, with any 24-unit icon (every lucide icon is one):
 *
 *     <CalendarClock color={BRAND_STROKE}><BrandStrokeDefs /></CalendarClock>
 *
 * The defs ride inside the icon itself, so the icon never depends on a gradient
 * defined somewhere else on the page. Repeating the id across icons is harmless:
 * every copy defines the same gradient.
 *
 * `userSpaceOnUse`, spanning the 24-unit box, rather than the default bounding-box
 * units: a perfectly straight stroke (a calendar's tick, a clock hand) has a box
 * of zero width or height, and a bounding-box gradient leaves it unpainted.
 */
export const BRAND_STROKE_ID = 'cg-brand-stroke';
export const BRAND_STROKE = `url(#${BRAND_STROKE_ID})`;

export function BrandStrokeDefs() {
    return (
        <defs>
            <linearGradient id={BRAND_STROKE_ID} gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="24" y2="12">
                <stop offset="0" stopColor={BRAND_STOPS.from} />
                <stop offset="1" stopColor={BRAND_STOPS.to} />
            </linearGradient>
        </defs>
    );
}

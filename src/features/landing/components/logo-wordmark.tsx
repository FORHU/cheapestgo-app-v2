import { brandWordmark } from '@/shared/lib/brand';

const { head, tail } = brandWordmark(process.env.NEXT_PUBLIC_BRAND_NAME);
// The viewBox was cut for "cheapestGo" — 131 units for 10 glyphs at this size. A
// shorter brand keeps the same per-glyph width rather than leaving dead space to
// the right of the name, which is inside the header's link target.
const VIEW_WIDTH = Math.round((head.length + tail.length) * 13.1);

/**
 * The wordmark, drawn as live text rather than a static asset.
 *
 * Inline SVG (not `<img src>`) on purpose: the glyphs are `<text>`, so they only
 * resolve against Open Sans while they live in the document's font scope. An
 * external SVG renders in an isolated context and would fall back to the
 * system sans.
 */
export function LogoWordmark({ height = 24, className }: { height?: number; className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${VIEW_WIDTH} 44`}
            width={(height * VIEW_WIDTH) / 44}
            height={height}
            fill="none"
            role="img"
            aria-label={head + tail}
            className={className}
        >
            <text x="0" y="30" fontFamily="var(--font-open-sans), 'Open Sans', sans-serif" fontSize="22">
                <tspan fontWeight="400" fill="#f1f5f9" letterSpacing="-0.3">{head.toLowerCase()}</tspan>
                <tspan fontWeight="700" fill="#ffffff" letterSpacing="-0.5">{tail}</tspan>
            </text>
        </svg>
    );
}

'use client';

import { useBrandWordmark } from '@/shared/components/BrandProvider';
import { BRAND } from '@/shared/lib/palette';

// The viewBox was cut for "cheapestGo" — 131 units for 10 glyphs at this size. A
// shorter brand keeps the same per-glyph width rather than leaving dead space to
// the right of the name, which is inside the header's link target.
const GLYPH_WIDTH = 13.1;

/**
 * The wordmark, drawn as live text rather than a static asset.
 *
 * Inline SVG (not `<img src>`) on purpose: the glyphs are `<text>`, so they only
 * resolve against Open Sans while they live in the document's font scope. An
 * external SVG renders in an isolated context and would fall back to the
 * system sans.
 *
 * `tone` is the landing header's: `onDark` draws the head near-white for the landing
 * page, which is dark whatever the theme; `default` follows the theme, for a page
 * that is light in light mode. The head's fill is then a class rather than the
 * attribute, so a `dark:` variant can reach it.
 */
export function LogoWordmark({ height = 24, className, tone = 'onDark' }: {
    height?: number;
    className?: string;
    tone?: 'default' | 'onDark';
}) {
    // The brand being shown, not the one the build was made for — the two differ on a
    // deployment with the brand preview on, and the width has to follow the name drawn.
    const { head, tail } = useBrandWordmark();
    const VIEW_WIDTH = Math.round((head.length + tail.length) * GLYPH_WIDTH);
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
                {tone === 'onDark' ? (
                    <>
                        <tspan fontWeight="400" fill="#f1f5f9" letterSpacing="-0.3">{head.toLowerCase()}</tspan>
                        {/* The tail in v1's blue, as on v1's dark logo (`public/logo-dark.svg`). */}
                        <tspan fontWeight="700" fill={BRAND.accent} letterSpacing="-0.5">{tail}</tspan>
                    </>
                ) : (
                    <>
                        <tspan fontWeight="400" className="fill-slate-900 dark:fill-[#f1f5f9]" letterSpacing="-0.3">{head.toLowerCase()}</tspan>
                        {/* On a light ground, the light theme's accent — blue-400 is drawn for a dark one. */}
                        <tspan fontWeight="700" className="fill-alabaster-accent dark:fill-[#60a5fa]" letterSpacing="-0.5">{tail}</tspan>
                    </>
                )}
            </text>
        </svg>
    );
}

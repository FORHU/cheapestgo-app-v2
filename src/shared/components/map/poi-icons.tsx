import React from 'react';

/**
 * Filled glyphs for the map's place-of-interest pins.
 *
 * Filled, not stroked: the design's marks are solid shapes, and lucide's
 * outline set reads as a different weight entirely at pin size. Knocked-out
 * details — a shop doorway, a bus window, the medical cross — are subpaths
 * resolved with `evenodd`, so the disc behind shows through instead of being
 * painted over.
 *
 * All are drawn on a 24×24 box and inherit `currentColor`.
 */

export type PoiGlyph = React.FC<{ size?: number; className?: string }>;

function glyph(paths: React.ReactNode, fillRule: 'evenodd' | 'nonzero' = 'nonzero'): PoiGlyph {
    return function Glyph({ size = 24, className }) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="currentColor"
                fillRule={fillRule}
                clipRule={fillRule}
                className={className}
                aria-hidden="true"
            >
                {paths}
            </svg>
        );
    };
}

/** Fork and knife. */
export const FoodGlyph = glyph(
    <>
        {/* fork: three tines into a shoulder, then the stem */}
        <path d="M3.2 2h1.5v7.2H3.2zM5.9 2h1.5v7.2H5.9zM8.6 2h1.5v7.2H8.6z" />
        <path d="M3.2 8.6h6.9v2.2a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6z" />
        <rect x="5.9" y="11.6" width="1.5" height="10.4" rx="0.75" />
        {/* knife: wedge blade over a straight handle */}
        <path d="M17.2 2c1.3 0 2.3 2.3 2.3 5.4v5.2h-4.6V7.4C14.9 4.3 15.9 2 17.2 2z" />
        <rect x="16.4" y="12" width="1.6" height="10" rx="0.8" />
    </>
);

/** Two conifers. */
export const ParkGlyph = glyph(
    <>
        {/* back tree, smaller */}
        <path d="M16.8 5.4 19.9 10h-1.5l2.6 4.1h-8.4l2.6-4.1h-1.5z" />
        <rect x="16.05" y="13.6" width="1.5" height="3.6" rx="0.4" />
        {/* front tree */}
        <path d="M8 2.6 11.3 7.6H9.6l3.2 4.8H10.9l3.4 5.1H1.7l3.4-5.1H3.2l3.2-4.8H4.7z" />
        <rect x="7.15" y="17" width="1.7" height="4.4" rx="0.5" />
    </>
);

/** Shop front: awning over a body with a doorway knocked out. */
export const StoreGlyph = glyph(
    <>
        <path d="M4.6 2.6h14.8L22 8.2H2z" />
        <path d="M3.6 9.4h16.8V21a.9.9 0 0 1-.9.9H4.5a.9.9 0 0 1-.9-.9zM9.8 21.9v-6.6h4.4v6.6z" />
    </>,
    'evenodd'
);

/** Cup with a handle, on a base line. */
export const CafeGlyph = glyph(
    <>
        <path d="M2.6 4.4h13.1v7.9a5.2 5.2 0 0 1-5.2 5.2H7.8a5.2 5.2 0 0 1-5.2-5.2z" />
        <path d="M16.7 6.3h1.5a3.6 3.6 0 0 1 0 7.2h-1.5v-2.1h1.5a1.5 1.5 0 0 0 0-3h-1.5z" />
        <rect x="1.6" y="19.2" width="16.6" height="2.2" rx="1.1" />
    </>
);

/** House with a cross knocked out. */
export const MedicalGlyph = glyph(
    <>
        <path d="M12 2.2 21.4 9.6V21.8H2.6V9.6zM11 11.6v2.8H8.2v2.4H11v2.8h2v-2.8h2.8v-2.4H13v-2.8z" />
    </>,
    'evenodd'
);

/** Bus: body with a window band knocked out, and two wheels. */
export const TransitGlyph = glyph(
    <>
        <path d="M5.4 2.2h13.2a2.4 2.4 0 0 1 2.4 2.4v11.9a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 16.5V4.6a2.4 2.4 0 0 1 2.4-2.4zM5.9 5.9v5.2h5.2V5.9zM12.9 5.9v5.2h5.2V5.9z" />
        <rect x="4.4" y="19.2" width="4" height="2.6" rx="1.1" />
        <rect x="15.6" y="19.2" width="4" height="2.6" rx="1.1" />
    </>,
    'evenodd'
);

/** Fallback for anything outside the six designed categories. */
export const PlaceGlyph = glyph(
    <>
        <path d="M12 2.2c-4 0-7.2 3.2-7.2 7.2 0 5.3 7.2 12.4 7.2 12.4s7.2-7.1 7.2-12.4c0-4-3.2-7.2-7.2-7.2zm0 9.9a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4z" />
    </>,
    'evenodd'
);

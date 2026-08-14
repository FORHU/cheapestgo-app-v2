'use client';

import React from 'react';

interface HotelPinProps {
    image?: string;
    /** Empty while the price is still streaming in — renders as bouncing dots. */
    priceLabel: string;
    /** Hovered: a momentary 2× lift under the cursor. */
    active?: boolean;
    /**
     * Selected: a standing state, so it gets a modest lift rather than the
     * hover size. At 2× a selected pin stayed enormous while the map zoomed
     * out, swallowing the view it was meant to point into.
     */
    selected?: boolean;
}

const THUMB = 28;

/**
 * A hotel's map pin: a pill carrying a round thumbnail and the nightly price,
 * on a pointer that aims at the coordinate.
 *
 * Colours come from CSS custom properties (`--pin-bg` and friends, defined in
 * globals.css) rather than a theme prop. These pins render into detached roots
 * — one `createRoot` per marker element — which sit outside the app's provider
 * tree, and re-rendering every one of them on a theme switch was slow enough to
 * see. Variables inherit through the DOM, so a theme change is a repaint.
 *
 * Pill and pointer are one solid shape in one colour — no outline, nothing for
 * a seam to show through.
 */
export function HotelPin({ image, priceLabel, active = false, selected = false }: HotelPinProps) {
    const lifted = active || selected;
    const scale = active ? 2 : selected ? 1.2 : 1;
    const shadow = lifted ? '0 6px 18px rgba(0,0,0,0.34)' : '0 2px 9px rgba(0,0,0,0.22)';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                // Anchored at the tip so the pin grows away from the coordinate
                // rather than off it.
                transform: `scale(${scale})`,
                transformOrigin: 'center bottom',
                transition: 'transform 220ms cubic-bezier(0.34, 1.3, 0.64, 1)',
            }}
        >
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--pin-bg)',
                    borderRadius: 100,
                    padding: '4px 14px 4px 4px',
                    boxShadow: shadow,
                    whiteSpace: 'nowrap',
                }}
            >
                <span
                    style={{
                        display: 'block',
                        width: THUMB,
                        height: THUMB,
                        flexShrink: 0,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg,#667eea,#764ba2)',
                        boxShadow: 'inset 0 0 0 1px var(--pin-line)',
                    }}
                >
                    {image && (
                        <img
                            src={image}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    )}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--pin-fg)', lineHeight: 1.4 }}>
                    {priceLabel || (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 2px' }}>
                            {[0, 1, 2].map((i) => (
                                <span
                                    key={i}
                                    style={{
                                        width: 4,
                                        height: 4,
                                        borderRadius: '50%',
                                        background: 'var(--pin-fg)',
                                        animation: 'pin-dot 1.1s ease-in-out infinite',
                                        animationDelay: `${i * 0.15}s`,
                                    }}
                                />
                            ))}
                        </span>
                    )}
                </span>
            </div>

            {/* Pointer — the pill's own colour, tucked 1px under its flat bottom
                edge so the two are one shape with no seam. Drawn as SVG rather
                than a CSS border triangle because the round linejoin blunts the
                tip; a border triangle can only ever come to a hard point.

                Sits above the pill in stacking order: same colour, so the
                overlap is invisible, and the pill's drop shadow can't smudge
                across the pointer's face. */}
            <svg
                width="22"
                height="11"
                viewBox="0 0 22 11"
                style={{ position: 'relative', display: 'block', marginTop: -1, zIndex: 2 }}
                aria-hidden="true"
            >
                <polygon
                    points="2,0 20,0 11,7.5"
                    style={{ fill: 'var(--pin-bg)', stroke: 'var(--pin-bg)' }}
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
}

export default HotelPin;

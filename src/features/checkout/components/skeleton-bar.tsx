import React from 'react';
import type { Palette } from '@/features/checkout/lib/palette';

/**
 * A placeholder for a line of text that is still on its way — the offer's itinerary, or a quote
 * being made again after the currency changed. Drawn in the pill fill (`stepIdle`), the one grey
 * every theme already has on its raised surface, and pulsed by `.cg-skeleton` in globals.css.
 *
 * Hidden from assistive tech: the container that holds a run of these carries `aria-busy` and a
 * visually hidden sentence saying what is loading, which reads better than a row of silent boxes.
 */
export function SkeletonBar({ palette, width = '100%', height = 12 }: { palette: Palette; width?: number | string; height?: number }) {
    return (
        <span
            aria-hidden
            className="cg-skeleton"
            style={{ display: 'block', width, height, borderRadius: 6, background: palette.stepIdle }}
        />
    );
}

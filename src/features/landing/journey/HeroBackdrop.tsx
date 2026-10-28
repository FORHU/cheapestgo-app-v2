'use client';

import { useEffect, useRef } from 'react';

/** How far the wing layer may shift toward the pointer, in either axis. Small on purpose —
 *  this is meant to be noticed on the second look, not the first. */
const PARALLAX_MAX_PX = 10;

/**
 * The hero's backdrop: a wing crossing frozen tundra, the view the Journey's "descent"
 * copy is actually describing. Two layers over the same photo —
 *
 * 1. A static background, full-bleed and dim. The LCP candidate: eager, high priority,
 *    `srcset` sized for the viewport rather than always shipping the largest copy.
 * 2. The same photo again, masked to roughly the wing's own region (`.hero-wing-mask` in
 *    globals.css — soft-edged, not a cut-out; see that rule's own comment for why), with a
 *    slow CSS-keyframe drift, an occasional glint, and — pointer devices only — a light
 *    parallax that leans the layer toward wherever the visitor is looking.
 *
 * The parallax is applied by writing two CSS custom properties directly onto the layer's
 * own element from a `pointermove` listener, rather than through React state: the whole
 * point of driving it off a ref is that moving the mouse never triggers a re-render.
 */
export function HeroBackdrop() {
    const parallaxRef = useRef<HTMLDivElement>(null);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        // Pointer-only and motion-on: a touch visitor has no hover position for this to
        // track, and reduced motion means no drift, no glint, and no parallax either.
        const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!fine || reducedMotion) return;

        const onMove = (e: PointerEvent) => {
            if (frame.current !== null) return;
            frame.current = requestAnimationFrame(() => {
                frame.current = null;
                const el = parallaxRef.current;
                if (!el) return;
                // -1 .. 1 from the viewport's centre, inverted: the layer leans slightly
                // *toward* the pointer, the way a parallax foreground naturally would.
                const nx = (e.clientX / window.innerWidth) * 2 - 1;
                const ny = (e.clientY / window.innerHeight) * 2 - 1;
                el.style.setProperty('--hero-parallax-x', `${(-nx * PARALLAX_MAX_PX).toFixed(1)}px`);
                el.style.setProperty('--hero-parallax-y', `${(-ny * PARALLAX_MAX_PX).toFixed(1)}px`);
            });
        };

        window.addEventListener('pointermove', onMove, { passive: true });
        return () => {
            window.removeEventListener('pointermove', onMove);
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, []);

    return (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
            <img
                src="/images/hero/wing-bg-1920.webp"
                srcSet="/images/hero/wing-bg-960.webp 960w, /images/hero/wing-bg-1920.webp 1920w"
                sizes="100vw"
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-35"
                width={1920}
                height={1280}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                draggable={false}
            />

            {/* Hidden below the breakpoint where the parallax is tuned for a landscape
                viewport anyway — a phone gets the plain dimmed photo above, same as before. */}
            <div
                ref={parallaxRef}
                className="absolute inset-0 hidden h-full w-full md:block"
                style={{
                    transform: 'translate3d(var(--hero-parallax-x, 0px), var(--hero-parallax-y, 0px), 0)',
                }}
            >
                <div className="hero-wing-drift h-full w-full">
                    <div className="hero-wing-mask relative h-full w-full">
                        <img
                            src="/images/hero/wing-bg-1920.webp"
                            srcSet="/images/hero/wing-bg-960.webp 960w, /images/hero/wing-bg-1920.webp 1920w"
                            sizes="100vw"
                            alt=""
                            className="h-full w-full object-cover opacity-60"
                            width={1920}
                            height={1280}
                            loading="eager"
                            decoding="async"
                            draggable={false}
                        />
                        <div className="hero-wing-glint absolute inset-0" />
                    </div>
                </div>
            </div>
        </div>
    );
}

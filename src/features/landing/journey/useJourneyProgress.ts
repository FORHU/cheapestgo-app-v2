'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { JOURNEY_SCREENS } from './stages';

/**
 * How far the visitor has scrolled through the Journey, as 0 → 1.
 *
 * One value, computed once and passed down. Every layer — plate, label, card, the closing
 * panel — reads this same number, because two components each deriving it from
 * `window.scrollY` drift apart by a frame and the layers visibly disagree mid-scroll.
 *
 * Updates are coalesced into one `requestAnimationFrame` per frame. The original design
 * called `setState` straight from the scroll handler, which on a trackpad fires several
 * times per frame and re-renders the whole tree for each; the final value is identical,
 * so the extra renders buy nothing.
 */
export function useJourneyProgress(trackRef: RefObject<HTMLElement | null>): {
    /** 0 → 1 across the scroll track. */
    journey: number;
    /** Height the spacer must reserve, in CSS pixels. 0 until measured. */
    trackPx: number;
    /**
     * How far past the end of the track the visitor has scrolled, 0 → 1 over the next
     * half viewport.
     *
     * Journey Progress clamps at 1, so without this every fixed layer stayed pinned
     * forever: scrolling on brought the real search section up *underneath* a stage panel
     * that would not leave, and the two rendered on top of each other. The reference does
     * the same thing — it fades its canvas out once the ordinary sections arrive.
     */
    exit: number;
    /** True when the visitor asked for less motion: the Journey renders as stills. */
    reducedMotion: boolean;
} {
    const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    const [journey, setJourney] = useState(0);
    const [exit, setExit] = useState(0);
    const [trackPx, setTrackPx] = useState(0);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        // Stills get no scroll listener at all — there is nothing for it to drive.
        if (reducedMotion) {
            setJourney(0);
            setExit(0);
            setTrackPx(0);
            return;
        }

        let height = window.innerHeight * JOURNEY_SCREENS;
        setTrackPx(height);

        // Where the track actually begins in the document. The header sits above it, so
        // `scrollY / height` treats the journey as starting a header's height early —
        // small, but it puts every snap target out by that much, and a snap point that
        // lands slightly off its frame is worse than no snap at all.
        let top = 0;
        const measureTop = () => {
            const el = trackRef.current;
            top = el ? el.getBoundingClientRect().top + window.scrollY : 0;
        };
        measureTop();

        const read = () => {
            frame.current = null;
            // `height` can only be 0 if innerHeight is, which happens in some headless
            // and background-tab cases; dividing by it would make Journey Progress NaN and
            // blank every layer at once.
            // Measured from the track's own top, not the document's.
            const into = window.scrollY - top;
            setJourney(height > 0 ? Math.max(0, Math.min(into / height, 1)) : 0);
            // Begins exactly when the section below the track first enters the viewport —
            // one viewport before the track ends — and completes as the track does. Any
            // later and the two are on screen together: that is what put a stage panel on
            // top of the search form. The last stage therefore ends before this begins,
            // leaving the final viewport of the track as room to leave in.
            const run = window.innerHeight;
            setExit(run > 0 ? Math.max(0, Math.min((into - (height - run)) / run, 1)) : 0);
        };

        const onScroll = () => {
            if (frame.current === null) frame.current = requestAnimationFrame(read);
        };

        const onResize = () => {
            // Recomputed because the track is expressed in viewport heights: rotating a
            // phone changes how much scrolling a given moment of the journey takes, and
            // without this the acts would land at the wrong scroll positions afterwards.
            height = window.innerHeight * JOURNEY_SCREENS;
            setTrackPx(height);
            // The track's own height just changed, so where it starts may have too.
            measureTop();
            onScroll();
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        // Measured again after layout settles: on the first paint the header's fonts and
        // the search bar have not sized yet, so the track's top moves under us.
        const settle = requestAnimationFrame(() => { measureTop(); read(); });
        read();

        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(settle);
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, [reducedMotion, trackRef]);

    return { journey, exit, trackPx, reducedMotion };
}

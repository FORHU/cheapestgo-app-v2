'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { JOURNEY_SCREENS } from './stages';

/**
 * A screen too short for the docked stage. The stage is a fixed layer that cannot scroll, so all of
 * it — the header's 80px, the heading, the search, and below `lg` the 152px band kept under it for
 * the bottom nav and the floating buttons — has to fit the window, or controls go under the header
 * and the bottom nav, out of reach. Such a screen gets the stills. Measured, tallest step first:
 *
 *   - a phone (≤640px wide, the search's compact sizes): Stays' first step needs a window of 882px,
 *     and a home indicator adds up to 34px. Nearly every phone's portrait window, toolbars and all,
 *     is shorter, and a phone on its side always is;
 *   - 641–1023px (a tablet upright, a phone on its side), at the search's full sizes: the dates step
 *     needs 1013px;
 *   - from `lg` (no bottom nav, no band) the dates step needs 865px. Only for touch screens, which
 *     is a tablet on its side: a short laptop window is the desktop layout's own matter.
 *
 * Mirrored in globals.css (`.journey-pending-*`), which picks the layout before this can.
 */
export const SHORT_SCREEN_QUERY =
    '(max-width: 640px) and (max-height: 919.98px), ' +
    '(min-width: 641px) and (max-width: 1023.98px) and (max-height: 1039.98px), ' +
    '(min-width: 1024px) and (max-height: 879.98px) and (pointer: coarse)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** A field being typed in: some browsers shrink the window for the keyboard while one has the focus. */
function typing(): boolean {
    const el = document.activeElement;
    return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * Whether the Journey renders as stills: when the visitor asked for less motion, or the screen is
 * too short for the docked stage (`SHORT_SCREEN_QUERY`). `null` until known — on the server and the
 * first render in the browser, which is when globals.css decides what shows.
 *
 * Not re-decided while a field has the focus: a browser that resizes the window for its keyboard
 * would otherwise swap the page out from under the search being typed into. A change held back
 * that way is applied once the field is left.
 */
function useStills(): boolean | null {
    const [stills, setStills] = useState<boolean | null>(null);
    useEffect(() => {
        // A test's simulated DOM (jsdom) has no matchMedia: the docked Journey, as it always had.
        if (typeof window.matchMedia !== 'function') { setStills(false); return; }
        const reduce = window.matchMedia(REDUCED_MOTION_QUERY);
        const short = window.matchMedia(SHORT_SCREEN_QUERY);
        const decide = () => { if (!typing()) setStills(reduce.matches || short.matches); };
        // After the focus has moved on, so `typing()` sees where it went.
        let later = 0;
        const onFocusOut = () => { window.clearTimeout(later); later = window.setTimeout(decide, 0); };
        decide();
        reduce.addEventListener('change', decide);
        short.addEventListener('change', decide);
        document.addEventListener('focusout', onFocusOut);
        return () => {
            window.clearTimeout(later);
            reduce.removeEventListener('change', decide);
            short.removeEventListener('change', decide);
            document.removeEventListener('focusout', onFocusOut);
        };
    }, []);
    return stills;
}

/**
 * How far the visitor has scrolled through the Journey, as 0 → 1.
 *
 * One value, computed once and passed down. Every layer — plate, label, the docked search —
 * reads this same number, because two components each deriving it from
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
     * True when the Journey renders as stills — less motion asked for, or a screen too short for
     * the docked stage; false for the docked Journey; null until known (see `useStills`).
     */
    stills: boolean | null;
} {
    const stills = useStills();
    const [journey, setJourney] = useState(0);
    const [trackPx, setTrackPx] = useState(0);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        // Stills get no scroll listener at all — there is nothing for it to drive. Nor does a
        // Journey not yet known to be docked.
        if (stills !== false) {
            setJourney(0);
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
    }, [stills, trackRef]);

    return { journey, trackPx, stills };
}

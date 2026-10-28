'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

/** A jump takes `STEP_BASE_MS` plus `STEP_PER_PX` for every pixel it covers, held between the
 *  two limits. A fixed time made short hops crawl and long ones lurch — the same duration
 *  over 880px and over 1950px is two different speeds — so the pace stays even instead. */
const STEP_BASE_MS = 550;
const STEP_PER_PX = 0.32;
const STEP_MIN_MS = 800;
const STEP_MAX_MS = 1200;

/** A wheel event arriving this soon after the previous one is the same gesture, not a new one.
 *
 *  A trackpad flick keeps emitting events as "momentum" after the finger lifts, a few
 *  milliseconds apart until it dies away, so as long as the stream is unbroken it is one
 *  gesture and resolves to one jump. A mouse wheel notch is a single event, so the next
 *  notch is always further apart than this and counts as a fresh gesture — even one made
 *  while the previous glide is still running, which redirects it rather than being dropped.
 *  A fixed cooldown cannot tell the two apart. */
const SAME_GESTURE_MS = 180;

/**
 * Each stop as a scroll position, from the top of the track — and never past the bottom of the
 * page. The stop for the end of the track is the bottom of the page: the track's last stage
 * runs to the end and the footer rises over it, so aiming at the track's own end would ease
 * toward a place the document cannot scroll to and stop dead where it runs out.
 */
export function snapTargets(stops: number[], top: number, trackPx: number, maxScroll: number): number[] {
    return stops.map(s => Math.min(top + s * trackPx, maxScroll));
}

/** Slow start, slow finish: a glide that begins at full speed reads as a jolt, so the page
 *  eases into motion as well as out of it. */
function easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Fast start, gentle settle. For a glide that redirects one already under way, which is
 *  moving — easing in from rest there would stall the page mid-flight. */
function easeOutCubic(x: number): number {
    return 1 - Math.pow(1 - x, 3);
}

/** The nearest ancestor (inclusive) that can actually scroll its own content — a dropdown,
 *  a results list — so the hijack below can step aside and let it handle its own wheel
 *  input instead of dragging the visitor on to the next section mid-interaction. */
function scrollableAncestor(el: EventTarget | null): Element | null {
    let node = el instanceof Element ? el : null;
    while (node && node !== document.body) {
        const style = getComputedStyle(node);
        const scrollsY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight;
        if (scrollsY) return node;
        node = node.parentElement;
    }
    return null;
}

/**
 * Turns the Journey's scroll track into one gesture per section instead of free scrolling
 * through it by hand: a single wheel notch animates straight to the next stop (or the
 * previous one, scrolling back), landing exactly where a stage docks rather than wherever
 * the gesture happened to run out.
 *
 * Only engages while the track itself is under the visitor — above it the header scrolls
 * normally, and once the last stop is reached a further downward notch is let through
 * untouched, so it hands off to the ordinary page scrolling up underneath. Because the jump
 * is driven by real `scrollTo` calls rather than a CSS snap, `useJourneyProgress`'s own
 * scroll listener sees every intermediate frame of it — which is what makes the altitude
 * readout, the backdrop and the docked panel all animate along with the jump instead of
 * cutting straight to the destination.
 *
 * Reduced motion gets none of this: `Journey` already renders a motion-free stacked page in
 * that case, with no track to snap across.
 *
 * Returns `goToStop(index)`, which glides to `stops[index]` exactly as a wheel notch would —
 * for controls inside a stage (the Stays / Flights pills) that should move the visitor to a
 * sibling stage rather than swap content in place. A no-op until the track is measured.
 */
export function useSectionSnap(
    trackRef: RefObject<HTMLElement | null>,
    stops: number[],
    trackPx: number,
    reducedMotion: boolean,
): (index: number) => void {
    const animating = useRef(false);
    const goTo = useRef<((index: number) => void) | null>(null);
    const frame = useRef<number | null>(null);
    const lastWheelAt = useRef(0);
    // The stop the running glide is heading for, so a notch made mid-glide goes on from
    // there rather than from wherever the page happens to be that frame.
    const destination = useRef(0);

    useEffect(() => {
        if (reducedMotion || trackPx <= 0) return;

        let top = 0;
        const measure = () => {
            const el = trackRef.current;
            top = el ? el.getBoundingClientRect().top + window.scrollY : 0;
        };
        measure();
        // Worked out when used, not when mounted: how far the page can scroll is not known
        // until its content has laid out, and the last stop is that bottom.
        const targetsNow = () => snapTargets(stops, top, trackPx, document.documentElement.scrollHeight - window.innerHeight);

        const animateTo = (target: number, ease: (x: number) => number) => {
            if (frame.current !== null) cancelAnimationFrame(frame.current);
            animating.current = true;
            destination.current = target;
            const start = window.scrollY;
            const distance = target - start;
            const duration = Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, STEP_BASE_MS + Math.abs(distance) * STEP_PER_PX));
            const startTime = performance.now();
            const tick = (now: number) => {
                const p = Math.min(1, (now - startTime) / duration);
                // Instant, not smooth: the page's own smooth-scroll behaviour would stack
                // on top of this easing rather than replace it.
                window.scrollTo({ top: start + distance * ease(p), behavior: 'instant' });
                if (p < 1) {
                    frame.current = requestAnimationFrame(tick);
                } else {
                    animating.current = false;
                    frame.current = null;
                }
            };
            frame.current = requestAnimationFrame(tick);
        };

        goTo.current = index => {
            const target = targetsNow()[index];
            if (target === undefined) return;
            animateTo(target, animating.current ? easeOutCubic : easeInOutCubic);
        };

        const onWheel = (e: WheelEvent) => {
            const y = window.scrollY;
            // Above the track, or past its end: native scroll, untouched.
            if (y < top - 1 || y > top + trackPx + 1) return;
            if (scrollableAncestor(e.target)) return;

            const now = performance.now();
            const sameGesture = now - lastWheelAt.current < SAME_GESTURE_MS;
            lastWheelAt.current = now;

            // Measured from where the running glide is going, not from where it is now.
            const from = animating.current ? destination.current : y;
            const direction = e.deltaY > 0 ? 1 : -1;
            const EPS = 2;
            const targets = targetsNow();
            const next = direction > 0
                ? targets.find(t => t > from + EPS)
                : [...targets].reverse().find(t => t < from - EPS);

            if (next === undefined) {
                // Nothing further this way. At rest, let the notch through so the page above
                // the header, or the ordinary page below, keeps scrolling; mid-glide toward
                // the last stop, hold it so the page's own scroll does not fight the glide.
                if (animating.current) e.preventDefault();
                return;
            }

            e.preventDefault();
            // The unbroken tail of a gesture that already moved us: swallowed, so a long
            // trackpad swipe advances one section, not two or three.
            if (sameGesture) return;

            animateTo(next, animating.current ? easeOutCubic : easeInOutCubic);
        };

        const onResize = () => measure();

        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('resize', onResize);
        return () => {
            goTo.current = null;
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('resize', onResize);
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, [trackRef, stops, trackPx, reducedMotion]);

    return useCallback((index: number) => goTo.current?.(index), []);
}

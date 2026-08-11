'use client';

import { useEffect, useState } from 'react';

/**
 * Aerial night footage, encoded for the web from `Video Project 1.mp4`:
 * a 20s 1080p30 loop, no audio, crossfaded end-to-start so `loop` has no
 * visible cut. See the encode recipe in docs/landing-video.md.
 */
export const LANDING_VIDEO = '/videos/landing-hero.mp4';
export const LANDING_POSTER = '/videos/landing-hero-poster.jpg';

/**
 * The scrim is deliberately light. The footage is near-black with small point
 * lights, so anything heavier crushes it to a flat black rectangle — it only
 * needs to lift the footer links off the brighter city detail at the bottom.
 */
const SCRIM =
    'bg-[linear-gradient(180deg,rgba(18,18,18,0.45)_0%,rgba(14,14,14,0.35)_45%,rgba(10,10,10,0.72)_100%)]';

/**
 * Full-bleed muted video behind the landing page.
 *
 * Client-side only. Under `prefers-reduced-motion` it falls back to the poster
 * frame rather than disappearing — the imagery stays, the motion doesn't. If
 * the media fails to load the layer unmounts entirely, leaving the canvas
 * gradient rather than a black hole.
 */
export function LandingVideoBackdrop() {
    const [motionOk, setMotionOk] = useState(false);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setMotionOk(!query.matches);
        sync();
        setReady(true);
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    if (!ready || failed) return null;

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            {motionOk ? (
                <video
                    src={LANDING_VIDEO}
                    poster={LANDING_POSTER}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                />
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={LANDING_POSTER}
                    alt=""
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                />
            )}
            <div className={`absolute inset-0 ${SCRIM}`} />
        </div>
    );
}

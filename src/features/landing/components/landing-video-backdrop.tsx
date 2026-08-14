'use client';

import { useEffect, useState } from 'react';

/**
 * Daylight coastline shot from a plane window, encoded for the web from
 * `Ocean Background.mp4`: a 10s 1080p24 loop, no audio, crossfaded end-to-start
 * so `loop` has no visible cut. See the encode recipe in docs/landing-video.md.
 */
export const LANDING_VIDEO = '/videos/landing-ocean.mp4';
export const LANDING_POSTER = '/videos/landing-ocean-poster.jpg';

/**
 * The scrim is heavy, and has to be. This is a midday shot whose wing, sand and
 * sunlit water are all close to white, while the page's chrome is thin slate
 * sitting straight on the footage — `#94a3b8` footer links, a `#64748b` legal
 * line, `bg-white/[0.06]` header controls. These stops keep that text at ≥4.5:1
 * even against the wing, which is the brightest thing in frame.
 */
const SCRIM =
    'bg-[linear-gradient(180deg,rgba(9,13,20,0.62)_0%,rgba(9,13,20,0.55)_45%,rgba(7,10,15,0.82)_100%)]';

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

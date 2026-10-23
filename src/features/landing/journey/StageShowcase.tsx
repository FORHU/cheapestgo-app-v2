'use client';

import { BRAND } from '@/shared/lib/palette';
import {
    STAGES,
    SEQUENCE_BLEND,
    currentStage,
    groundLayers,
    ramp,
    sequenceOpacity,
    stageProgress,
} from './stages';

/**
 * What sits behind each Stage.
 *
 * Fixed, never scrolled: the visitor scrolls the page, but the world stays under the
 * viewport and *changes*. That is what makes the descent read as moving through the
 * product rather than past a tall image.
 *
 * Everything here animates transform and opacity only. These run on the compositor, so
 * the showcase cannot make the scroll itself stutter — which on a page whose entire
 * premise is scrolling is the one performance rule that matters.
 */

/** How much a destination plate grows across its slot. Enough to feel alive, not to blur. */
const PUSH_IN = 0.06;

/**
 * The colour the page is currently standing on.
 *
 * Every stage's ground is mounted and cross-faded rather than swapped, so the descent
 * changes temperature continuously — dusk, open sky, deep space, daylight — instead of
 * cutting between four backdrops. One dark canvas for all four made four different
 * products look like four slides of the same one.
 */
function Ground({ journey }: { journey: number }) {
    const { base, overlay, overlayOpacity } = groundLayers(journey);
    return (
        <>
            <div className="absolute inset-0" style={{ background: base }} />
            <div className="absolute inset-0" style={{ background: overlay, opacity: overlayOpacity }} />
        </>
    );
}

/**
 * Departure to arrival: two photographs, the frame travelling across them.
 *
 * The first half of the stage pans across where you are leaving, the second across where
 * you are going, handing over as the aircraft passes the middle of the frame. A gradient
 * sky with a small plane on it read as empty beside the stays stage, because it was.
 */
function Crossing({ t, from, to }: { t: number; from: string; to: string }) {
    // Each image pans the opposite way, so the handover reads as travel rather than as a
    // dissolve between two stills.
    const pan = (i: number) => `${(i === 0 ? 38 + t * 24 : 62 - t * 24).toFixed(1)}% 50%`;
    // Narrow, for the same reason the sequence blend is narrow: a wide handover leaves
    // departure and arrival stacked on each other for most of the crossing.
    const handover = ramp(t, 0.47, 0.55);

    return (
        <>
            <img
                src={from}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: pan(0), opacity: (1 - handover) * 0.8 }}
                loading="lazy"
                decoding="async"
                draggable={false}
            />
            <img
                src={to}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: pan(1), opacity: handover * 0.8 }}
                loading="lazy"
                decoding="async"
                draggable={false}
            />
        </>
    );
}

/**
 * Many places at once, resolving one tile at a time.
 *
 * The AI stage is about asking for somewhere rather than naming it, so the showcase shows
 * everywhere — a grid that fills in as the question is being formed.
 */
function Mosaic({ t, images }: { t: number; images: string[] }) {
    return (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1">
            {images.map((src, i) => {
                // Tiles resolve in a fixed, scattered order rather than left-to-right,
                // which reads as assembling instead of as a progress bar.
                const order = [0, 4, 2, 5, 1, 3][i % 6];
                const shown = ramp(t, order / images.length - 0.08, order / images.length + 0.22);
                return (
                    <div key={src} className="relative overflow-hidden">
                        <img
                            src={src}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{
                                opacity: shown * 0.55,
                                transform: `scale(${1.08 - shown * 0.08})`,
                            }}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                        />
                    </div>
                );
            })}
        </div>
    );
}

/** One place, held. The descent has stopped moving; the choice is the only thing left. */
function Still({ t, image }: { t: number; image: string }) {
    return (
        <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            // Barely moves — just enough that the frame is not frozen while the visitor
            // reads four options.
            style={{ opacity: 0.6, transform: `scale(${1.03 + t * 0.02})` }}
            loading="lazy"
            decoding="async"
            draggable={false}
        />
    );
}

function Destinations({ t, images }: { t: number; images: string[] }) {
    // The four plates share the stage's span, with a generous overlap so one is always
    // arriving as another leaves and the backdrop never falls through to bare ground.
    const slot = 1 / images.length;

    return (
        <>
            {images.map((src, i) => {
                // Shared with the beat calculation, which has to agree with it: a snap
                // point is only worth having if this returns a clean frame there.
                const opacity = sequenceOpacity(i, images.length, t);
                const start = i * slot;
                const fade = slot * SEQUENCE_BLEND;
                if (opacity <= 0.01) return null;
                return (
                    <img
                        key={src}
                        src={src}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover will-change-transform"
                        style={{
                            // Not full strength: the photograph is the ground this stage
                            // stands on, and the stage's own colour reads through it.
                            opacity: opacity * 0.85,
                            transform: `scale(${1 + PUSH_IN * ramp(t, start - fade, start + slot + fade)})`,
                        }}
                        // The first plate is the largest element painted behind the fold and
                        // so the LCP candidate; it must not wait on the scroll handler.
                        loading={i === 0 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : 'auto'}
                        decoding="async"
                        draggable={false}
                    />
                );
            })}
        </>
    );
}

/**
 * Flights: one aircraft crossing the frame as the stage is scrolled.
 *
 * Driven entirely by scroll position rather than by a timer, so the plane is somewhere
 * the visitor put it. Scrolling back flies it back — a looped animation could not do
 * that, and the difference is what makes the page feel connected to the gesture.
 *
 * Draws no ground of its own: the stage's sky is already underneath.
 */
function Flight({ t }: { t: number }) {
    // −15% → 115% so it enters and leaves fully off-frame at both ends.
    const x = -15 + t * 130;
    // A shallow climb across the crossing reads as flight; level reads as a sticker.
    const y = 34 - t * 10;

    return (
        <>
            {/* Sun low in the sky, so the stage has a light source rather than a wash. */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(42% 32% at 78% 72%,rgba(255,214,170,0.42) 0%,rgba(255,170,120,0.12) 45%,transparent 72%)',
                }}
            />

            {/* Cloud bands, parallaxed at different rates so the sky has depth. */}
            {[0.2, 0.44, 0.68].map((top, i) => (
                <div
                    key={top}
                    className="absolute h-px w-full"
                    style={{
                        top: `${top * 100}%`,
                        transform: `translateX(${t * -40 * (i + 1)}px)`,
                        background: `linear-gradient(90deg,transparent,rgba(255,255,255,${0.24 - i * 0.06}),transparent)`,
                    }}
                />
            ))}

            <svg
                className="absolute h-8 w-8 drop-shadow-lg will-change-transform"
                style={{ left: `${x}%`, top: `${y}%`, transform: 'rotate(-8deg)', color: '#ffffff' }}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
            >
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
            </svg>

            {/* Contrail, trimmed to what has actually been flown. */}
            <div
                className="absolute h-px"
                style={{
                    left: '-15%',
                    top: `${y + 2}%`,
                    width: `${Math.max(0, x + 15)}%`,
                    background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4))',
                }}
            />
        </>
    );
}

/**
 * AI: a field of points drawing links between them as the stage advances.
 *
 * Deterministic positions, not random: a layout that reshuffles on every render makes the
 * background flicker during scroll, and the shape is decoration either way.
 */
function Constellation({ t }: { t: number }) {
    const points = Array.from({ length: 18 }, (_, i) => ({
        x: 8 + ((i * 37) % 84),
        y: 12 + ((i * 53) % 76),
    }));

    return (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {points.map((p, i) => {
                const next = points[(i + 1) % points.length];
                // Links draw in sequence as the stage is scrolled, so the network
                // assembles rather than simply appearing.
                const drawn = ramp(t, i / points.length - 0.1, i / points.length + 0.2);
                return (
                    <line
                        key={i}
                        x1={p.x} y1={p.y} x2={next.x} y2={next.y}
                        stroke={BRAND.glow}
                        strokeWidth={0.14}
                        opacity={drawn * 0.5}
                        vectorEffect="non-scaling-stroke"
                    />
                );
            })}
            {points.map((p, i) => (
                <circle
                    key={i}
                    cx={p.x} cy={p.y} r={0.55}
                    fill={BRAND.glow}
                    opacity={ramp(t, i / points.length - 0.1, i / points.length + 0.1)}
                />
            ))}
        </svg>
    );
}

/**
 * Legibility behind the docked panel — and only there.
 *
 * A global dark wash is the lazy way to make white text safe, and it costs the showcase
 * everything it was for: at 82% the destination photography may as well not be loaded.
 * This darkens the side the panel is actually on and lets the far side stay bright, so
 * the scrim follows the text instead of covering the picture.
 */
function Scrim({ side }: { side: 'left' | 'right' | 'center' }) {
    // Only as dark as white text needs, and only where the text is. Earlier values ran to
    // 80% across nearly half the frame, which on top of a dark ground meant the showcase
    // was never visible at all — the thing it exists for.
    const background =
        side === 'right'
            ? 'linear-gradient(270deg,rgba(2,6,23,.68) 0%,rgba(2,6,23,.26) 38%,transparent 72%)'
            : side === 'center'
              ? 'linear-gradient(0deg,rgba(2,6,23,.60) 0%,rgba(2,6,23,.18) 42%,transparent 78%)'
              : 'linear-gradient(90deg,rgba(2,6,23,.68) 0%,rgba(2,6,23,.26) 38%,transparent 72%)';

    // Transitioned rather than swapped: the scrim slides across as the panel changes
    // sides, which is the movement that sells the swap.
    return <div className="absolute inset-0 transition-[background] duration-700" style={{ background }} />;
}

export function StageShowcase({ journey, reducedMotion }: { journey: number; reducedMotion: boolean }) {
    // Reduced motion gets the brand canvas and nothing that moves. Not a degraded
    // Journey — a quiet ground for a page now presenting its stages at rest.
    if (reducedMotion) {
        return (
            <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: BRAND.canvas }} />
        );
    }

    const side = currentStage(journey)?.side ?? 'center';

    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <Ground journey={journey} />

            {/* Each stage's showcase is mounted only while that stage is on screen, so
                several full-bleed backdrops are never compositing at once. */}
            {STAGES.map(stage => {
                const t = stageProgress(stage, journey);
                if (t === null) return null;
                const opacity = Math.min(ramp(t, 0, 0.06), 1 - ramp(t, 0.94, 1));
                if (opacity <= 0.01) return null;

                const s = stage.showcase;
                return (
                    <div key={stage.id} className="absolute inset-0" style={{ opacity }}>
                        {s.kind === 'sequence' && <Destinations t={t} images={s.images} />}
                        {s.kind === 'crossing' && <Crossing t={t} from={s.from} to={s.to} />}
                        {s.kind === 'mosaic' && <Mosaic t={t} images={s.images} />}
                        {s.kind === 'still' && <Still t={t} image={s.image} />}

                        {/* Motion layered over the photography rather than instead of it:
                            the aircraft crosses the two places it is travelling between,
                            and the network is drawn over the places it is choosing from. */}
                        {stage.id === 'flights' && <Flight t={t} />}
                        {stage.id === 'ai' && <Constellation t={t} />}
                    </div>
                );
            })}

            <Scrim side={side} />
        </div>
    );
}

'use client';

import { BRAND } from '@/shared/lib/palette';
import {
    STAGES,
    SEQUENCE_BLEND,
    currentStage,
    faceOf,
    groundLayers,
    ramp,
    showcaseOpacity,
    sequenceOpacity,
    stageFaces,
    stageProgress,
    type SearchMode,
    type StageFace,
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
function Still({ t, image, strength = 0.6 }: { t: number; image: string; strength?: number }) {
    return (
        <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            // Barely moves — just enough that the frame is not frozen while the visitor
            // reads four options.
            style={{ opacity: strength, transform: `scale(${1.03 + t * 0.02})` }}
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
 * AI: a field of points drawing links between them as the stage advances.
 *
 * One point per mosaic tile, at its centre, so the network reads as connecting the actual
 * photographs rather than floating independently over them. Traced in the same scattered
 * order `Mosaic` resolves its tiles in, so a dot lighting up and its photo clearing happen
 * together — the two have to agree, the way a sequence's beats and blend already do.
 */
function Constellation({ t, images }: { t: number; images: string[] }) {
    const cols = 3;
    const rows = Math.ceil(images.length / cols);
    const points = images.map((_, i) => ({
        x: ((i % cols) + 0.5) * (100 / cols),
        y: (Math.floor(i / cols) + 0.5) * (100 / rows),
    }));
    // Same scatter Mosaic resolves its tiles in — reads as assembling, not a progress bar.
    const order = [0, 4, 2, 5, 1, 3].filter(i => i < points.length);

    return (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {order.map((idx, i) => {
                const p = points[idx]!;
                const next = points[order[(i + 1) % order.length]!]!;
                const drawn = ramp(t, i / order.length - 0.1, i / order.length + 0.2);
                return (
                    <line
                        key={idx}
                        x1={p.x} y1={p.y} x2={next.x} y2={next.y}
                        stroke={BRAND.glow}
                        strokeWidth={0.14}
                        opacity={drawn * 0.5}
                        vectorEffect="non-scaling-stroke"
                    />
                );
            })}
            {points.map((p, i) => {
                const at = order.indexOf(i) / order.length;
                return (
                    <circle
                        key={i}
                        cx={p.x} cy={p.y} r={0.9}
                        fill={BRAND.glow}
                        opacity={ramp(t, at - 0.1, at + 0.1)}
                    />
                );
            })}
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
/**
 * The shading for each side a panel can dock on. All three are mounted and cross-faded by
 * opacity: a gradient cannot be transitioned, so swapping one `background` for another snapped
 * the shading across while the panel was still sliding. Faded, it follows the panel instead.
 *
 * Only as dark as white text needs, and only where the text is. Earlier values ran to 80%
 * across nearly half the frame, which on top of a dark ground meant the showcase was never
 * visible at all — the thing it exists for.
 */
const SCRIMS = {
    left: 'linear-gradient(90deg,rgba(2,6,23,.68) 0%,rgba(2,6,23,.26) 38%,transparent 72%)',
    right: 'linear-gradient(270deg,rgba(2,6,23,.78) 0%,rgba(2,6,23,.5) 42%,transparent 78%)',
    center: 'linear-gradient(0deg,rgba(2,6,23,.72) 0%,rgba(2,6,23,.55) 38%,rgba(2,6,23,.40) 58%,rgba(2,6,23,.12) 80%,transparent 100%)',
} as const;

function Scrim({ side }: { side: keyof typeof SCRIMS }) {
    return (
        <>
            {(Object.keys(SCRIMS) as Array<keyof typeof SCRIMS>).map(s => (
                <div
                    key={s}
                    className="absolute inset-0 transition-opacity duration-700"
                    style={{ background: SCRIMS[s], opacity: s === side ? 1 : 0 }}
                />
            ))}
        </>
    );
}

/** One face's showcase, drawn at `t` through its stage. */
function FaceLayer({ face, t }: { face: StageFace; t: number }) {
    const s = face.showcase;
    return (
        <>
            {s.kind === 'sequence' && <Destinations t={t} images={s.images} />}
            {s.kind === 'mosaic' && <Mosaic t={t} images={s.images} />}
            {s.kind === 'still' && <Still t={t} image={s.image} strength={s.strength} />}

            {/* Motion layered over the photography rather than instead of it:
                the network is drawn over the places the AI stage is choosing from. */}
            {face.id === 'ai' && s.kind === 'mosaic' && <Constellation t={t} images={s.images} />}
        </>
    );
}

export function StageShowcase({ journey, mode, reducedMotion }: { journey: number; mode: SearchMode; reducedMotion: boolean }) {
    // Reduced motion gets the brand canvas and nothing that moves. Not a degraded
    // Journey — a quiet ground for a page now presenting its stages at rest.
    if (reducedMotion) {
        return (
            <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: BRAND.canvas }} />
        );
    }

    const current = currentStage(journey);
    const side = (current ? faceOf(current, mode).side : 'center') as keyof typeof SCRIMS;

    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <Ground journey={journey} />

            {/* Each stage's showcase is mounted only while that stage is on screen, so
                several full-bleed backdrops are never compositing at once. */}
            {STAGES.map(stage => {
                const opacity = showcaseOpacity(journey, stage.from, stage.to, stage === STAGES[STAGES.length - 1]);
                if (opacity <= 0.01) return null;
                const t = Math.min(1, Math.max(0, (journey - stage.from) / (stage.to - stage.from)));
                const shown = faceOf(stage, mode);

                return (
                    <div key={stage.id} className="absolute inset-0" style={{ opacity }}>
                        {/* A stage's faces are all mounted and cross-faded by the chosen mode —
                            on a timer, not the scroll, so changing tab changes the photograph
                            under the panel as it slides. */}
                        {stageFaces(stage).map(face => (
                            <div
                                key={face.id}
                                className="absolute inset-0 transition-opacity duration-700 ease-in-out"
                                style={{ opacity: face.id === shown.id ? 1 : 0 }}
                            >
                                <FaceLayer face={face} t={t} />
                            </div>
                        ))}
                    </div>
                );
            })}

            <Scrim side={side} />
        </div>
    );
}

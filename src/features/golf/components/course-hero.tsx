'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useTheme } from '@/shared/components/ThemeContext';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { cn } from '@/shared/lib/cn';
import { SHELL_CAP, SHELL_GUTTER } from '@/shared/lib/layout';

/**
 * The course page's column — the property page's: the shared shell with a wider gutter, so a course
 * reads with the same air down its sides as a hotel does, and its name over the photograph starts on
 * the line everything under it starts on.
 */
export function CourseColumn({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn(SHELL_GUTTER, 'sm:px-12 lg:px-20 xl:px-28', className)}>
            <div className={SHELL_CAP}>{children}</div>
        </div>
    );
}

/**
 * A section that fades and rises as it enters the viewport, and sinks back as it leaves — the
 * property page's `Reveal`. What is watched (the outer box) never moves, so a section halfway out
 * cannot carry itself back across the line and flicker. Shown at once where nothing can watch
 * (no IntersectionObserver, as in tests), so nothing stays invisible.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
        const io = new IntersectionObserver(([entry]) => setShown(entry.isIntersecting), { threshold: 0.15 });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={ref}>
            <div
                className={cn('transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none', className)}
                style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(32px)' }}
            >
                {children}
            </div>
        </div>
    );
}

/** The 44px glass circle every control over the photograph is drawn as. */
const CIRCLE = 'flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(2,6,23,.45)] text-white backdrop-blur-md transition-opacity hover:opacity-85';

/**
 * The top of a course page, in the property page's design: the course's photographs full-bleed and
 * full-height, paged with arrows and dots, its name and place large over the bottom of them, and the
 * page's controls — back, currency, theme — in glass circles in the corners.
 *
 * Copied from the property page's banner rather than shared with it: that banner is written inline in
 * `property-view.tsx`, which is changing on staging, and lifting it out would collide with that work.
 *
 * Without a course (still loading, or not found) it is the dark plate and the controls only;
 * `compact` keeps it short for a page that has only a message under it.
 */
export function CourseHero({
    course,
    compact = false,
}: {
    course?: { name: string; place: string; images: string[] };
    compact?: boolean;
}) {
    const t = useTranslations('golf');
    const tAll = useTranslations();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const images = course?.images ?? [];
    const count = images.length;

    const [index, setIndex] = useState(0);
    // Which way the visitor last paged, so the outgoing photo drifts away from where the next comes in.
    const [dir, setDir] = useState(1);
    const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
    const current = images[Math.min(index, count - 1)];
    const decoding = !!current && !loaded.has(current);

    const page = (to: number, direction: number) => {
        setDir(direction);
        setIndex(((to % count) + count) % count);
    };

    // Back where the visitor came from on this site; to the catalogue for anyone who arrived on a
    // shared link, so the button never leaves the site.
    const back = () => {
        const fromHere = document.referrer.startsWith(window.location.origin) && window.history.length > 1;
        if (fromHere) router.back();
        else router.push('/golf');
    };

    return (
        <div className={cn('relative min-h-80 overflow-hidden', compact ? 'h-[42vh]' : 'h-screen')}>
            {/* The plate every photograph sits on, shimmering while the current one decodes so a blank
                banner never reads as broken. */}
            <div className="absolute inset-0 bg-[#16302a]">
                {(decoding || !course) && <div className="absolute inset-0 animate-pulse bg-white/5" />}
            </div>

            {/* Every photograph mounted and cross-faded: the incoming one settles from a slight
                over-scale, the outgoing one drifts opposite the paging direction. Only the one shown is
                named, so a screen reader hears one photograph, not the whole set. */}
            {images.map((src, i) => {
                const shown = i === index && loaded.has(src);
                const offset = i === index ? 0 : (i < index ? -1 : 1) * dir * 18;
                return (
                    // eslint-disable-next-line @next/next/no-img-element -- admin URLs come from any host
                    <img
                        key={src}
                        src={src}
                        alt={i === index ? course!.name : ''}
                        aria-hidden={i === index ? undefined : true}
                        loading={i === index ? 'eager' : 'lazy'}
                        onLoad={() => setLoaded((s) => (s.has(src) ? s : new Set(s).add(src)))}
                        className="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none"
                        style={{
                            opacity: shown ? 1 : 0,
                            transform: shown ? 'none' : `scale(1.06) translateX(${offset}px)`,
                        }}
                    />
                );
            })}

            {/* Dark enough at the bottom for the large name over it, light at the top. */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,.18)_0%,rgba(2,6,23,.42)_35%,rgba(2,6,23,.96)_100%)]" />

            <button type="button" onClick={back} aria-label={t('back')} className={cn(CIRCLE, 'absolute top-5 left-5 z-[2] cursor-pointer sm:left-8 lg:left-12')}>
                <ArrowLeft size={20} />
            </button>

            <div className="absolute top-5 right-5 z-[3] flex items-center gap-2.5 sm:right-8 lg:right-12">
                <CurrencySelector
                    align="right"
                    iconOnly
                    triggerClassName="h-11 w-11 md:h-11 md:w-11 backdrop-blur-md"
                    chrome={{
                        surface: 'rgba(2,6,23,.45)',
                        border:  'transparent',
                        text:    '#fff',
                        menu:    'rgba(15,23,42,.96)',
                        hover:   'rgba(255,255,255,.12)',
                        shadow:  '0 24px 55px -18px rgba(0,0,0,.7)',
                    }}
                />
                <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? tAll('property.v2.switchToLight') : tAll('property.v2.switchToDark')}
                    className={cn(CIRCLE, 'cursor-pointer')}
                >
                    {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
                </button>
            </div>

            {/* Arrows only when there is somewhere to page to: a single photograph with arrows is
                chrome promising something it cannot do. */}
            {count > 1 && (
                <>
                    <button
                        type="button"
                        onClick={() => page(index - 1, -1)}
                        aria-label={tAll('property.v2.previousPhoto')}
                        className="absolute top-1/2 left-5 z-[2] flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center text-white drop-shadow-[0_1px_6px_rgba(0,0,0,.6)] sm:left-8 lg:left-12"
                    >
                        <ChevronLeft size={34} strokeWidth={2.25} />
                    </button>
                    <button
                        type="button"
                        onClick={() => page(index + 1, 1)}
                        aria-label={tAll('property.v2.nextPhoto')}
                        className="absolute top-1/2 right-5 z-[2] flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center text-white drop-shadow-[0_1px_6px_rgba(0,0,0,.6)] sm:right-8 lg:right-12"
                    >
                        <ChevronRight size={34} strokeWidth={2.25} />
                    </button>
                </>
            )}

            {course && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 pb-[clamp(28px,4.5vw,52px)]">
                    <CourseColumn>
                        <h1 className="text-[clamp(40px,5.2vw,60px)] leading-[1.05] font-medium tracking-[-0.02em] text-white [text-shadow:0_4px_20px_rgba(0,0,0,.4)]">
                            {course.name}
                        </h1>
                        <p className="mt-1 text-[clamp(18px,2.2vw,28px)] text-white/90 [text-shadow:0_2px_12px_rgba(0,0,0,.45)]">
                            {course.place}
                        </p>
                    </CourseColumn>

                    {count > 1 && (
                        <div className="z-[2] flex flex-wrap justify-center gap-2">
                            {images.map((src, i) => (
                                <button
                                    key={src}
                                    type="button"
                                    onClick={() => page(i, i >= index ? 1 : -1)}
                                    aria-label={t('photo', { n: i + 1 })}
                                    aria-current={i === index || undefined}
                                    className={cn('h-2 w-2 cursor-pointer rounded-full p-0 transition-colors', i === index ? 'bg-white' : 'bg-white/45')}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

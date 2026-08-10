'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface ScrollRowProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** Rendered between the heading and the arrows (filter chips, counts…). */
    aside?: React.ReactNode;
    id?: string;
    children: React.ReactNode;
}

/**
 * Horizontal card rail: heading + prev/next arrows that actually scroll the
 * row, disable themselves at each end, and hide entirely when everything
 * already fits. Pointer drag is handled natively (`overflow-x-auto` + snap) so
 * touch keeps its momentum.
 */
export function ScrollRow({ title, subtitle, aside, id, children }: ScrollRowProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(true);

    const sync = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        setAtStart(el.scrollLeft <= 1);
        setAtEnd(max <= 1 || el.scrollLeft >= max - 1);
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        sync();
        el.addEventListener('scroll', sync, { passive: true });

        const observer = new ResizeObserver(sync);
        observer.observe(el);
        for (const child of Array.from(el.children)) observer.observe(child);

        return () => {
            el.removeEventListener('scroll', sync);
            observer.disconnect();
        };
    }, [sync, children]);

    const scrollBy = (direction: 1 | -1) => {
        const el = ref.current;
        if (!el) return;
        // A little under a full viewport so the next card peeks in.
        const amount = Math.max(280, el.clientWidth * 0.8);
        el.scrollBy({ left: direction * amount, behavior: 'smooth' });
    };

    const hideArrows = atStart && atEnd;

    const arrowClass =
        'w-9 h-9 rounded-full border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 ' +
        'flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors ' +
        'hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white ' +
        'disabled:opacity-30 disabled:pointer-events-none';

    return (
        <section id={id} className="w-full">
            <div className="max-w-[1240px] mx-auto px-6 flex items-end justify-between gap-5 mb-5">
                <div className="min-w-0">
                    <h2 className="font-display font-semibold tracking-[-0.03em] leading-tight text-[clamp(22px,2.6vw,28px)] text-slate-900 dark:text-white">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-[13px] text-slate-600 dark:text-slate-400 mt-1">{subtitle}</p>
                    )}
                    {aside}
                </div>

                <div className={cn('hidden sm:flex gap-2 shrink-0', hideArrows && 'invisible')}>
                    <button
                        type="button"
                        onClick={() => scrollBy(-1)}
                        disabled={atStart}
                        aria-label="Scroll left"
                        className={arrowClass}
                    >
                        <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>
                    <button
                        type="button"
                        onClick={() => scrollBy(1)}
                        disabled={atEnd}
                        aria-label="Scroll right"
                        className={arrowClass}
                    >
                        <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            <div
                ref={ref}
                className="flex gap-[18px] overflow-x-auto no-scrollbar px-6 pt-1 pb-2 snap-x scroll-px-6 max-w-[1240px] mx-auto"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {children}
            </div>
        </section>
    );
}

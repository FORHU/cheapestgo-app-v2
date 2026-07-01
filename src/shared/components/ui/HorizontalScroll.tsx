"use client";

import React, { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollProps {
    children: React.ReactNode;
    showNavigation?: boolean;
    scrollAmount?: number;
    gap?: number;
    className?: string;
}

export const HorizontalScroll: React.FC<HorizontalScrollProps> = ({
    children,
    showNavigation = true,
    scrollAmount = 340,
    gap = 5,
    className = '',
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = useCallback((direction: 'left' | 'right') => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    }, [scrollAmount]);

    return (
        <div className="relative overflow-x-hidden">
            {/* Navigation Arrows — visible on all screen sizes */}
            {showNavigation && (
                <div className="flex items-center gap-1.5 sm:gap-2 absolute -top-14 right-0 z-10">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scroll('left')}
                        aria-label="Scroll left"
                        className="p-1.5 sm:p-2.5 rounded-full bg-white/50 dark:bg-obsidian-surface backdrop-blur-xl border border-alabaster-border dark:border-obsidian-border hover:bg-white dark:hover:bg-white/10 transition-colors shadow-sm"
                    >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-300" />
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scroll('right')}
                        aria-label="Scroll right"
                        className="p-1.5 sm:p-2.5 rounded-full bg-white/50 dark:bg-obsidian-surface backdrop-blur-xl border border-alabaster-border dark:border-obsidian-border hover:bg-white dark:hover:bg-white/10 transition-colors shadow-sm"
                    >
                        <ChevronRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-300" />
                    </motion.button>
                </div>
            )}

            {/* Scroll container — native scroll (wheel + touch) enabled */}
            <div
                ref={scrollRef}
                className={`flex overflow-x-scroll pt-3 pb-4 snap-x snap-mandatory ${className}`}
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    gap: `${gap * 4}px`,
                    userSelect: 'none',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {children}
            </div>
        </div>
    );
};

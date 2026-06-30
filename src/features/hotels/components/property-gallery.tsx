'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { ImageIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PropertyGalleryProps {
    images?: string[];
    name: string;
}

export function PropertyGallery({ images = [], name }: PropertyGalleryProps) {
    const display = images.filter(Boolean);
    const main = display[0] ?? '';
    const sub  = display.slice(1, 5);

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const open  = useCallback((i: number) => setLightboxIndex(i), []);
    const close = useCallback(() => setLightboxIndex(null), []);
    const prev  = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLightboxIndex((i) => (i === null ? null : i === 0 ? display.length - 1 : i - 1));
    }, [display.length]);
    const next  = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLightboxIndex((i) => (i === null ? null : i === display.length - 1 ? 0 : i + 1));
    }, [display.length]);

    const handleKey = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
    }, [close, prev, next]);

    if (display.length === 0) {
        return (
            <div className="h-[200px] md:h-[400px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400">
                <ImageIcon size={36} className="opacity-40 mb-2" />
                <p className="text-sm">No photos available</p>
            </div>
        );
    }

    return (
        <>
            {/* Mobile: horizontal swipe carousel */}
            <div className="md:hidden relative h-[230px] rounded-xl overflow-hidden">
                <div className="flex overflow-x-auto snap-x snap-mandatory h-full" style={{ scrollbarWidth: 'none' }}>
                    {display.slice(0, 8).map((img, i) => (
                        <div
                            key={i}
                            className="snap-center shrink-0 w-full h-full relative cursor-pointer"
                            onClick={() => open(i)}
                        >
                            <Image
                                src={img}
                                alt={`${name} — photo ${i + 1}`}
                                fill
                                sizes="100vw"
                                priority={i === 0}
                                className="object-cover"
                            />
                        </div>
                    ))}
                </div>
                {/* Photo count badge */}
                <button
                    onClick={() => open(0)}
                    className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium"
                >
                    <ImageIcon size={12} />
                    {display.length}
                </button>
            </div>

            {/* Desktop: main + grid */}
            <div
                className={`hidden md:grid gap-2 h-[400px] rounded-xl overflow-hidden ${
                    sub.length === 0
                        ? 'grid-cols-1'
                        : sub.length === 1
                        ? 'grid-cols-2'
                        : 'grid-cols-4 grid-rows-2'
                }`}
            >
                <div
                    className={`relative cursor-pointer overflow-hidden group ${sub.length >= 2 ? 'col-span-2 row-span-2' : ''}`}
                    onClick={() => open(0)}
                >
                    <Image
                        src={main}
                        alt={name}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                </div>

                {sub.map((img, i) => (
                    <div
                        key={i}
                        className="relative cursor-pointer overflow-hidden group"
                        onClick={() => open(i + 1)}
                    >
                        <Image
                            src={img}
                            alt={`${name} — view ${i + 2}`}
                            fill
                            sizes="25vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {i === sub.length - 1 && display.length > 5 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-sm">
                                +{display.length - 5} photos
                            </div>
                        )}
                    </div>
                ))}

                {/* Show all button */}
                <button
                    onClick={() => open(0)}
                    className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm hover:scale-105 transition-transform z-10"
                >
                    <ImageIcon size={13} />
                    Show all photos
                </button>
            </div>

            {/* Lightbox */}
            {mounted && lightboxIndex !== null && createPortal(
                <div
                    className="fixed inset-0 z-[100] bg-black/98 flex flex-col outline-none"
                    onClick={close}
                    onKeyDown={handleKey}
                    tabIndex={0}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                >
                    {/* Header */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
                        <span className="text-white/80 text-sm font-medium ml-2">
                            {lightboxIndex + 1} / {display.length}
                        </span>
                        <button onClick={close} className="text-white/80 hover:text-white transition-colors p-1">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Main image */}
                    <div className="flex-1 flex items-center justify-center relative w-full p-4">
                        <button
                            className="absolute left-3 z-20 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors backdrop-blur-sm"
                            onClick={prev}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            className="absolute right-3 z-20 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors backdrop-blur-sm"
                            onClick={next}
                        >
                            <ChevronRight size={24} />
                        </button>
                        <div className="relative w-full h-full max-h-[85vh]">
                            <Image
                                key={lightboxIndex}
                                src={display[lightboxIndex]}
                                alt={`${name} — ${lightboxIndex + 1}`}
                                fill
                                sizes="100vw"
                                unoptimized
                                className="object-contain"
                                onClick={(e) => e.stopPropagation()}
                                priority
                            />
                        </div>
                    </div>

                    {/* Thumbnail strip */}
                    <div
                        className="hidden md:flex bg-black/90 border-t border-white/10 p-4 justify-center overflow-x-auto"
                        onClick={(e) => e.stopPropagation()}
                        style={{ scrollbarWidth: 'none' }}
                    >
                        <div className="flex gap-2">
                            {display.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setLightboxIndex(idx)}
                                    className={`relative w-16 h-16 shrink-0 rounded-md overflow-hidden border-2 transition-[border-color,opacity] ${
                                        lightboxIndex === idx
                                            ? 'border-white opacity-100'
                                            : 'border-transparent opacity-50 hover:opacity-80'
                                    }`}
                                >
                                    <Image src={img} alt="" fill sizes="64px" className="object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Full-screen image viewer. Extracted verbatim from the property page so the
 * room-detail modal's photo strip can open the same viewer.
 */
export function Lightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
    const [idx, setIdx] = useState(startIndex);

    const prev = useCallback(() => setIdx(i => (i - 1 + images.length) % images.length), [images.length]);
    const next = useCallback(() => setIdx(i => (i + 1) % images.length), [images.length]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft')  prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, prev, next]);

    return (
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            {/* Close */}
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}
            >
                <X size={18} />
            </button>

            {/* Counter */}
            <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>
                {idx + 1} / {images.length}
            </div>

            {/* Prev */}
            {images.length > 1 && (
                <button
                    onClick={e => { e.stopPropagation(); prev(); }}
                    style={{ position: 'absolute', left: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <ChevronLeft size={22} />
                </button>
            )}

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={images[idx]}
                alt=""
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '88vw', maxHeight: '84vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 24px 80px rgba(0,0,0,.7)', userSelect: 'none' }}
            />

            {/* Next */}
            {images.length > 1 && (
                <button
                    onClick={e => { e.stopPropagation(); next(); }}
                    style={{ position: 'absolute', right: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <ChevronRight size={22} />
                </button>
            )}

            {/* Dot indicators */}
            {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                    {images.map((_, i) => (
                        <div
                            key={i}
                            onClick={e => { e.stopPropagation(); setIdx(i); }}
                            style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, background: i === idx ? '#fff' : 'rgba(255,255,255,.35)', cursor: 'pointer', transition: 'all .2s' }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

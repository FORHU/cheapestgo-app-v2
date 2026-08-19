'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SORT_OPTIONS, sortPalette, type SortValue } from './search-chrome';
export { sortPalette } from './search-chrome';

export function SortPill({ value, onChange, theme }: { value: SortValue; onChange: (v: SortValue) => void; theme: 'light' | 'dark' }) {
    const [open, setOpen] = useState(false);
    const p = sortPalette(theme);
    const label = SORT_OPTIONS.find(o => o.value === value)?.label ?? 'Recommended';

    return (
        <div style={{ position: 'relative' }}>
            {/* No shadow: this sits on the toolbar, not over the map. */}
            <button onClick={() => setOpen(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: p.surface, border: `1px solid ${p.border}`,
                borderRadius: 100, padding: '0 16px', height: 40,
                color: p.text, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
                {label}
                <ChevronDown size={14} style={{ opacity: 0.75, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 8,
                            zIndex: 100, minWidth: 186, borderRadius: 16, overflow: 'hidden',
                            background: p.menu, border: `1px solid ${p.border}`,
                            boxShadow: p.shadow,
                        }}>
                        {SORT_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = p.hover; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left',
                                    padding: '11px 16px', fontSize: 12.5,
                                    fontWeight: value === opt.value ? 700 : 500,
                                    color: p.text, opacity: value === opt.value ? 1 : 0.72,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    transition: 'background .12s',
                                }}>
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

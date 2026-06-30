'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useSearchStore, useTravelers, useActiveDropdown } from '@/shared/stores/search.store';

interface CounterProps {
    label: string;
    sublabel?: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
}

function Counter({ label, sublabel, value, min, max, onChange }: CounterProps) {
    return (
        <div className="flex justify-between items-center py-2">
            <div className="flex-1">
                <span className="text-[10px] font-normal text-slate-900 dark:text-white block">{label}</span>
                {sublabel && <span className="text-[8.5px] font-normal text-slate-400">{sublabel}</span>}
            </div>
            <div className="flex items-center gap-3">
                <button
                    disabled={value <= min}
                    onClick={() => onChange(value - 1)}
                    className="size-7 rounded-full border border-slate-200 dark:border-white/20 flex items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                    <Minus size={12} />
                </button>
                <span className="w-6 text-center font-normal text-[10.5px] text-slate-900 dark:text-white">{value}</span>
                <button
                    disabled={value >= max}
                    onClick={() => onChange(value + 1)}
                    className="size-7 rounded-full border border-slate-200 dark:border-white/20 flex items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                    <Plus size={12} />
                </button>
            </div>
        </div>
    );
}

interface TravelerPickerProps {
    forceOpen?: boolean;
}

export function TravelerPicker({ forceOpen }: TravelerPickerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const activeDropdown = useActiveDropdown();
    const { adults, children } = useTravelers();
    const { setTravelers, setActiveDropdown } = useSearchStore();

    const [childrenAges, setChildrenAges] = useState<number[]>(Array(children).fill(10));

    // Sync children count with ages
    useEffect(() => {
        if (children > childrenAges.length) {
            setChildrenAges((prev) => [...prev, ...Array(children - prev.length).fill(10)]);
        } else if (children < childrenAges.length) {
            setChildrenAges((prev) => prev.slice(0, children));
        }
    }, [children, childrenAges.length]);

    // Update store occupancies when ages change
    useEffect(() => {
        setTravelers({ rooms: 1, occupancies: [{ adults, childrenAges }] });
    }, [adults, childrenAges, setTravelers]);

    const isOpen = forceOpen || activeDropdown === 'travelers';
    const onClose = () => { if (!forceOpen) setActiveDropdown(null); };

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        if (isOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const summaryText = useMemo(() => {
        const parts = [`${adults} adult${adults !== 1 ? 's' : ''}`];
        if (children > 0) parts.push(`${children} child${children !== 1 ? 'ren' : ''}`);
        parts.push('1 room');
        return parts.join(', ');
    }, [adults, children]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={ref}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className={
                        forceOpen
                            ? 'w-full z-10'
                            : 'absolute top-full right-0 mt-3 w-[400px] min-w-[400px] bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-[100]'
                    }
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={forceOpen ? 'p-2' : 'p-6'}>
                        {!forceOpen && (
                            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">
                                Guests &amp; Rooms
                            </h4>
                        )}
                        <div className="space-y-1">
                            <Counter
                                label="Adults"
                                value={adults}
                                min={1}
                                max={10}
                                onChange={(v) => setTravelers({ adults: v })}
                            />
                            <Counter
                                label="Children"
                                sublabel="Ages 0 to 17"
                                value={children}
                                min={0}
                                max={6}
                                onChange={(v) => setTravelers({ children: v })}
                            />
                            {childrenAges.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {childrenAges.map((age, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300"
                                        >
                                            <select
                                                value={age}
                                                onChange={(e) => {
                                                    const newAges = [...childrenAges];
                                                    newAges[idx] = parseInt(e.target.value);
                                                    setChildrenAges(newAges);
                                                }}
                                                className="bg-transparent text-[10px] font-bold outline-none"
                                            >
                                                {Array.from({ length: 18 }, (_, i) => (
                                                    <option key={i} value={i}>{i} yrs</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2">
                                <span className="text-[10px] font-normal text-slate-900 dark:text-white">Rooms</span>
                                <span className="text-[10.5px] font-normal text-slate-500 dark:text-slate-400 pr-1">1</span>
                            </div>
                        </div>

                        <div className="mt-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">{summaryText}</p>
                        </div>
                    </div>

                    {!forceOpen && (
                        <div className="p-4 pt-0">
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

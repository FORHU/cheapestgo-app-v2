'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useSearchStore, useDates, useActiveDropdown, useFlightState } from '@/shared/stores/search.store';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type TriggerDropdown = 'dates-in' | 'dates-out' | 'flight-depart' | 'flight-return';

interface DatePickerProps {
    triggerDropdown?: TriggerDropdown;
    initialCheckOutMode?: boolean;
    forceOpen?: boolean;
    onDone?: () => void;
    mode?: 'single' | 'range';
    label?: string;
    segmentIndex?: number;
}

export function DatePicker({ triggerDropdown, initialCheckOutMode, forceOpen, onDone, mode, segmentIndex }: DatePickerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const activeDropdown = useActiveDropdown();
    const { checkIn: rawCheckIn, checkOut: rawCheckOut } = useDates();
    const { setDates, setActiveDropdown, setFlightSegment } = useSearchStore();
    const flightState = useFlightState();

    const isFlightMode = mode === 'single' && segmentIndex !== undefined;
    const rawFlightDate = isFlightMode ? flightState.flights[segmentIndex]?.date ?? null : null;

    const checkIn  = isFlightMode
        ? (rawFlightDate ? new Date(rawFlightDate) : null)
        : (rawCheckIn ? new Date(rawCheckIn) : null);
    const checkOut = isFlightMode ? null : (rawCheckOut ? new Date(rawCheckOut) : null);

    const [view, setView] = useState<'calendar' | 'month' | 'year'>('calendar');
    const [tab, setTab] = useState<'calendar' | 'flexible'>('calendar');
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (checkIn && !isNaN(checkIn.getTime()))
            return new Date(checkIn.getFullYear(), checkIn.getMonth(), 1);
        return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    });
    const [yearInput, setYearInput] = useState(currentMonth.getFullYear().toString());
    const [selectingCheckOut, setSelectingCheckOut] = useState(false);

    const isOpen = forceOpen || (
        triggerDropdown
            ? activeDropdown === triggerDropdown
            : (activeDropdown === 'dates-in' || activeDropdown === 'dates-out' || activeDropdown === 'flight-depart' || activeDropdown === 'flight-return')
    );

    useEffect(() => {
        if (isOpen) {
            if (initialCheckOutMode) setSelectingCheckOut(true);
            else if (!checkIn) setSelectingCheckOut(false);
            else if (checkIn && !checkOut) setSelectingCheckOut(true);
            else setSelectingCheckOut(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialCheckOutMode]);

    useEffect(() => { setYearInput(currentMonth.getFullYear().toString()); }, [currentMonth]);
    useEffect(() => { if (!isOpen) setView('calendar'); }, [isOpen]);

    useEffect(() => {
        const handler = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node;
            const trigger = ref.current?.parentElement?.querySelector('[data-datepicker-trigger]');
            const isInsideTrigger = trigger?.contains(target);
            if (ref.current && !ref.current.contains(target) && !isInsideTrigger && document.contains(target)) {
                if (onDone) onDone();
                else if (!forceOpen) setActiveDropdown(null);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handler);
            document.addEventListener('touchstart', handler);
        }
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [isOpen, forceOpen, onDone, setActiveDropdown]);

    const years = useMemo(() => {
        const y = new Date().getFullYear();
        return Array.from({ length: 21 }, (_, i) => y + i);
    }, []);

    const handleDateClick = (date: Date) => {
        if (isFlightMode) {
            setFlightSegment(segmentIndex!, { date });
            handleClose();
            return;
        }
        if (!selectingCheckOut || !checkIn || date < checkIn) {
            setDates({ checkIn: date, checkOut: null });
            setSelectingCheckOut(true);
        } else {
            setDates({ checkOut: date });
            setSelectingCheckOut(false);
        }
    };

    const handleClose = () => {
        if (onDone) onDone();
        else if (!forceOpen) setActiveDropdown(null);
    };

    const renderCalendarDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(<div key={`pad-${i}`} className="size-9 sm:size-10 mx-auto" />);

        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const isPast = d <= today;
            const isCI = checkIn && d.toDateString() === checkIn.toDateString();
            const isCO = checkOut && d.toDateString() === checkOut.toDateString();
            const inRange = checkIn && checkOut && d > checkIn && d < checkOut;

            cells.push(
                <button
                    key={day}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleDateClick(d)}
                    className={cn(
                        'size-9 sm:size-10 mx-auto my-0.5 flex items-center justify-center text-[11px] sm:text-sm font-normal rounded-xl transition-all relative',
                        isPast
                            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-20'
                            : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5',
                        (isCI || isCO)
                            ? 'bg-blue-600 text-white z-10 shadow-lg shadow-blue-600/30'
                            : inRange
                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'text-slate-700 dark:text-slate-300'
                    )}
                >
                    {day}
                </button>
            );
        }
        return cells;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={ref}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative sm:absolute top-0 sm:top-full left-0 sm:left-1/2 sm:-translate-x-1/2 sm:mt-3 w-full sm:w-[420px] bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-white/10 z-[100] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 dark:border-white/5">
                        {(['calendar', 'flexible'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={cn(
                                    'flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-all',
                                    tab === t
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-slate-400 hover:text-slate-600'
                                )}
                            >
                                {t === 'calendar' ? 'Calendar' : 'Flexible dates'}
                            </button>
                        ))}
                    </div>

                    <div className="p-4 flex flex-col relative">
                        {tab === 'calendar' ? (
                            <>
                                {/* Month / Year header */}
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setView(view === 'month' ? 'calendar' : 'month')}
                                            className="flex items-center gap-1 group"
                                        >
                                            <span className="text-[11px] font-normal text-blue-600 dark:text-blue-400 uppercase tracking-widest group-hover:opacity-70 transition-opacity">
                                                {MONTHS[currentMonth.getMonth()]}
                                            </span>
                                            <ChevronDown size={14} className={cn('text-blue-600 dark:text-blue-400 transition-transform duration-200', view === 'month' && 'rotate-180')} />
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={yearInput}
                                                onChange={(e) => {
                                                    setYearInput(e.target.value);
                                                    const y = parseInt(e.target.value);
                                                    if (!isNaN(y) && y > 1900 && y < 2100)
                                                        setCurrentMonth(new Date(y, currentMonth.getMonth(), 1));
                                                }}
                                                onBlur={() => setYearInput(currentMonth.getFullYear().toString())}
                                                className="w-12 bg-transparent text-[11px] font-normal text-slate-600 dark:text-slate-400 uppercase tracking-widest outline-none focus:text-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <button type="button" onClick={() => setView(view === 'year' ? 'calendar' : 'year')}>
                                                <ChevronDown size={14} className={cn('text-slate-400 transition-transform duration-200', view === 'year' && 'rotate-180')} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); }}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
                                        >
                                            <ChevronLeft size={16} className="text-slate-400" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); }}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
                                        >
                                            <ChevronRight size={16} className="text-slate-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Calendar grid */}
                                <div className="relative min-h-[220px]">
                                    {view === 'month' && (
                                        <div className="absolute inset-0 bg-white dark:bg-slate-900 z-20 overflow-y-auto pr-1">
                                            <div className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-3 sticky top-0 bg-white dark:bg-slate-900 py-1">Month</div>
                                            <div className="grid grid-cols-1 gap-1">
                                                {MONTHS.map((m, i) => (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => { setCurrentMonth(new Date(currentMonth.getFullYear(), i, 1)); setView('calendar'); }}
                                                        className={cn(
                                                            'w-full text-left px-3 py-2 rounded-md text-[12px] font-normal transition-all',
                                                            currentMonth.getMonth() === i
                                                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                                                        )}
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {view === 'year' && (
                                        <div className="absolute inset-0 bg-white dark:bg-slate-900 z-20 overflow-y-auto pr-1">
                                            <div className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-3 sticky top-0 bg-white dark:bg-slate-900 py-1">Year</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {years.map((y) => (
                                                    <button
                                                        key={y}
                                                        type="button"
                                                        onClick={() => { setCurrentMonth(new Date(y, currentMonth.getMonth(), 1)); setView('calendar'); }}
                                                        className={cn(
                                                            'px-2 py-3 rounded-md text-[12px] font-normal text-center transition-all',
                                                            currentMonth.getFullYear() === y
                                                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                                                        )}
                                                    >
                                                        {y}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                            {DAYS.map((d, i) => (
                                                <span key={i} className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">{d}</span>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">{renderCalendarDays()}</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="py-4 space-y-6">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white text-center">When do you want to travel?</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {MONTHS.slice(0, 6).map((m) => (
                                        <div
                                            key={m}
                                            className="p-3 rounded-xl border border-slate-200 dark:border-white/10 flex flex-col items-center gap-1 hover:border-blue-500 cursor-pointer group transition-all"
                                        >
                                            <div className="text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">{m}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
                            <button
                                onClick={handleClose}
                                className="px-6 py-1.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

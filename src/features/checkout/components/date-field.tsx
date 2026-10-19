'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { ACCENT_FILL, type Palette } from '../lib/palette';

/**
 * A date field for the dates a booking form asks for that are nowhere near today — a date of
 * birth, a passport's expiry — in the look of the search bar's calendar.
 *
 * The browser's own picker opens on this month and steps a month at a time, which is thirty
 * years of clicking to a birthday, and draws itself in the operating system's colours. This one
 * opens where the answer probably is (`anchor`, on the `openTo` view), lets the heading climb
 * from days to months to years and back down, and will not offer a date outside `min`–`max`.
 *
 * Dates in and out are local `YYYY-MM-DD` strings; `''` is "not chosen".
 */

type View = 'day' | 'month' | 'year';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => {
    const date = new Date(y, m, d);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const parts = (s: string) => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; };
const asDate = (s: string) => { const { y, m, d } = parts(s); return new Date(y, m, d); };
const clamp = (s: string, min: string, max: string) => (s < min ? min : s > max ? max : s);
const monthEnd = (y: number, m: number) => iso(y, m + 1, 0);
const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
const YEARS_PER_PAGE = 12;

export function DateField({
    id, value, onChange, min, max, anchor, openTo = 'day', palette, style, className,
}: {
    /** For the `<label htmlFor>` that names it. */
    id:        string;
    value:     string;
    onChange:  (value: string) => void;
    min:       string;
    max:       string;
    /** Where to open when nothing is chosen. */
    anchor:    string;
    /** The view to open on when nothing is chosen: `year` for a birthday, `day` for a near date. */
    openTo?:   View;
    palette:   Palette;
    /** The field's own look — the page's, so the trigger matches the inputs beside it. */
    style?:    React.CSSProperties;
    className?: string;
}) {
    const t = useTranslations('checkout.datePicker');
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<View>(openTo);
    /** The date the calendar is on, and the one the keyboard moves. */
    const [cursor, setCursor] = useState(() => clamp(value || anchor, min, max));
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const focusCursor = useRef(false);

    const fmt = useMemo(() => ({
        // Day first, as a passport prints it, wherever the language allows.
        shown:  new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { day: 'numeric', month: 'short', year: 'numeric' }),
        full:   new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
        title:  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
        short:  new Intl.DateTimeFormat(locale, { month: 'short' }),
        narrow: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }),
    }), [locale]);

    const show = () => {
        setCursor(clamp(value || anchor, min, max));
        setView(value ? 'day' : openTo);
        focusCursor.current = true;
        setOpen(true);
    };
    const close = () => { setOpen(false); triggerRef.current?.focus(); };
    const pick = (day: string) => { onChange(day); close(); };

    // Keep keyboard focus on the cursor as it moves, and put it there on opening.
    useEffect(() => {
        if (!open || !focusCursor.current) return;
        focusCursor.current = false;
        const target = panelRef.current?.querySelector<HTMLElement>('[data-cursor="true"]');
        target?.focus();
    });

    const { y, m } = parts(cursor);
    const { y: minY } = parts(min);
    const { y: maxY } = parts(max);
    const today = todayIso();

    const move = (next: string) => { setCursor(clamp(next, min, max)); focusCursor.current = true; };
    const onGridKey = (e: React.KeyboardEvent) => {
        const { y: cy, m: cm, d: cd } = parts(cursor);
        const days: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (e.key in days) { e.preventDefault(); move(iso(cy, cm, cd + days[e.key])); return; }
        if (e.key === 'PageUp' || e.key === 'PageDown') {
            e.preventDefault();
            const nm = cm + (e.key === 'PageDown' ? 1 : -1);
            move(iso(cy, nm, Math.min(cd, new Date(cy, nm + 1, 0).getDate())));
        }
    };

    // ── Pieces ───────────────────────────────────────────────────────────────

    const navBtn = (label: string, disabled: boolean, onClick: () => void, Icon: typeof ChevronLeft) => (
        <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="cg-date-nav"
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: palette.surface, color: palette.text, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1 }}>
            <Icon size={15} />
        </button>
    );

    const header = (label: string, text: string, onClick: (() => void) | null, prev: React.ReactNode, next: React.ReactNode) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            {prev}
            {onClick ? (
                <button type="button" aria-label={label} onClick={onClick} className="cg-date-title"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: palette.title,
                        fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '6px 10px', borderRadius: 999, fontFamily: 'inherit' }}>
                    {text}<ChevronDown size={14} style={{ opacity: 0.6 }} />
                </button>
            ) : (
                <span style={{ fontSize: 14, fontWeight: 700, color: palette.title }}>{text}</span>
            )}
            {next}
        </div>
    );

    const cell = (selected: boolean, disabled: boolean, ring: boolean): React.CSSProperties => ({
        border: 'none', borderRadius: 999, fontFamily: 'inherit', fontSize: 13,
        fontWeight: selected ? 700 : 500,
        color: selected ? '#fff' : palette.text,
        background: selected ? ACCENT_FILL : 'transparent',
        boxShadow: ring && !selected ? `inset 0 0 0 1px ${palette.icon}` : 'none',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'default' : 'pointer',
    });

    const chosen = value ? parts(value) : null;

    const dayView = () => {
        const first = new Date(y, m, 1);
        const lead = first.getDay();
        const count = new Date(y, m + 1, 0).getDate();
        const weekdays = Array.from({ length: 7 }, (_, i) => fmt.narrow.format(new Date(2026, 1, i + 1)));   // 1 Feb 2026 is a Sunday
        return (
            <>
                {header(t('chooseMonth'), fmt.title.format(first), () => setView('month'),
                    navBtn(t('previousMonth'), iso(y, m, 0) < min, () => move(iso(y, m - 1, 1)), ChevronLeft),
                    navBtn(t('nextMonth'), iso(y, m + 1, 1) > max, () => move(iso(y, m + 1, 1)), ChevronRight))}
                {/* grid › row › gridcell › button, as ARIA wants a grid. The rows are
                    `display: contents`, so the seven columns are laid out by the grid itself. */}
                <div role="grid" aria-label={fmt.title.format(first)} onKeyDown={onGridKey}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2, textAlign: 'center' }}>
                    <div role="row" style={{ display: 'contents' }}>
                        {weekdays.map((w, i) => (
                            <span key={`w${i}`} role="columnheader" aria-hidden style={{ fontSize: 11, color: palette.muted, padding: '4px 0' }}>{w}</span>
                        ))}
                    </div>
                    {Array.from({ length: Math.ceil((lead + count) / 7) }, (_, week) => (
                        <div key={`r${week}`} role="row" style={{ display: 'contents' }}>
                            {Array.from({ length: 7 }, (_, col) => {
                                const date = week * 7 + col - lead + 1;
                                if (date < 1 || date > count) return <span key={`e${col}`} role="gridcell" />;
                                const day = iso(y, m, date);
                                const disabled = day < min || day > max;
                                const selected = day === value;
                                const isCursor = day === cursor;
                                return (
                                    <span key={day} role="gridcell">
                                        <button type="button" data-cursor={isCursor}
                                            aria-label={fmt.full.format(asDate(day))} aria-pressed={selected}
                                            aria-current={day === today ? 'date' : undefined}
                                            tabIndex={isCursor ? 0 : -1} disabled={disabled}
                                            onClick={() => pick(day)} className="cg-date-cell"
                                            style={{ ...cell(selected, disabled, day === today), width: 36, height: 36, margin: '0 auto', display: 'block' }}>
                                            {date}
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </>
        );
    };

    const monthView = () => {
        return (
            <>
                {header(t('chooseYear'), String(y), () => setView('year'),
                    navBtn(t('previousYear'), y <= minY, () => move(iso(y - 1, m, 1)), ChevronLeft),
                    navBtn(t('nextYear'), y >= maxY, () => move(iso(y + 1, m, 1)), ChevronRight))}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {Array.from({ length: 12 }, (_, i) => {
                        const disabled = monthEnd(y, i) < min || iso(y, i, 1) > max;
                        const selected = !!chosen && chosen.y === y && chosen.m === i;
                        return (
                            <button key={i} type="button" disabled={disabled} data-cursor={i === m}
                                aria-label={fmt.title.format(new Date(y, i, 1))} aria-pressed={selected}
                                onClick={() => { move(iso(y, i, 1)); setView('day'); }} className="cg-date-cell"
                                style={{ ...cell(selected, disabled, false), height: 40 }}>
                                {fmt.short.format(new Date(y, i, 1))}
                            </button>
                        );
                    })}
                </div>
            </>
        );
    };

    const yearView = () => {
        // Centred on the year the calendar is on, so the likely year has neighbours both ways.
        const start = y - YEARS_PER_PAGE / 2;
        return (
            <>
                {header('', `${start} – ${start + YEARS_PER_PAGE - 1}`, null,
                    navBtn(t('previousYears'), start <= minY, () => move(iso(y - YEARS_PER_PAGE, m, 1)), ChevronLeft),
                    navBtn(t('nextYears'), start + YEARS_PER_PAGE > maxY, () => move(iso(y + YEARS_PER_PAGE, m, 1)), ChevronRight))}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {Array.from({ length: YEARS_PER_PAGE }, (_, i) => {
                        const year = start + i;
                        const disabled = year < minY || year > maxY;
                        return (
                            <button key={year} type="button" disabled={disabled} data-cursor={year === y}
                                aria-pressed={!!chosen && chosen.y === year}
                                onClick={() => { move(iso(year, m, 1)); setView('month'); }} className="cg-date-cell"
                                style={{ ...cell(!!chosen && chosen.y === year, disabled, false), height: 40 }}>
                                {year}
                            </button>
                        );
                    })}
                </div>
            </>
        );
    };

    return (
        <div style={{ position: 'relative' }}>
            <style>{`
                .cg-date-cell:not(:disabled):not([aria-pressed="true"]):hover,
                .cg-date-title:hover, .cg-date-nav:not(:disabled):hover { background: ${palette.stepIdle} !important; }
                .cg-date-cell:focus-visible, .cg-date-title:focus-visible, .cg-date-nav:focus-visible { outline: 2px solid ${palette.icon}; outline-offset: 2px; }
            `}</style>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => (open ? close() : show())}
                className={className}
                style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer' }}
            >
                <span style={{ color: value ? palette.text : palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value ? fmt.shown.format(asDate(value)) : t('placeholder')}
                </span>
                <CalendarDays size={16} color={palette.icon} style={{ flexShrink: 0 }} />
            </button>

            {open && (
                <>
                    <div data-testid="date-field-backdrop" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div
                        ref={panelRef}
                        role="dialog"
                        aria-labelledby={id}
                        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
                        style={{
                            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 41,
                            width: 'min(304px, calc(100vw - 32px))', padding: 14, borderRadius: 18,
                            background: palette.menuBg, border: `1px solid ${palette.summaryBorder}`,
                            boxShadow: '0 18px 44px rgba(2,6,23,.45)', color: palette.text,
                        }}
                    >
                        {view === 'day' ? dayView() : view === 'month' ? monthView() : yearView()}
                    </div>
                </>
            )}
        </div>
    );
}

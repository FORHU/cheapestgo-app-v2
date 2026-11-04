'use client';

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { BRAND } from '@/shared/lib/palette';
import { formatCurrency } from '@/shared/lib/format';
import {
    CalendarGrid, FILL, GRADIENT_TEXT, GoPill, NotePanel, PROSE, SearchMiniIcon, Token, fmtDate, startOfDay, useProseWidth,
} from '@/features/search/components/prose-parts';
import { GOLF_FACE, rememberGolfSearch } from '@/features/golf/lib/last-search';
import { useGolfCourses } from '@/features/golf/lib/use-golf-courses';
import type { GolfCourse } from '@/features/golf/types';

type Panel = 'course' | 'date' | 'players' | null;

/** The tee-time picker's party sizes, so the sentence never asks for a party the course page cannot price. */
const MIN_PLAYERS = 1;
const MAX_PLAYERS = 4;
/** How many matching courses the panel lists at once. */
const LISTED = 8;

const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar's own day, as the course page's address names one. Never through UTC, which moves
 *  a midnight east of Greenwich back a day. */
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The last day a course lists tee times on: today and the `bookingWindowDays - 1` after it, as api-v2
 *  generates them (api-v2 `lib/golf/rules.ts`, `listingRange`). */
export function lastBookableDay(course: GolfCourse, today = new Date()): Date {
    const d = startOfDay(today);
    d.setDate(d.getDate() + course.bookingWindowDays - 1);
    return d;
}

const SECTION_LABEL: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
    color: 'rgba(241,245,249,0.42)', marginBottom: '10px',
};

/**
 * Golf's search sentence, in the landing page's search bar: "Tee off at [course], on [date], for
 * [players]." GO opens the course page with its tee-time picker on that day for that party; with
 * no date the course page answers its first day with a tee time.
 *
 * The bar draws the tabs above it and declares the keyframes its tokens use; everything else golf
 * asks is here. `courses` comes from whoever mounts the bar (the landing page's Golf face, which
 * shares it with its course pills); left out, the sentence asks for the catalogue itself.
 */
export function GolfSentence({
    courses: given,
    coursePick,
    onCourseChange,
}: {
    courses?: GolfCourse[] | null;
    coursePick?: { slug: string } | null;
    onCourseChange?: (slug: string | null) => void;
}) {
    const tAll = useTranslations();
    const router = useRouter();
    const fetched = useGolfCourses(given === undefined);
    const courses = given === undefined ? fetched : given;

    const [slug, setSlug] = useState<string | null>(null);
    const [date, setDate] = useState<Date | null>(null);
    const [players, setPlayers] = useState(2);
    const [panel, setPanel] = useState<Panel>(null);
    const [query, setQuery] = useState('');
    const [searching, startSearch] = useTransition();
    const [shake, setShake] = useState(false);
    const [hint, setHint] = useState(true);

    const proseRef = useRef<HTMLDivElement>(null);
    const shakeT = useRef<ReturnType<typeof setTimeout>>();
    const advanceT = useRef<ReturnType<typeof setTimeout>>();

    const course = courses?.find((c) => c.slug === slug) ?? null;
    const lastDay = course ? lastBookableDay(course) : null;

    // A press anywhere outside the sentence closes its panel; the hint stops nagging after a while.
    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (proseRef.current && !proseRef.current.contains(e.target as Node)) setPanel(null);
        };
        document.addEventListener('mousedown', close);
        const hintT = setTimeout(() => setHint(false), 6000);
        return () => {
            document.removeEventListener('mousedown', close);
            [shakeT, advanceT].forEach((r) => clearTimeout(r.current));
            clearTimeout(hintT);
        };
    }, []);

    // A pick from outside fills the token without opening the next panel: the pills sit under GO,
    // and a calendar opening over them would hide the button the visitor reaches for.
    useEffect(() => {
        if (!coursePick) return;
        clearTimeout(advanceT.current);
        setSlug(coursePick.slug);
        setQuery('');
        setPanel(null);
    }, [coursePick]);

    useEffect(() => {
        onCourseChange?.(course?.slug ?? null);
    }, [course?.slug, onCourseChange]);

    // A day the newly chosen course does not reach yet is let go rather than sent to be clamped.
    useEffect(() => {
        if (!lastDay) return;
        setDate((d) => (d && d > lastDay ? null : d));
    }, [lastDay?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

    const open = useCallback((name: Exclude<Panel, null>) => (e: React.MouseEvent) => {
        e.stopPropagation();
        setPanel((p) => (p === name ? null : name));
        setHint(false);
    }, []);

    const pickCourse = (c: GolfCourse) => {
        clearTimeout(advanceT.current);
        setSlug(c.slug);
        setQuery('');
        setPanel('date');
    };

    const pickDay = (d: Date) => {
        setDate(d);
        clearTimeout(advanceT.current);
        advanceT.current = setTimeout(() => setPanel('players'), 450);
    };

    const go = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!course) {
            setShake(true);
            setPanel('course');
            clearTimeout(shakeT.current);
            shakeT.current = setTimeout(() => setShake(false), 500);
            return;
        }
        if (searching) return;
        setPanel(null);
        const qs = new URLSearchParams();
        if (date) qs.set('date', isoDay(date));
        qs.set('players', String(players));
        rememberGolfSearch(GOLF_FACE);
        startSearch(() => router.push(`/golf/${course.slug}?${qs.toString()}`));
    };

    const courseValue = course ? course.name : tAll('search.prose.theCourse');
    const dateValue = date ? fmtDate(date) : tAll('search.prose.firstOpenDay');
    const playersValue = tAll('search.prose.players', { count: players });
    const width = useProseWidth(proseRef, [courseValue, dateValue, playersValue]);

    return (
        <>
            <div ref={proseRef} style={PROSE}>
                {tAll('search.prose.teeOffAt')}
                {' '}

                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                    <Token filled={!!course} hint={hint} order={0} onClick={open('course')}>{courseValue}</Token>
                    {panel === 'course' && (
                        <NotePanel>
                            <CoursePanel courses={courses} query={query} onQueryChange={setQuery} onPick={pickCourse} />
                        </NotePanel>
                    )}
                </span>

                {tAll('search.prose.onDay')}

                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                    <Token filled={!!date} hint={hint} order={1} onClick={open('date')}>{dateValue}</Token>
                    {panel === 'date' && (
                        <NotePanel width="min(400px,92vw)" extra={{ textAlign: 'left', maxHeight: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
                                <div style={{ fontWeight: 700, fontSize: '16px', fontFamily: 'var(--font-sans)' }}>{tAll('search.golf.whenPlay')}</div>
                                {date && (
                                    <button
                                        style={{ border: 'none', ...GRADIENT_TEXT, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                                        onClick={(e) => { e.stopPropagation(); setDate(null); }}
                                    >{tAll('search.clear')}</button>
                                )}
                            </div>
                            <CalendarGrid checkIn={date} checkOut={null} onSelect={pickDay} accent={FILL} maxDate={lastDay} />
                            <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 600, color: 'rgba(241,245,249,0.6)', textAlign: 'center' }}>
                                {tAll('search.golf.anyDayNote')}
                            </div>
                        </NotePanel>
                    )}
                </span>

                {tAll('search.prose.forPlayers')}

                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                    <Token filled hint={false} order={2} onClick={open('players')}>{playersValue}</Token>
                    {panel === 'players' && (
                        <NotePanel width="280px" extra={{ maxHeight: 'none' }}>
                            <div style={{ fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)', marginBottom: '18px' }}>
                                {tAll('search.golf.howMany')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#f1f5f9' }}>{tAll('golf.teeTimes.players')}</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(241,245,249,0.45)' }}>{MIN_PLAYERS}–{MAX_PLAYERS}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Stepper label="−" aria={tAll('search.golf.fewer')} disabled={players <= MIN_PLAYERS} onClick={() => setPlayers((n) => Math.max(MIN_PLAYERS, n - 1))} />
                                    <div style={{ fontSize: '18px', fontWeight: 800, minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-sans)', color: '#f1f5f9' }}>{players}</div>
                                    <Stepper label="+" aria={tAll('search.golf.more')} disabled={players >= MAX_PLAYERS} onClick={() => setPlayers((n) => Math.min(MAX_PLAYERS, n + 1))} />
                                </div>
                            </div>
                        </NotePanel>
                    )}
                </span>
                {'.'}
            </div>

            <GoPill
                onClick={go}
                searching={searching}
                shake={shake}
                width={width}
                label={tAll('landing.search.go')}
                searchingLabel={tAll('landing.search.searchingGolf')}
            />
        </>
    );
}

/** The travellers panel's round − / + button. */
function Stepper({ label, aria, disabled, onClick }: { label: string; aria: string; disabled: boolean; onClick: () => void }) {
    return (
        <button
            aria-label={aria}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            disabled={disabled}
            style={{
                width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: FILL, boxShadow: BRAND.gradientShadow,
                fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
            }}
        >{label}</button>
    );
}

/**
 * The course token's panel: a filter, the matching courses with their from-fee, and the way to the
 * whole catalogue. The fee is api-v2's, already in the viewer's currency, and only a guide.
 */
function CoursePanel({
    courses, query, onQueryChange, onPick,
}: {
    courses: GolfCourse[] | null;
    query: string;
    onQueryChange: (v: string) => void;
    onPick: (c: GolfCourse) => void;
}) {
    const tAll = useTranslations();
    const q = query.trim().toLowerCase();
    const matches = (courses ?? [])
        .filter((c) => !q || `${c.name} ${c.city} ${c.country}`.toLowerCase().includes(q))
        .slice(0, LISTED);
    const muted: React.CSSProperties = { fontSize: '13px', color: 'rgba(241,245,249,0.6)', padding: '4px 10px 14px' };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1.5px solid rgba(255,255,255,0.14)', paddingBottom: '10px', marginBottom: '18px' }}>
                <span style={{ display: 'flex', color: 'rgba(241,245,249,0.42)', flexShrink: 0 }}><SearchMiniIcon /></span>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder={tAll('search.golf.findCourse')}
                    aria-label={tAll('search.golf.findCourse')}
                    autoFocus
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '15px', flex: 1, color: '#f1f5f9', fontFamily: 'var(--font-sans)' }}
                />
            </div>

            {courses === null && <div style={muted}>{tAll('search.golf.loading')}</div>}
            {courses?.length === 0 && <div style={muted}>{tAll('search.golf.none')}</div>}
            {!!courses?.length && matches.length === 0 && (
                <div style={muted}>{tAll('search.golf.noMatch', { query: query.trim() })}</div>
            )}

            {matches.length > 0 && (
                <>
                    <div style={SECTION_LABEL}>{tAll('search.golf.courses')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
                        {matches.map((c) => (
                            <div
                                key={c.id}
                                role="button"
                                tabIndex={0}
                                className="imm-row"
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', cursor: 'pointer' }}
                                onClick={() => onPick(c)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(c); } }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                                    <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.6)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.city} · {c.country}
                                    </div>
                                </div>
                                {c.greenFeeFrom != null && (
                                    <span style={{ flexShrink: 0, fontSize: '12px', fontWeight: 600, color: 'rgba(241,245,249,0.75)' }}>
                                        {tAll('landing.journey.strip.from', { price: formatCurrency(c.greenFeeFrom, c.currency) })}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            <Link
                href="/golf"
                style={{ display: 'inline-block', padding: '4px 10px', fontSize: '13px', fontWeight: 700, ...GRADIENT_TEXT }}
            >{tAll('search.golf.allCourses')}</Link>
        </>
    );
}

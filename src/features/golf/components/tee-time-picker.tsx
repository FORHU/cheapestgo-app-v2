'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { useUserCurrency } from '@/shared/stores/search.store';
import { fetchTeeTimeQuote, fetchTeeTimes } from '@/features/golf/api/golf.api';
import { eachDay } from '@/features/golf/lib/calendar';
import { clockTime, money } from '@/features/golf/lib/format';
import type { GolfCourse, TeeTimeDay, TeeTimeOffer, TeeTimeQuote } from '@/features/golf/types';

export interface TeeTimeSelection {
    date?:    string;
    players?: number;
    /** A tee time id. */
    time?:    string;
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; day: TeeTimeDay };
type Quote = { status: 'none' | 'loading' | 'gone' } | { status: 'ready'; quote: TeeTimeQuote };

const PARTY = [1, 2, 3, 4];

/** A chosen party size, day or time: the brand's gradient, as every chosen control on v2 is. */
const CHOSEN = 'border-transparent bg-linear-to-r from-blue-600 to-cyan-500 text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,.6)]';

/** A date on the course's clock, which must not move with the visitor's zone; hence UTC. */
const utcDate = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
};

/**
 * One row that scrolls sideways, with arrows where there is room for them and a swipe everywhere.
 * `focusKey` names the child (by `data-key`) to bring into the middle of the row: scrolled by hand
 * rather than with `scrollIntoView`, which would also drag the whole page down to the row on load.
 */
function SideScroller({ children, focusKey, prevLabel, nextLabel }: {
    children: React.ReactNode;
    focusKey?: string;
    prevLabel: string;
    nextLabel: string;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const row = ref.current;
        if (!row || !focusKey) return;
        const el = row.querySelector<HTMLElement>(`[data-key="${focusKey}"]`);
        if (!el) return;
        row.scrollTo?.({ left: el.offsetLeft - row.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
    }, [focusKey]);

    const page = (direction: number) => {
        const row = ref.current;
        row?.scrollBy?.({ left: direction * row.clientWidth * 0.8, behavior: 'smooth' });
    };
    const arrow = 'hidden h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 sm:flex dark:text-slate-300 dark:hover:bg-white/10';

    return (
        <div className="flex items-center gap-1">
            <button type="button" aria-label={prevLabel} onClick={() => page(-1)} className={arrow}><ChevronLeft size={18} /></button>
            <div ref={ref} className="relative flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {children}
            </div>
            <button type="button" aria-label={nextLabel} onClick={() => page(1)} className={arrow}><ChevronRight size={18} /></button>
        </div>
    );
}

/**
 * The course page's "Book a tee time" band (spec 2026-11-04-golf-tee-times §6, booked per api-v2
 * CONTEXT.md "Golf Booking"): a row of days, a party size, the open times in one sideways row priced
 * all-in per player in the visitor's currency, and the way to book the one picked.
 *
 * Prices come from api-v2 already converted, and are asked for again whenever the header currency
 * changes; the browser never converts. The total comes from the same quote the checkout charges, not
 * from multiplying the per-player figure, which rounding would put a unit out. The picked day, party
 * and time live in the address, so a link can be shared and a visitor sent to sign in comes back to
 * the same choice.
 */
export function TeeTimePicker({ course, initial = {} }: { course: GolfCourse; initial?: TeeTimeSelection }) {
    const t = useTranslations('golf');
    const locale = useLocale();
    const router = useRouter();
    const currency = useUserCurrency();

    const [players, setPlayers] = useState(initial.players ?? 2);
    // Undefined until the visitor picks one: api-v2 then answers its first day with a tee time.
    const [date, setDate] = useState<string | undefined>(initial.date);
    const [picked, setPicked] = useState<string | undefined>(initial.time);
    const [state, setState] = useState<State>({ status: 'loading' });
    const [quote, setQuote] = useState<Quote>({ status: 'none' });
    const [attempt, setAttempt] = useState(0);
    const loaded = useRef(false);
    // The day last answered. Once api-v2 has chosen one, a change of party or currency asks about that
    // same day again rather than letting it choose afresh.
    const answeredDate = useRef<string | undefined>(initial.date);
    // What the day strip spans. Kept across reloads of the times, so it does not blink away while they load.
    const [range, setRange] = useState<{ first: string; last: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        fetchTeeTimes(course.slug, { date: date ?? answeredDate.current, players, currency })
            .then((day) => {
                if (cancelled) return;
                answeredDate.current = day.date;
                setState({ status: 'ready', day });
                setRange({ first: day.firstDate, last: day.lastDate });
                // A picked time that is no longer listed (taken, or another day), or too small for
                // this party, is let go.
                setPicked((id) => {
                    const offer = id ? day.teeTimes.find((tt) => tt.id === id) : undefined;
                    return offer && offer.spotsLeft >= players ? id : undefined;
                });
            })
            .catch(() => { if (!cancelled) setState({ status: 'error' }); });
        return () => { cancelled = true; };
    }, [course.slug, date, players, currency, attempt]);

    const day = state.status === 'ready' ? state.day : null;
    const shownDate = day?.date ?? date;

    // The address follows the choice, once there is a day to name.
    useEffect(() => {
        if (!day) return;
        if (!loaded.current && !initial.date && !initial.time && players === (initial.players ?? 2) && !picked) {
            loaded.current = true;
            return;
        }
        loaded.current = true;
        const qs = new URLSearchParams({ date: day.date, players: String(players) });
        if (picked) qs.set('time', picked);
        router.replace(`/golf/${course.slug}?${qs.toString()}`, { scroll: false });
    }, [day, players, picked]); // eslint-disable-line react-hooks/exhaustive-deps

    // The exact total for the time picked, from the figures checkout will charge.
    useEffect(() => {
        if (!picked) { setQuote({ status: 'none' }); return; }
        let cancelled = false;
        setQuote({ status: 'loading' });
        fetchTeeTimeQuote(picked, { players, currency })
            .then((q) => { if (!cancelled) setQuote({ status: 'ready', quote: q }); })
            .catch(() => { if (!cancelled) setQuote({ status: 'gone' }); });
        return () => { cancelled = true; };
    }, [picked, players, currency]);

    const dateLocale = locale === 'en' ? 'en-GB' : locale;
    const formats = useMemo(() => ({
        full:    new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
        short:   new Intl.DateTimeFormat(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
        weekday: new Intl.DateTimeFormat(dateLocale, { weekday: 'short', timeZone: 'UTC' }),
        month:   new Intl.DateTimeFormat(dateLocale, { month: 'short', timeZone: 'UTC' }),
    }), [dateLocale]);

    const price = (offer: TeeTimeOffer) =>
        offer.allInPerPlayer != null && offer.currency
            ? money(offer.allInPerPlayer, offer.currency, locale)
            : t('teeTimes.priceOnRequest');

    const days = useMemo(() => (range ? eachDay(range.first, range.last) : []), [range]);
    const pickedOffer = day?.teeTimes.find((tt) => tt.id === picked);
    const hasTimes = !!day && day.teeTimes.length > 0;
    // The lines above the times stay up while they reload, so the row under them does not jump.
    const showIntro = hasTimes || (range !== null && state.status === 'loading');

    return (
        <section aria-labelledby="tee-times-title" className="space-y-4">
            <h2 id="tee-times-title" className="text-base font-bold text-slate-900 dark:text-slate-50">{t('teeTimes.title')}</h2>

            <div>
                <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">{t('teeTimes.players')}</p>
                <div className="grid grid-cols-4 gap-1">
                    {PARTY.map((n) => (
                        <button
                            key={n}
                            type="button"
                            aria-pressed={players === n}
                            onClick={() => setPlayers(n)}
                            className={cn(
                                'h-9 rounded-full border text-sm font-medium transition-colors',
                                players === n
                                    ? CHOSEN
                                    : 'border-slate-200 text-slate-700 hover:border-slate-400 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/30',
                            )}
                        >{n}</button>
                    ))}
                </div>
            </div>

            {days.length > 0 && (
                <div className="mt-4">
                    <SideScroller focusKey={shownDate} prevLabel={t('teeTimes.earlierDays')} nextLabel={t('teeTimes.laterDays')}>
                        {days.map((d) => {
                            const chosen = d === shownDate;
                            return (
                                <button
                                    key={d}
                                    data-key={d}
                                    type="button"
                                    aria-pressed={chosen}
                                    aria-label={formats.full.format(utcDate(d))}
                                    onClick={() => { setDate(d); setPicked(undefined); }}
                                    className={cn(
                                        'h-8 rounded-full text-xs transition-colors',
                                        !cell.inMonth && 'invisible',
                                        chosen
                                            ? `${CHOSEN} font-semibold`
                                            : 'text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-white/10 dark:disabled:text-white/20',
                                    )}
                                >
                                    <span className={cn('text-[11px]', chosen ? 'opacity-90' : 'text-slate-500 dark:text-slate-400')}>{formats.weekday.format(utcDate(d))}</span>
                                    <span className="text-base leading-tight font-semibold">{Number(d.slice(8))}</span>
                                    <span className={cn('text-[11px]', chosen ? 'opacity-90' : 'text-slate-500 dark:text-slate-400')}>{formats.month.format(utcDate(d))}</span>
                                </button>
                            );
                        })}
                    </SideScroller>
                </div>
            )}

            {state.status === 'loading' && (
                <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
            )}

            <div className="mt-3 min-h-[88px]">
                {state.status === 'loading' && (
                    <div className="flex gap-2 overflow-hidden py-1 sm:px-10">
                        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 w-28 shrink-0 rounded-xl" />)}
                    </div>
                )}

                {state.status === 'error' && (
                    <div className="space-y-2 py-4 text-sm text-slate-600 dark:text-slate-300">
                        <p>{t('teeTimes.loadError')}</p>
                        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="cursor-pointer font-semibold underline">{t('retry')}</button>
                    </div>
                )}

                {day && day.teeTimes.length === 0 && (
                    <p className="py-6 text-sm text-slate-600 dark:text-slate-300">{t('teeTimes.none')}</p>
                )}

                {day && day.teeTimes.length > 0 && (
                    <SideScroller focusKey={picked} prevLabel={t('teeTimes.earlierTimes')} nextLabel={t('teeTimes.laterTimes')}>
                        {day.teeTimes.map((offer) => {
                            const chosen = offer.id === picked;
                            // Too few spots for this party, or no price to charge: shown, not bookable.
                            const unavailable = offer.spotsLeft < players || offer.allInPerPlayer == null;
                            return (
                                <button
                                    key={offer.id}
                                    data-key={offer.id}
                                    type="button"
                                    aria-pressed={chosen}
                                    disabled={unavailable}
                                    onClick={() => setPicked(chosen ? undefined : offer.id)}
                                    className={cn(
                                        'flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors',
                                        chosen
                                            ? CHOSEN
                                            : 'border-slate-200 text-slate-900 hover:border-slate-400 dark:border-white/10 dark:text-white dark:hover:border-white/30',
                                    )}
                                >
                                    <span className="text-sm font-semibold">{clockTime(offer.localTime, locale)}</span>
                                    <span className={cn('text-[11px]', chosen ? 'opacity-90' : 'text-slate-500 dark:text-slate-400')}>
                                        {t('teeTimes.spotsLeft', { count: offer.spotsLeft })}
                                    </span>
                                    <span className="mt-0.5 text-xs font-medium">{price(offer)}</span>
                                </button>
                            );
                        })}
                    </SideScroller>
                )}
            </div>

            {hasTimes && picked && (
                <div className="mt-3 flex items-center justify-end gap-4 border-t border-slate-100 pt-4 dark:border-white/10">
                    {quote.status === 'loading' && <Skeleton className="h-7 w-28 rounded-lg" />}
                    {quote.status === 'ready' && (
                        <p className="text-right">
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">{t('teeTimes.total')}</span>
                            <span className="text-xl font-bold text-slate-900 dark:text-slate-50">{money(quote.quote.total, quote.quote.currency, locale)}</span>
                        </p>
                    )}
                    {quote.status === 'gone' ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">{t('teeTimes.justGone')}</p>
                    ) : (
                        <Link
                            href={`/golf/${course.slug}/book?teeTime=${picked}&players=${players}&date=${shownDate}`}
                            aria-disabled={quote.status !== 'ready'}
                            className={cn(
                                'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-linear-to-r from-blue-600 to-cyan-500 px-7 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-[filter] duration-150 hover:brightness-110',
                                quote.status !== 'ready' && 'pointer-events-none opacity-60',
                            )}
                        >
                            {t('teeTimes.book')} <ArrowRight size={16} aria-hidden />
                        </Link>
                    )}
                </div>
            )}
        </section>
    );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { useUserCurrency } from '@/shared/stores/search.store';
import { fetchTeeTimes } from '@/features/golf/api/golf.api';
import { AskTeeTimesButton } from '@/features/golf/components/ask-tee-times-button';
import { isSelectable, monthGrid, monthOf, shiftMonth } from '@/features/golf/lib/calendar';
import type { GolfCourse, TeeTimeDay, TeeTimeOffer } from '@/features/golf/types';

export interface TeeTimeSelection {
    date?:    string;
    players?: number;
    /** A tee time id. */
    time?:    string;
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; day: TeeTimeDay };

const PARTY = [1, 2, 3, 4];

/** A date on the course's clock, which must not move with the visitor's zone; hence UTC. */
const utcDate = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
};

/**
 * The course page's tee times (spec 2026-11-04-golf-tee-times §6): pick a date and a party size, see
 * the open times priced all-in per player in the visitor's currency, and ask about the one picked.
 * Prices come from api-v2 already converted, and are asked for again whenever the header currency
 * changes; the browser never converts. The picked day, party and time live in the address, so a link
 * can be shared and a visitor sent to sign in comes back to the same choice.
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
    const [month, setMonth] = useState<string | undefined>(initial.date ? monthOf(initial.date) : undefined);
    const [state, setState] = useState<State>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const loaded = useRef(false);
    // The day last answered. Once api-v2 has chosen one, a change of party or currency asks about that
    // same day again rather than letting it choose afresh.
    const answeredDate = useRef<string | undefined>(initial.date);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        fetchTeeTimes(course.slug, { date: date ?? answeredDate.current, players, currency })
            .then((day) => {
                if (cancelled) return;
                answeredDate.current = day.date;
                setState({ status: 'ready', day });
                setMonth((m) => m ?? monthOf(day.date));
                // A picked time that is no longer listed (taken, or another day) is let go.
                setPicked((id) => (id && day.teeTimes.some((tt) => tt.id === id) ? id : undefined));
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

    const dateLocale = locale === 'en' ? 'en-GB' : locale;
    const formats = useMemo(() => ({
        month: new Intl.DateTimeFormat(dateLocale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        full:  new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
        short: new Intl.DateTimeFormat(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
        weekday: new Intl.DateTimeFormat(dateLocale, { weekday: 'narrow', timeZone: 'UTC' }),
    }), [dateLocale]);

    const price = (offer: TeeTimeOffer) =>
        offer.allInPerPlayer != null && offer.currency
            ? new Intl.NumberFormat(locale, { style: 'currency', currency: offer.currency }).format(offer.allInPerPlayer)
            : t('teeTimes.priceOnRequest');

    const pickedOffer = day?.teeTimes.find((tt) => tt.id === picked);
    const draft = pickedOffer && shownDate
        ? t('teeTimes.draft', {
            course: course.name,
            date:   formats.short.format(utcDate(shownDate)),
            time:   pickedOffer.localTime,
            city:   course.city,
            count:  players,
        })
        : undefined;

    const viewMonth = month ?? (shownDate ? monthOf(shownDate) : undefined);

    return (
        <section aria-labelledby="tee-times-title" className="space-y-4">
            <h2 id="tee-times-title" className="text-sm font-semibold text-slate-900 dark:text-white">{t('teeTimes.title')}</h2>

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
                                'h-9 border text-sm font-medium transition-colors',
                                players === n
                                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                                    : 'border-slate-200 text-slate-700 hover:border-slate-400 dark:border-white/10 dark:text-slate-200',
                            )}
                        >{n}</button>
                    ))}
                </div>
            </div>

            {viewMonth && (
                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <button
                            type="button" aria-label={t('teeTimes.prevMonth')}
                            disabled={!day || viewMonth <= monthOf(day.firstDate)}
                            onClick={() => setMonth(shiftMonth(viewMonth, -1))}
                            className="p-1 text-slate-500 disabled:opacity-30 dark:text-slate-400"
                        ><ChevronLeft size={16} /></button>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formats.month.format(utcDate(`${viewMonth}-01`))}</p>
                        <button
                            type="button" aria-label={t('teeTimes.nextMonth')}
                            disabled={!day || viewMonth >= monthOf(day.lastDate)}
                            onClick={() => setMonth(shiftMonth(viewMonth, 1))}
                            className="p-1 text-slate-500 disabled:opacity-30 dark:text-slate-400"
                        ><ChevronRight size={16} /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                        {monthGrid(viewMonth).slice(0, 7).map((cell) => (
                            <span key={cell.date} aria-hidden className="py-1 text-[10px] text-slate-400">{formats.weekday.format(utcDate(cell.date))}</span>
                        ))}
                        {monthGrid(viewMonth).map((cell) => {
                            const selectable = cell.inMonth && !!day && isSelectable(cell.date, day.firstDate, day.lastDate);
                            const chosen = cell.date === shownDate;
                            return (
                                <button
                                    key={cell.date}
                                    type="button"
                                    disabled={!selectable}
                                    aria-pressed={chosen}
                                    aria-label={formats.full.format(utcDate(cell.date))}
                                    onClick={() => { setDate(cell.date); setPicked(undefined); }}
                                    className={cn(
                                        'h-8 text-xs transition-colors',
                                        !cell.inMonth && 'invisible',
                                        chosen
                                            ? 'bg-slate-900 font-semibold text-white dark:bg-white dark:text-slate-900'
                                            : 'text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-white/10 dark:disabled:text-white/20',
                                    )}
                                >{Number(cell.date.slice(8))}</button>
                            );
                        })}
                    </div>
                </div>
            )}

            {state.status === 'loading' && (
                <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
            )}

            {state.status === 'error' && (
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <p>{t('teeTimes.loadError')}</p>
                    <button type="button" onClick={() => setAttempt((a) => a + 1)} className="font-semibold underline">{t('retry')}</button>
                </div>
            )}

            {day && day.teeTimes.length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-300">{t('teeTimes.none')}</p>
            )}

            {day && day.teeTimes.length > 0 && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        {day.teeTimes.map((offer) => {
                            const chosen = offer.id === picked;
                            return (
                                <button
                                    key={offer.id}
                                    type="button"
                                    aria-pressed={chosen}
                                    onClick={() => setPicked(chosen ? undefined : offer.id)}
                                    className={cn(
                                        'flex flex-col items-start border px-3 py-2 text-left transition-colors',
                                        chosen
                                            ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                                            : 'border-slate-200 text-slate-900 hover:border-slate-400 dark:border-white/10 dark:text-white dark:hover:border-white/30',
                                    )}
                                >
                                    <span className="text-sm font-semibold">{offer.localTime}</span>
                                    <span className={cn('text-[11px]', chosen ? 'opacity-80' : 'text-slate-500 dark:text-slate-400')}>
                                        {t('teeTimes.spotsLeft', { count: offer.spotsLeft })}
                                    </span>
                                    <span className="text-xs font-medium">{price(offer)}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('teeTimes.priceNote', { count: players })}</p>
                </>
            )}

            {!draft && day && day.teeTimes.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('teeTimes.pickHint')}</p>
            )}
            <AskTeeTimesButton draft={draft} />
        </section>
    );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flag, Undo2, X } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { GOLF_BOOKINGS_CHANGED } from '@/features/admin/components/admin-sidebar';
import { adminGolfApi } from '@/features/golf/api/golf.api';
import { EXTRA_NAMES_EN, extrasCourseTotal } from '@/features/golf/lib/extras';
import { money, teeTimeLabels } from '@/features/golf/lib/format';
import type { AdminGolfBooking, GolfBookingList } from '@/features/golf/types';

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const LISTS: Array<{ id: GolfBookingList; label: string; hint: string }> = [
    { id: 'waiting',  label: 'Waiting',  hint: 'Paid requests to check with the course. Confirm charges the card; Decline releases it.' },
    { id: 'upcoming', label: 'Upcoming', hint: 'Confirmed and charged, still to be played. Cancel & refund sends the whole charge back, whatever the free-cancellation date.' },
    { id: 'closed',   label: 'Closed',   hint: 'Declined, expired, cancelled, and rounds already played.' },
];

/** Under this long to answer, a request is drawn as urgent. */
const URGENT_MS = 6 * 3_600_000;

const STATUS: Record<AdminGolfBooking['status'], { label: string; variant: 'default' | 'success' | 'destructive' | 'outline' }> = {
    held:      { label: 'Awaiting payment', variant: 'outline' },
    requested: { label: 'Waiting',          variant: 'default' },
    confirmed: { label: 'Confirmed',        variant: 'success' },
    expired:   { label: 'Expired',          variant: 'outline' },
    declined:  { label: 'Declined',         variant: 'destructive' },
    cancelled: { label: 'Cancelled',        variant: 'destructive' },
};

const CLOSE_REASON: Record<string, string> = {
    hold_expired:          'Hold ran out unpaid',
    declined_by_team:      'Declined by the team',
    not_confirmed_in_time: 'No answer in time',
    cancelled_by_customer: 'Cancelled by the customer',
    cancelled_by_team:     'Cancelled by the team',
};

/**
 * Golf bookings to answer (api-v2 `/admin/golf/bookings`). Our tee times are not the course's own
 * tee sheet, so a paid request is final only once someone here has checked with the course. Confirm
 * captures the authorised card; Decline releases it and gives the spots back. A confirmed booking can
 * still be cancelled here, if the course closes or rain stops play, with the whole charge refunded.
 */
export function GolfBookingsView() {
    const [view, setView]         = useState<GolfBookingList>('waiting');
    const [page, setPage]         = useState(1);
    const [bookings, setBookings] = useState<AdminGolfBooking[]>([]);
    const [total, setTotal]       = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading]   = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busy, setBusy]         = useState<string | null>(null);

    const load = useCallback(async (v: GolfBookingList, p: number) => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await adminGolfApi.listBookings(v, p);
            setBookings(res.data ?? []);
            setTotal(res.total ?? 0);
            setTotalPages(res.totalPages ?? 1);
        } catch (err) {
            setLoadError(message(err, 'Failed to load golf bookings.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(view, page); }, [view, page, load]);

    const choose = (v: GolfBookingList) => {
        setView(v);
        setPage(1);
        setActionError(null);
    };

    async function answer(b: AdminGolfBooking, action: 'confirm' | 'decline' | 'cancel') {
        const amount = money(b.total, b.currency, 'en');
        const question = {
            confirm: `Confirm ${b.reference}? This charges ${b.leadName}'s card ${amount}.`,
            decline: `Decline ${b.reference}? The hold on ${b.leadName}'s card is released and nothing is charged.`,
            cancel:  `Cancel ${b.reference}? This refunds ${b.leadName} ${amount} in full and puts the spots back on sale.`,
        }[action];
        if (!window.confirm(question)) return;

        setBusy(b.reference);
        setActionError(null);
        try {
            if (action === 'confirm') await adminGolfApi.confirmBooking(b.reference);
            else if (action === 'decline') await adminGolfApi.declineBooking(b.reference);
            else await adminGolfApi.cancelBooking(b.reference);
            await load(view, page);
            window.dispatchEvent(new Event(GOLF_BOOKINGS_CHANGED));
        } catch (err) {
            setActionError(`${b.reference}: ${message(err, 'That did not go through.')}`);
        } finally {
            setBusy(null);
        }
    }

    const hint = LISTS.find((l) => l.id === view)!.hint;

    return (
        <div className="space-y-5 p-6">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Golf Bookings</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
            </div>

            <div className="flex gap-1" role="tablist" aria-label="Booking lists">
                {LISTS.map((l) => (
                    <button
                        key={l.id}
                        type="button"
                        role="tab"
                        aria-selected={view === l.id}
                        onClick={() => choose(l.id)}
                        className={cn(
                            'cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                            view === l.id
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
                        )}
                    >
                        {l.label}
                    </button>
                ))}
            </div>

            {actionError && <p role="alert" className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{actionError}</p>}
            {loadError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>}

            {loading && (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
            )}

            {!loading && !loadError && bookings.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
                    <Flag size={28} strokeWidth={1.5} aria-hidden />
                    <p className="text-sm">Nothing here.</p>
                </div>
            )}

            {!loading && bookings.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">
                            <tr>
                                <th className="px-4 py-2.5 font-medium">Booking</th>
                                <th className="px-4 py-2.5 font-medium">Tee time (course clock)</th>
                                <th className="px-4 py-2.5 font-medium">Lead player</th>
                                <th className="px-4 py-2.5 text-right font-medium">Charge</th>
                                <th className="px-4 py-2.5 font-medium">{view === 'waiting' ? 'Answer by' : 'Status'}</th>
                                {view !== 'closed' && <th className="px-4 py-2.5" />}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                            {bookings.map((b) => {
                                const tee = teeTimeLabels(b.startsAt, b.course.timezone, 'en');
                                const deadline = b.decideBy ? teeTimeLabels(b.decideBy, b.course.timezone, 'en') : null;
                                const urgent = b.decideBy && new Date(b.decideBy).getTime() - Date.now() < URGENT_MS;
                                return (
                                    <tr key={b.id} className="align-top">
                                        <td className="px-4 py-3">
                                            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{b.reference}</p>
                                            <p className="font-medium text-slate-900 dark:text-white">{b.course.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{b.course.city} · {b.course.country}</p>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-800 dark:text-slate-100">
                                            <p>{tee.date}</p>
                                            <p className="font-semibold">{tee.time}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{b.players} {b.players === 1 ? 'player' : 'players'}</p>
                                            {b.extras.map((e) => (
                                                <p key={e.code} className="text-xs text-slate-500 dark:text-slate-400">{EXTRA_NAMES_EN[e.code]} × {e.quantity}</p>
                                            ))}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-slate-800 dark:text-slate-100">{b.leadName}</p>
                                            <p className="text-xs break-all text-slate-500 dark:text-slate-400">{b.contactEmail}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <p className="font-semibold text-slate-900 dark:text-white">{money(b.total, b.currency, 'en')}</p>
                                            {/* What to tell the course: its own figure, in its own currency. */}
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Course: {money(b.pricePerPlayer * b.players + extrasCourseTotal(b.extras), b.courseCurrency, 'en')}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {view === 'waiting' && deadline ? (
                                                <p className={cn(urgent ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100')}>
                                                    {deadline.date} {deadline.time}
                                                </p>
                                            ) : (
                                                <>
                                                    <Badge variant={STATUS[b.status].variant}>{STATUS[b.status].label}</Badge>
                                                    {b.closeReason && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{CLOSE_REASON[b.closeReason]}</p>}
                                                    {b.refundAmount > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Refunded {money(b.refundAmount, b.currency, 'en')}</p>}
                                                </>
                                            )}
                                        </td>
                                        {view === 'waiting' && (
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" disabled={busy !== null} onClick={() => void answer(b, 'confirm')}>
                                                        <Check size={14} aria-hidden /> Confirm
                                                    </Button>
                                                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void answer(b, 'decline')}>
                                                        <X size={14} aria-hidden /> Decline
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                        {view === 'upcoming' && (
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end">
                                                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void answer(b, 'cancel')}>
                                                        <Undo2 size={14} aria-hidden /> Cancel &amp; refund
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>{total} bookings</span>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /></Button>
                        <span>{page} / {totalPages}</span>
                        <Button size="sm" variant="outline" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={14} /></Button>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, CreditCard, Flag, XCircle, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { useAuthStore } from '@/shared/auth/store';
import { FlatGround } from '@/shared/components/common/FlatGround';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { useSupportWidget } from '@/features/support/lib/supportWidget.store';
import { cancelGolfBooking, fetchGolfBooking } from '@/features/golf/api/golf.api';
import { GolfBookingSummary } from '@/features/golf/components/golf-booking-summary';
import { formatExtrasParam } from '@/features/golf/lib/extras';
import { money, teeTimeLabels } from '@/features/golf/lib/format';
import type { GolfBooking } from '@/features/golf/types';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; booking: GolfBooking };

/** How often a booking still waiting on the card is asked about, and for how long. */
const POLL_MS = 4000;
const POLL_TIMES = 15;

/** Refusals that mean the booking moved on while the page was open: read it again rather than complain. */
const MOVED_ON = new Set(['FREE_CANCELLATION_ENDED', 'BOOKING_CHANGED', 'NOT_CANCELLABLE']);

/** Which message a booking's state gets. Declined and cancelled have two, because whose doing it was is the news. */
function messageKey(b: GolfBooking): string {
    if (b.status === 'declined') return b.closeReason === 'not_confirmed_in_time' ? 'notAnswered' : 'declined';
    if (b.status === 'cancelled') return b.closeReason === 'cancelled_by_team' ? 'cancelledByTeam' : 'cancelled';
    return b.status;
}

const LOOK: Record<string, { icon: LucideIcon; tone: string }> = {
    held:            { icon: CreditCard,   tone: 'text-blue-600 dark:text-blue-400' },
    requested:       { icon: Clock,        tone: 'text-blue-600 dark:text-blue-400' },
    confirmed:       { icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
    expired:         { icon: XCircle,      tone: 'text-slate-500 dark:text-slate-400' },
    declined:        { icon: XCircle,      tone: 'text-rose-600 dark:text-rose-400' },
    notAnswered:     { icon: XCircle,      tone: 'text-rose-600 dark:text-rose-400' },
    cancelled:       { icon: XCircle,      tone: 'text-slate-500 dark:text-slate-400' },
    cancelledByTeam: { icon: XCircle,      tone: 'text-rose-600 dark:text-rose-400' },
};

/**
 * `/golf/bookings/[reference]`: the customer's own booking (api-v2 CONTEXT.md, "Golf Booking"). Asking
 * for it also brings it up to date with Stripe, which covers a closed tab or a slow webhook; while it is
 * still waiting on the card, this keeps asking for a minute, so it moves on by itself after paying.
 */
export function GolfBookingView({ reference }: { reference: string }) {
    const t = useTranslations('golf.booking');
    const tGolf = useTranslations('golf');
    const locale = useLocale();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const checking = useAuthStore((s) => s.isLoading);

    const [state, setState] = useState<State>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [polls, setPolls] = useState(0);

    useEffect(() => {
        if (!checking && !user) {
            router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        }
    }, [checking, user, router]);

    useEffect(() => {
        if (checking || !user) return;
        let cancelled = false;
        fetchGolfBooking(reference)
            .then((booking) => { if (!cancelled) setState({ status: 'ready', booking }); })
            .catch((err: { status?: number }) => {
                if (!cancelled) setState({ status: err?.status === 404 ? 'missing' : 'error' });
            });
        return () => { cancelled = true; };
    }, [reference, attempt, polls, checking, user]);

    const stillHeld = state.status === 'ready' && state.booking.status === 'held';
    useEffect(() => {
        if (!stillHeld || polls >= POLL_TIMES) return;
        const id = window.setTimeout(() => setPolls((n) => n + 1), POLL_MS);
        return () => window.clearTimeout(id);
    }, [stillHeld, polls]);

    return (
        <div className="flex min-h-screen flex-col">
            <FlatGround />
            <LandingHeader tone="default" />
            <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pt-2 pb-24 md:pt-4 md:pb-28">
                {state.status === 'loading' && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                        <Skeleton className="h-48 w-full rounded-2xl" />
                        <Skeleton className="h-96 w-full rounded-2xl" />
                    </div>
                )}

                {state.status === 'missing' && (
                    <StateScreen
                        icon={Flag}
                        title={t('missingTitle')}
                        lines={[t('missingBody')]}
                        actions={<Link href="/golf" className={stateActionClass}>{tGolf('seeAll')}</Link>}
                    />
                )}

                {state.status === 'error' && (
                    <StateScreen
                        icon={AlertCircle}
                        title={tGolf('errorTitle')}
                        lines={[tGolf('errorBody')]}
                        actions={<button type="button" className={stateActionClass} onClick={() => setAttempt((a) => a + 1)}>{tGolf('retry')}</button>}
                    />
                )}

                {state.status === 'ready' && (() => {
                    const b = state.booking;
                    const key = messageKey(b);
                    const { icon: Icon, tone } = LOOK[key];
                    const dateTime = (at: string | null) => {
                        if (!at) return '';
                        const { date, time } = teeTimeLabels(at, b.course.timezone, locale);
                        return `${date} ${time}`;
                    };
                    const refunded = b.refundAmount > 0;
                    return (
                        <>
                            <h1 className="mb-5 text-lg font-bold text-slate-900 md:text-2xl dark:text-slate-50">{t('yourBooking')}</h1>
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                                <div className="h-fit space-y-5 rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900">
                                    <div className="flex items-start gap-3">
                                        <Icon size={26} className={cn('mt-0.5 shrink-0', tone)} aria-hidden />
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{t(`status.${key}.title`)}</h2>
                                            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                                {b.status === 'cancelled' && refunded
                                                    ? t('refunded', { amount: money(b.refundAmount, b.currency, locale) })
                                                    : t(`status.${key}.body`, { deadline: dateTime(b.decideBy), holdEnds: dateTime(b.holdExpiresAt) })}
                                            </p>
                                        </div>
                                    </div>

                                    <dl className="space-y-1.5 border-t border-slate-100 pt-4 text-sm dark:border-white/10">
                                        <Detail label={t('reference')} value={b.reference} />
                                        <Detail label={t('leadName')} value={b.leadName} />
                                        <Detail label={t('email')} value={b.contactEmail} />
                                    </dl>

                                    {(b.status === 'requested' || b.status === 'confirmed') && (
                                        <Cancellation
                                            booking={b}
                                            until={dateTime(b.freeCancelUntil)}
                                            onCancelled={(booking) => setState({ status: 'ready', booking })}
                                            onMovedOn={() => setAttempt((a) => a + 1)}
                                        />
                                    )}

                                    {b.status === 'held' && (
                                        <Link
                                            href={`/golf/${b.course.slug}/book?teeTime=${b.teeTimeId}&players=${b.players}${b.extras.length > 0 ? `&extras=${formatExtrasParam(b.extras)}` : ''}`}
                                            className={stateActionClass}
                                        >{t('finishPaying')}</Link>
                                    )}
                                    {(b.status === 'expired' || b.status === 'declined' || b.status === 'cancelled') && (
                                        <Link href={`/golf/${b.course.slug}`} className={stateActionClass}>{t('pickAnother')}</Link>
                                    )}
                                </div>

                                <GolfBookingSummary
                                    course={b.course}
                                    startsAt={b.startsAt}
                                    timezone={b.course.timezone}
                                    players={b.players}
                                    currency={b.currency}
                                    greenFee={b.greenFee}
                                    extras={b.extras}
                                    serviceFee={b.serviceFee}
                                    total={b.total}
                                />
                            </div>
                        </>
                    );
                })()}
            </main>
        </div>
    );
}

const OUTLINE = 'inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/30';

/**
 * The way out of a booking. It asks first and says what comes back, because a refund takes days to
 * reach a statement and cannot be taken back here. Whether it can be done is api-v2's to say
 * (`cancellable`); once free cancellation has ended the way out is a person, so it offers support.
 */
function Cancellation({ booking: b, until, onCancelled, onMovedOn }: {
    booking:     GolfBooking;
    until:       string;
    onCancelled: (b: GolfBooking) => void;
    onMovedOn:   () => void;
}) {
    const t = useTranslations('golf.booking');
    const locale = useLocale();
    const requestSupport = useSupportWidget((s) => s.requestOpen);
    const [asking, setAsking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isRequest = b.status === 'requested';

    const cancel = async () => {
        setBusy(true);
        setError(null);
        try {
            onCancelled(await cancelGolfBooking(b.reference));
        } catch (e) {
            const code = (e as { code?: string })?.code;
            if (code && MOVED_ON.has(code)) {
                setAsking(false);
                onMovedOn();
            } else {
                setError(t('cancelFailed'));
            }
        } finally {
            setBusy(false);
        }
    };

    if (!b.cancellable) {
        return (
            <div className="space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
                <p>{t('freeCancelEnded', { date: until })}</p>
                <button
                    type="button"
                    onClick={() => requestSupport(t('supportDraft', { reference: b.reference }))}
                    className={OUTLINE}
                >{t('contactSupport')}</button>
            </div>
        );
    }

    return (
        <div className="space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
            {!isRequest && <p>{t('freeCancelUntil', { date: until })}</p>}

            {!asking ? (
                <button type="button" onClick={() => setAsking(true)} className={OUTLINE}>
                    {isRequest ? t('cancelRequest') : t('cancelBooking')}
                </button>
            ) : (
                <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                    <p className="text-slate-800 dark:text-slate-100">
                        {isRequest ? t('cancelRequestNote') : t('refundNote', { amount: money(b.total, b.currency, locale) })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void cancel()}
                            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >{busy ? t('cancelling') : t('confirmCancel')}</button>
                        <button type="button" disabled={busy} onClick={() => { setAsking(false); setError(null); }} className={OUTLINE}>
                            {t('keepBooking')}
                        </button>
                    </div>
                </div>
            )}

            {error && <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="text-right font-medium break-all text-slate-800 dark:text-slate-100">{value}</dd>
        </div>
    );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadStripe, type Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { AlertCircle, ArrowLeft, Clock, Flag, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { useAuthStore } from '@/shared/auth/store';
import { FlatGround } from '@/shared/components/common/FlatGround';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import { useTheme } from '@/shared/components/ThemeContext';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { env } from '@/shared/lib/env';
import { BRAND } from '@/shared/lib/palette';
import { useUserCurrency } from '@/shared/stores/search.store';
import { checkoutPalette, DANGER } from '@/features/checkout/lib/palette';
import { fetchTeeTimeQuote, startGolfBooking } from '@/features/golf/api/golf.api';
import { GolfBookingSummary } from '@/features/golf/components/golf-booking-summary';
import { GolfExtrasPicker } from '@/features/golf/components/golf-extras-picker';
import { formatExtrasParam, parseExtrasParam } from '@/features/golf/lib/extras';
import { money, teeTimeLabels } from '@/features/golf/lib/format';
import type { GolfExtraChoice, GolfExtraCode, GolfExtraLine, StartedGolfBooking, TeeTimeQuote } from '@/features/golf/types';

type HttpError = Error & { status?: number; code?: string; body?: Record<string, unknown> };
type Load =
    | { status: 'loading' }
    | { status: 'error' }
    /** The tee time cannot be booked: taken, closed, too soon, or too few spots for this party. */
    | { status: 'gone'; spotsLeft?: number }
    | { status: 'ready'; quote: TeeTimeQuote };

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
    if (!stripePromise) stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
    return stripePromise;
}

/** Stripe's form in the checkout's colours: the iframe takes no CSS of ours, only these. */
function stripeAppearance(theme: 'light' | 'dark'): Appearance {
    const palette = checkoutPalette(theme);
    return {
        theme: theme === 'dark' ? 'night' : 'stripe',
        variables: {
            colorPrimary:         palette.text,
            colorBackground:      palette.fieldBg,
            colorText:            palette.text,
            colorTextSecondary:   palette.muted,
            colorTextPlaceholder: palette.faint,
            colorDanger:          DANGER,
            borderRadius:         '12px',
            fontSizeBase:         '14px',
        },
        rules: {
            '.Input':       { border: `1.5px solid ${palette.icon}`, boxShadow: 'none', padding: '12px 16px', borderRadius: '999px' },
            '.Input:focus': { boxShadow: `0 0 0 4px ${BRAND.primaryWash}` },
            '.Label':       { color: palette.text, fontSize: '13px', fontWeight: '400', marginBottom: '8px' },
        },
    };
}

const PRIMARY = 'inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-linear-to-r from-blue-600 to-cyan-500 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-[filter] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60';

/** Seconds until `at`, ticking, floored at zero. */
function useSecondsUntil(at: string | undefined): number | null {
    const left = useCallback(() => (at ? Math.max(0, Math.ceil((new Date(at).getTime() - Date.now()) / 1000)) : null), [at]);
    const [seconds, setSeconds] = useState<number | null>(left);
    useEffect(() => {
        setSeconds(left());
        if (!at) return;
        const id = window.setInterval(() => setSeconds(left()), 1000);
        return () => window.clearInterval(id);
    }, [at, left]);
    return seconds;
}

/**
 * `/golf/[slug]/book`: the checkout for a tee time (api-v2 CONTEXT.md, "Golf Booking"). Any extras, who
 * is playing, then the card. Starting takes the spots for 15 minutes; paying authorises the card, which
 * makes it a request for the team to confirm with the course. The figures shown are api-v2's, and the
 * currency and extras are locked once the hold is taken: a change in the header after that does not
 * touch this payment.
 */
export function GolfBookView({ slug, teeTimeId, players, date, extras = '' }: { slug: string; teeTimeId: string; players: number; date?: string; extras?: string }) {
    const t = useTranslations('golf.booking');
    const tGolf = useTranslations('golf');
    const locale = useLocale();
    const router = useRouter();
    const { theme } = useTheme();
    const currency = useUserCurrency();
    const user = useAuthStore((s) => s.user);
    const checking = useAuthStore((s) => s.isLoading);

    const [load, setLoad] = useState<Load>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [choices, setChoices] = useState<GolfExtraChoice[]>(() => parseExtrasParam(extras));
    const [repricing, setRepricing] = useState(false);
    const [leadName, setLeadName] = useState('');
    const [nameTouched, setNameTouched] = useState(false);
    const [started, setStarted] = useState<StartedGolfBooking | null>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // On the day and party in hand. Its links replace this page: a checkout left behind is what the
    // browser's Back would find, with its tee time held or gone by then.
    const backToCourse = `/golf/${slug}?${date ? `date=${date}&` : ''}players=${players}`;
    const extrasParam = formatExtrasParam(choices);

    // Signed-out visitors sign in and come straight back here.
    useEffect(() => {
        if (!checking && !user) {
            router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        }
    }, [checking, user, router]);

    // Their own name, until they type another: most people book for themselves.
    useEffect(() => {
        if (user && !nameTouched) setLeadName([user.first_name, user.last_name].filter(Boolean).join(' '));
    }, [user, nameTouched]);

    useEffect(() => {
        if (checking || !user || started) return;
        let cancelled = false;
        // Only the first load has nothing to show: changing an extra keeps the page up while it reprices.
        setLoad((l) => (l.status === 'ready' ? l : { status: 'loading' }));
        setRepricing(true);
        fetchTeeTimeQuote(teeTimeId, { players, currency, extras: extrasParam })
            .then((quote) => {
                if (cancelled) return;
                setLoad({ status: 'ready', quote });
                setRepricing(false);
            })
            .catch((err: HttpError) => {
                if (cancelled) return;
                setRepricing(false);
                if (err?.status === 409 || err?.status === 404) {
                    setLoad({ status: 'gone', spotsLeft: err.body?.spotsLeft as number | undefined });
                } else {
                    setLoad({ status: 'error' });
                }
            });
        return () => { cancelled = true; };
    }, [teeTimeId, players, currency, extrasParam, attempt, checking, user, started]);

    const secondsLeft = useSecondsUntil(started?.holdExpiresAt);
    const holdRanOut = started !== null && secondsLeft === 0;

    const quantityOf = (code: GolfExtraCode) => Math.min(choices.find((c) => c.code === code)?.quantity ?? 0, players);

    const choose = (code: GolfExtraCode, quantity: number) => {
        const next = [...choices.filter((c) => c.code !== code), ...(quantity > 0 ? [{ code, quantity }] : [])];
        setChoices(next);
        setNotice(null);
        // In the address too, so a reload or a trip through sign-in keeps them.
        const url = new URL(window.location.href);
        if (next.length > 0) url.searchParams.set('extras', formatExtrasParam(next));
        else url.searchParams.delete('extras');
        window.history.replaceState(null, '', url);
    };

    const begin = async () => {
        if (load.status !== 'ready' || busy || repricing) return;
        const name = leadName.trim();
        if (!name) { setError(t('leadNameRequired')); return; }
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            // The quote's lines, not the buttons: they are what `shownTotal` was worked out from.
            const out = await startGolfBooking({
                teeTimeId, players, leadName: name, currency: load.quote.currency, shownTotal: load.quote.total,
                extras: load.quote.extras.map(({ code, quantity }) => ({ code, quantity })),
            });
            if (!out.clientSecret) {
                router.replace(`/golf/bookings/${out.reference}`);
                return;
            }
            setStarted(out);
        } catch (e) {
            const err = e as HttpError;
            if (err?.code === 'PRICE_CHANGED') {
                // Never charged more than was shown: the new figures go on the card, and they decide.
                const b = err.body ?? {};
                setLoad({ status: 'ready', quote: {
                    ...load.quote,
                    currency:   String(b.currency ?? load.quote.currency),
                    greenFee:   Number(b.greenFee ?? load.quote.greenFee),
                    extras:     (b.extras as GolfExtraLine[] | undefined) ?? load.quote.extras,
                    extrasTotal: Number(b.extrasTotal ?? load.quote.extrasTotal),
                    serviceFee: Number(b.serviceFee ?? load.quote.serviceFee),
                    total:      Number(b.total ?? load.quote.total),
                } });
                setNotice(t('priceChanged'));
            } else if (err?.code === 'EXTRAS_UNAVAILABLE') {
                // Asked again, the quote answers with what can still be had and the figures to match.
                setNotice(t('extrasUnavailable'));
                setAttempt((a) => a + 1);
            } else if (err?.code === 'NOT_ENOUGH_SPOTS' || err?.code === 'TEE_TIME_UNAVAILABLE') {
                setLoad({ status: 'gone', spotsLeft: err.body?.spotsLeft as number | undefined });
            } else {
                setError(err?.status === 429 ? t('tooMany') : t('startError'));
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col">
            <FlatGround />
            <LandingHeader tone="default" />
            <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pt-2 pb-24 md:pt-4 md:pb-28">
                <Link replace href={backToCourse} className="mb-3 inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-blue-500 dark:text-white/55">
                    <ArrowLeft size={14} aria-hidden /> {t('backToCourse')}
                </Link>
                <h1 className="mb-5 text-lg font-bold text-slate-900 md:text-2xl dark:text-slate-50">{t('title')}</h1>

                {(checking || !user || load.status === 'loading') && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                        <Skeleton className="h-64 w-full rounded-2xl" />
                        <Skeleton className="h-96 w-full rounded-2xl" />
                    </div>
                )}

                {user && load.status === 'error' && (
                    <StateScreen
                        icon={AlertCircle}
                        title={tGolf('errorTitle')}
                        lines={[tGolf('errorBody')]}
                        actions={<button type="button" className={stateActionClass} onClick={() => setAttempt((a) => a + 1)}>{tGolf('retry')}</button>}
                    />
                )}

                {user && load.status === 'gone' && (
                    <StateScreen
                        icon={Flag}
                        title={t('unavailableTitle')}
                        lines={[load.spotsLeft ? t('tooFewSpots', { count: load.spotsLeft }) : t('unavailableBody')]}
                        actions={<Link replace href={backToCourse} className={stateActionClass}>{t('pickAnother')}</Link>}
                    />
                )}

                {user && load.status === 'ready' && (
                    holdRanOut ? (
                        <StateScreen
                            icon={Clock}
                            title={t('holdRanOutTitle')}
                            lines={[t('holdRanOutBody')]}
                            actions={<Link replace href={backToCourse} className={stateActionClass}>{t('pickAnother')}</Link>}
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                            <div className="space-y-4">
                                {!started && load.quote.extraOffers.length > 0 && (
                                    <GolfExtrasPicker
                                        offers={load.quote.extraOffers}
                                        currency={load.quote.currency}
                                        players={players}
                                        quantityOf={quantityOf}
                                        onChange={choose}
                                    />
                                )}
                                <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900">
                                    {!started ? (
                                        <div className="space-y-5">
                                            <div>
                                                <label htmlFor="golf-lead-name" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-100">{t('leadName')}</label>
                                                <input
                                                    id="golf-lead-name"
                                                    value={leadName}
                                                    maxLength={120}
                                                    autoComplete="name"
                                                    onChange={(e) => { setLeadName(e.target.value); setNameTouched(true); setError(null); }}
                                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                />
                                                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{t('leadNameHint')}</p>
                                            </div>
                                            {notice && <p role="status" className="rounded-xl bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-200">{notice}</p>}
                                            {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
                                            <button type="button" onClick={() => void begin()} disabled={busy || repricing} className={PRIMARY}>
                                                {busy ? t('starting') : t('continue')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {secondsLeft !== null && (
                                                <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                    <Clock size={15} className="shrink-0 text-blue-500" aria-hidden />
                                                    {t('holdTimer', { time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` })}
                                                </p>
                                            )}
                                            {/* Keyed on the secret: Elements cannot change its intent once mounted. */}
                                            <Elements key={started.clientSecret} stripe={getStripe()} options={{ clientSecret: started.clientSecret!, appearance: stripeAppearance(theme) }}>
                                                <PayForm reference={started.reference} amount={money(started.total, started.currency, locale)} />
                                            </Elements>
                                        </div>
                                    )}
                                </div>

                                <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    <ShieldCheck size={15} className="mt-px shrink-0 text-blue-500" aria-hidden />
                                    <span>
                                        {t('howItWorks')}{' '}
                                        {(() => {
                                            const until = load.quote.freeCancelUntil;
                                            if (new Date(until).getTime() <= Date.now()) return t('noFreeCancel');
                                            const { date, time } = teeTimeLabels(until, load.quote.timezone, locale);
                                            return t('freeCancelUntil', { date: `${date} ${time}` });
                                        })()}
                                    </span>
                                </p>
                            </div>

                            <GolfBookingSummary
                                course={load.quote.course}
                                startsAt={load.quote.startsAt}
                                timezone={load.quote.timezone}
                                players={players}
                                currency={started?.currency ?? load.quote.currency}
                                greenFee={started?.greenFee ?? load.quote.greenFee}
                                extras={started?.extras ?? load.quote.extras}
                                serviceFee={started?.serviceFee ?? load.quote.serviceFee}
                                total={started?.total ?? load.quote.total}
                            />
                        </div>
                    )
                )}
            </main>
        </div>
    );
}

/** The card. Authorising it is what turns the hold into a request; the booking page says so from there. */
function PayForm({ reference, amount }: { reference: string; amount: string }) {
    const t = useTranslations('golf.booking');
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pay = async () => {
        if (!stripe || !elements || busy) return;
        setBusy(true);
        setError(null);
        const { error: failed } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: `${window.location.origin}/golf/bookings/${reference}` },
            redirect: 'if_required',
        });
        if (failed) {
            setError(failed.message || t('payFailed'));
            setBusy(false);
            return;
        }
        // Authorised, or still processing: the booking page asks Stripe which, and says.
        router.replace(`/golf/bookings/${reference}`);
    };

    return (
        <div className="space-y-4">
            <PaymentElement options={{ layout: 'accordion' }} />
            {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <button type="button" onClick={() => void pay()} disabled={!stripe || !elements || busy} className={PRIMARY}>
                {busy ? t('paying') : t('payButton', { amount })}
            </button>
        </div>
    );
}

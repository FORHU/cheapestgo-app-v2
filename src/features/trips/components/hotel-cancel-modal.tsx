'use client';

/**
 * Cancelling a hotel booking, with the money said first.
 *
 * The only thing a traveller is deciding on here is what they get back, and the page used to ask
 * "Are you sure?" without saying. This shows the figure — from the terms recorded when they
 * booked, judged by the same engine that will decide the cancellation — and the moment the next,
 * worse terms begin. Nothing is cancelled by opening it.
 *
 * Confirming re-reads the figure first (see `confirmCancellation`). If what they would receive
 * has moved while the dialog was open, nothing is cancelled and they are shown the new amount.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { http } from '@/shared/lib/http';
import {
    cancelHotelBooking,
    confirmCancellation,
    fetchCancelPreview,
    type CancelHttp,
    type CancelPreview,
    type CancelResult,
} from '../lib/hotel-cancel';

type Stage = 'loading' | 'ready' | 'changed' | 'working' | 'done' | 'load_error' | 'cancel_error';

function money(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString()}`;
    }
}

function longDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function HotelCancelModal({
    reference, propertyName, client, onClose, onDone,
}: {
    reference:     string;
    propertyName?: string;
    client?:       CancelHttp;
    onClose:       () => void;
    onDone:        (result: CancelResult) => void;
}) {
    const t = useTranslations('trips.hotelCancel');
    const tLoad = useTranslations('trips.loadFailed');
    const api = client ?? (http as unknown as CancelHttp);

    const [stage, setStage] = useState<Stage>('loading');
    /** The figure the traveller is looking at — and the one a confirmation is checked against. */
    const [preview, setPreview] = useState<CancelPreview | null>(null);
    const [result, setResult] = useState<CancelResult | null>(null);
    /** The server's own words when the hotel refused or did not answer; otherwise the generic one. */
    const [cancelError, setCancelError] = useState<string | null>(null);

    // Set before anything is awaited: two clicks in one tick must reach the network once.
    const inFlight = useRef(false);

    const load = useCallback(async () => {
        setStage('loading');
        try {
            const p = await fetchCancelPreview(api, reference);
            setPreview(p);
            setStage('ready');
        } catch {
            setStage('load_error');
        }
    }, [api, reference]);

    useEffect(() => { void load(); }, [load]);

    const busy = stage === 'working';
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [busy, onClose]);

    const confirm = async () => {
        if (inFlight.current || !preview) return;
        inFlight.current = true;
        setStage('working');
        try {
            // A booking whose cancellation already happened and only the refund failed has nothing
            // to re-compare: the cancel endpoint skips the supplier and retries the money.
            const outcome = preview.reason === 'refund_retry'
                ? { kind: 'cancelled' as const, result: await cancelHotelBooking(api, reference) }
                : await confirmCancellation(api, reference, preview);

            if (outcome.kind === 'changed') {
                setPreview(outcome.preview);
                setStage('changed');
                return;
            }
            setResult(outcome.result);
            setStage('done');
            onDone(outcome.result);
        } catch (err) {
            // A refusal the hotel gave, or an answer it never gave, is explained by the server in
            // terms that matter (your booking is unchanged; nothing was refunded). Say those.
            const e = err as { code?: string; body?: { error?: string; message?: string } };
            const code = e?.body?.error ?? e?.code;
            setCancelError(
                (code === 'CANCEL_REFUSED' || code === 'CANCEL_UNCONFIRMED') && e?.body?.message
                    ? e.body.message
                    : null,
            );
            setStage('cancel_error');
        } finally {
            inFlight.current = false;
        }
    };

    const refundType = preview?.refund.type;
    const confirmLabel = !preview ? t('confirm')
        : refundType === 'no_refund' ? t('confirmNoRefund')
        : t('confirmRefund', { amount: money(preview.refund.amount, preview.refund.currency) });

    const doneKey = result?.refundFailed ? 'doneRefundFailed'
        : result?.refunded ? 'doneRefunded'
        : 'doneNoRefund';

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="hotel-cancel-title"
                className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            >
                <h2 id="hotel-cancel-title" className="text-lg font-bold text-slate-900 dark:text-white">
                    {t('title')}
                </h2>
                {propertyName && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{propertyName}</p>}

                {stage === 'loading' && (
                    <p role="status" className="mt-5 text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> {t('loading')}
                    </p>
                )}

                {stage === 'load_error' && (
                    <div className="mt-5">
                        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('loadError')}</p>
                        <div className="mt-4 flex gap-2">
                            <button type="button" onClick={() => void load()} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold">
                                {tLoad('retry')}
                            </button>
                            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold">
                                {t('close')}
                            </button>
                        </div>
                    </div>
                )}

                {preview && (stage === 'ready' || stage === 'changed' || stage === 'working' || stage === 'cancel_error') && (
                    <div className="mt-5">
                        {stage === 'changed' && (
                            <div role="alert" className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                                <p className="font-semibold">{t('changedTitle')}</p>
                                <p className="mt-1">{t('changedBody')}</p>
                            </div>
                        )}

                        {!preview.cancellable ? (
                            <>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                    {preview.reason === 'already_cancelled' ? t('alreadyCancelled') : t('notCancellable')}
                                </p>
                                <div className="mt-5">
                                    <button type="button" onClick={onClose} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold">
                                        {t('close')}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {preview.reason === 'refund_retry' && (
                                    <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">{t('refundRetry')}</p>
                                )}

                                <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500">{t('paid')}</dt>
                                        <dd className="font-medium text-slate-900 dark:text-white">{money(preview.paid.amount, preview.paid.currency)}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500">{t('penalty')}</dt>
                                        <dd className="font-medium text-slate-900 dark:text-white">{money(preview.penalty.amount, preview.penalty.currency)}</dd>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                                        <dt className="font-semibold text-slate-900 dark:text-white">{t('refund')}</dt>
                                        <dd className="font-bold text-slate-900 dark:text-white">{money(preview.refund.amount, preview.refund.currency)}</dd>
                                    </div>
                                </dl>

                                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                                    {refundType === 'full_refund' ? t('fullRefund')
                                        : refundType === 'partial_refund' ? t('partialRefund')
                                        : t('noRefund')}
                                </p>

                                {preview.deadline && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        {refundType === 'full_refund'
                                            ? t('freeUntil', { date: longDate(preview.deadline) })
                                            : t('feeRisesOn', { date: longDate(preview.deadline) })}
                                    </p>
                                )}

                                {stage === 'cancel_error' && (
                                    <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{cancelError ?? t('failed')}</p>
                                )}

                                <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2">
                                    <button type="button" onClick={onClose} disabled={busy}
                                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold disabled:opacity-50">
                                        {t('keep')}
                                    </button>
                                    <button type="button" onClick={() => void confirm()} disabled={busy}
                                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                                        {busy ? <><Loader2 size={14} className="animate-spin" /> {t('working')}</> : confirmLabel}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {stage === 'done' && result && (
                    <div className="mt-5">
                        <p role="status" className="text-sm text-slate-700 dark:text-slate-300">{t(doneKey)}</p>
                        <div className="mt-5">
                            <button type="button" onClick={onClose} className="w-full px-4 py-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold">
                                {t('close')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

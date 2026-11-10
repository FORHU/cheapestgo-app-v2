'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import {
    adminCancellationsApi,
    type FlightCancelQuote,
    type HotelCancelPreview,
} from '@/features/admin/api/cancellations.api';
import type { Booking } from '@/shared/types';

/**
 * Cancelling a booking for a customer.
 *
 * The flow is deliberately two steps — find out what it returns, then do it. Support is about to
 * tell a customer a number, and a button that cancels and reports the figure afterwards gives
 * them nothing to say beforehand.
 *
 * What the traveller's own cancel button does, this does. One path, one policy, one record
 * (ADR-0004 in api-v2); the only differences are that it is recorded against the agent, and that
 * the agent can deliberately return more than the terms allow.
 */

const money = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CancelBookingDialog({
    booking, onClose, onDone,
}: {
    booking: Booking;
    onClose: () => void;
    onDone: () => void;
}) {
    const isHotel = booking.type === 'hotel';
    const reference = booking.reference ?? booking.id;

    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<HotelCancelPreview | null>(null);
    const [quote, setQuote] = useState<FlightCancelQuote | null>(null);
    const [refundInFull, setRefundInFull] = useState(false);
    const [reason, setReason] = useState('');
    const [done, setDone] = useState<string | null>(null);

    // What cancelling returns, asked before anything is cancelled. For a flight this is a live
    // call to the airline, so it is not free and not repeated on every render.
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                if (isHotel) {
                    const res = await adminCancellationsApi.hotelPreview(reference);
                    if (alive) setPreview(res.data);
                } else {
                    const res = await adminCancellationsApi.flightQuote(booking.id);
                    if (alive) setQuote(res);
                }
            } catch (err) {
                if (alive) setError(err instanceof Error ? err.message : 'Could not work out what this returns.');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [booking.id, isHotel, reference]);

    async function cancel() {
        setWorking(true);
        setError(null);
        try {
            const result = isHotel
                ? await adminCancellationsApi.cancelHotel(reference, { refundInFull, reason: reason.trim() || undefined })
                : await adminCancellationsApi.cancelFlight(booking.id, {
                    cancellationId: quote?.cancellationId, reason: reason.trim() || undefined,
                });
            setDone(result.data?.message ?? result.status ?? 'Cancelled.');
            onDone();
        } catch (err) {
            // The message is the service's own, and it is written for a person: a supplier that
            // refused says so, and says that nothing was refunded.
            setError(err instanceof Error ? err.message : 'The cancellation did not go through.');
        } finally {
            setWorking(false);
        }
    }

    const policyRefund = preview?.refundAmount ?? quote?.refundAmount ?? 0;
    const currency = preview?.currency ?? quote?.refundCurrency ?? booking.currency;
    const willRefund = isHotel && refundInFull ? booking.totalAmount : policyRefund;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Cancel booking">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Cancel booking</h2>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">{reference}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4 text-[13px]">
                    {loading && (
                        <p className="flex items-center gap-2 text-slate-500">
                            <Loader2 size={14} className="animate-spin" aria-hidden />
                            Checking what this returns…
                        </p>
                    )}

                    {!loading && done && (
                        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{done}</p>
                    )}

                    {!loading && !done && (
                        <>
                            {isHotel && preview && (
                                <dl className="space-y-1.5">
                                    <Row label="Refund under the recorded terms" value={money(preview.refundAmount, preview.currency)} />
                                    {preview.penaltyAmount > 0 && (
                                        <Row label="Penalty kept by the hotel" value={money(preview.penaltyAmount, preview.currency)} />
                                    )}
                                    <p className="pt-1 text-xs text-slate-500">{preview.message}</p>
                                </dl>
                            )}

                            {!isHotel && quote && (
                                quote.noQuote
                                    ? <p className="text-slate-600">The airline would not price this cancellation. Cancelling here will still release or refund the payment as far as it can.</p>
                                    : <dl className="space-y-1.5">
                                        <Row label="Airline returns" value={money(quote.refundAmount ?? 0, quote.refundCurrency ?? booking.currency)} />
                                        {(quote.penaltyAmount ?? 0) > 0 && (
                                            <Row label="Airline keeps" value={money(quote.penaltyAmount ?? 0, quote.refundCurrency ?? booking.currency)} />
                                        )}
                                    </dl>
                            )}

                            {/* The override. Hotels only: a flight refund is whatever the airline
                                gave back, so there is no local policy here to override. */}
                            {isHotel && (
                                <label className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2">
                                    <input
                                        id="refund-in-full"
                                        type="checkbox"
                                        checked={refundInFull}
                                        onChange={(e) => setRefundInFull(e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <span className="text-xs text-amber-900">
                                        <strong>Refund the whole charge anyway.</strong> The hotel still bills us for a
                                        non-refundable room, so this is a loss we are choosing to take. It is recorded
                                        against your account.
                                    </span>
                                </label>
                            )}

                            <div>
                                <label htmlFor="cancel-reason" className="mb-1 block text-xs font-semibold text-slate-600">
                                    Reason {refundInFull && <span className="text-amber-700">(required for an override)</span>}
                                </label>
                                <input
                                    id="cancel-reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Why this is being cancelled"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                                />
                            </div>

                            <p className="flex gap-2 text-xs text-slate-500">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                                The supplier is asked first. If they refuse, nothing is refunded and the booking is
                                left exactly as it is.
                            </p>
                        </>
                    )}

                    {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{error}</p>}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
                    <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[13px] text-slate-600 hover:bg-slate-100">
                        {done ? 'Close' : 'Keep booking'}
                    </button>
                    {!done && (
                        <button
                            onClick={cancel}
                            disabled={loading || working || (refundInFull && !reason.trim())}
                            className="rounded-lg bg-rose-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                            {working
                                ? 'Cancelling…'
                                : `Cancel and refund ${money(willRefund, currency)}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
        </div>
    );
}

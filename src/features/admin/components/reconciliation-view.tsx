'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import {
    adminReconciliationApi,
    type RebuildDraft, type RebuildFields, type RebuildProvenance, type RebuildStatus,
    type ReconciliationReport, type UnrecordedReservation,
} from '@/features/admin/api/reconciliation.api';

/**
 * Money Stripe took with no booking behind it — ADR-0026's Unrecorded Reservations — and the
 * hotel bookings whose brand was never written.
 *
 * Two rules this screen keeps from the ADR. There is no dismiss button: an item leaves only when
 * its booking exists, because a "resolved" flag is a third record that can disagree with the two
 * it summarises. And nothing is repaired automatically: a hotel item has a rebuild form, pre-filled,
 * that a person checks against the supplier before submitting. Flights and golf are listed with
 * where to look, and repaired by hand.
 */

// Stripe's zero-decimal currencies: their amounts carry no minor unit.
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);

export const stripeMoney = (amount: number, currency: string) => {
    const major = ZERO_DECIMAL.has(currency.toLowerCase()) ? amount : amount / 100;
    return `${major.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
};

const when = (iso: string | null) => (iso ? iso.replace('T', ' ').slice(0, 16) + 'Z' : '—');

const WINDOWS = [7, 30, 90] as const;

function whereToLook(item: UnrecordedReservation): string {
    if (item.product === 'flight') {
        return `Check the order in Duffel${item.lookup.bookingSessionId ? ` (checkout session ${item.lookup.bookingSessionId})` : ''}, then record it by hand.`;
    }
    if (item.product === 'golf') {
        return `Check golf booking ${item.lookup.golfBookingId ?? '(no id on the charge)'}, then record it by hand.`;
    }
    return '';
}

export function ReconciliationView() {
    const [windowDays, setWindowDays] = useState<number>(30);
    const [report, setReport] = useState<ReconciliationReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [rebuilding, setRebuilding] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setReport(null);
        setError(null);
        try {
            setReport(await adminReconciliationApi.report(windowDays));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not run the reconciliation.');
        }
    }, [windowDays]);

    useEffect(() => { void load(); }, [load]);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-50">Reconciliation</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Payments Stripe captured with no booking behind them. Worked out fresh on every visit:
                    an item disappears once its booking exists, and there is nothing to dismiss.
                </p>
            </header>

            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Look back</span>
                {WINDOWS.map((d) => (
                    <Button key={d} size="sm" variant={d === windowDays ? 'default' : 'outline'} onClick={() => setWindowDays(d)}>
                        {d} days
                    </Button>
                ))}
            </div>

            {notice && (
                <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <CheckCircle2 size={15} aria-hidden /> {notice}
                </p>
            )}
            {error && (
                <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
            )}

            {!report && !error ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
            ) : report && !report.ok ? (
                // "Cannot tell" is not "nothing wrong", so a refusal is never shown as an empty list.
                <p role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0" />
                    <span><strong>Not checked.</strong> {report.refusedReason}</span>
                </p>
            ) : report ? (
                <>
                    {report.warnings.map((w) => (
                        <p key={w} role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            <strong>Not checked:</strong> {w}
                        </p>
                    ))}

                    <section className="flex flex-col gap-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Paid, no booking <span className="font-normal text-slate-400">
                                ({report.unrecorded.length} of {report.scanned} payments in {report.windowDays} days)
                            </span>
                        </h2>
                        {report.unrecorded.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Every captured payment in this window has its booking.
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full min-w-[760px] text-left text-sm">
                                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                        <tr>
                                            <th className="px-3 py-2 font-semibold">Reference</th>
                                            <th className="px-3 py-2 font-semibold">Product</th>
                                            <th className="px-3 py-2 font-semibold">Customer</th>
                                            <th className="px-3 py-2 text-right font-semibold">Charged</th>
                                            <th className="px-3 py-2 font-semibold">Paid</th>
                                            <th className="px-3 py-2 font-semibold">What we know</th>
                                            <th className="px-3 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.unrecorded.map((u) => (
                                            <tr key={u.paymentIntentId} className="border-t border-slate-100 align-top dark:border-slate-800">
                                                <td className="px-3 py-2">
                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                                        {u.hasReference ? u.bookingReference : <span className="text-slate-400">no reference</span>}
                                                    </div>
                                                    <div className="font-mono text-[11px] text-slate-400">{u.paymentIntentId}</div>
                                                </td>
                                                <td className="px-3 py-2 capitalize">{u.product}</td>
                                                <td className="px-3 py-2">
                                                    <div>{u.holderEmail ?? '—'}</div>
                                                    <div className="text-[11px] text-slate-400">{u.brand ?? 'brand unknown'}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                                    {stripeMoney(u.amount, u.currency)}
                                                    {u.refunded && (
                                                        <div><Badge className="mt-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">refunded</Badge></div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-[12px] text-slate-500">{when(u.created)}</td>
                                                <td className="px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300">
                                                    {u.product === 'hotel' ? (
                                                        u.attempt ? (
                                                            <>
                                                                Attempt <strong>{u.attempt.status}</strong>
                                                                {u.attempt.supplierReference && <> · supplier ref {u.attempt.supplierReference}</>}
                                                                {u.attempt.checkIn && <div className="text-slate-400">{u.attempt.propertyName ?? ''} {u.attempt.checkIn} → {u.attempt.checkOut}</div>}
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-400">{u.description ?? 'No attempt row; only Stripe holds this.'}</span>
                                                        )
                                                    ) : (
                                                        <span>{whereToLook(u)}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {u.product === 'hotel' && u.hasReference && (
                                                        <Button size="sm" variant="outline" onClick={() => { setNotice(null); setRebuilding(u.paymentIntentId); }}>
                                                            <Wrench size={13} aria-hidden /> Rebuild
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="flex flex-col gap-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Hotel bookings with no brand <span className="font-normal text-slate-400">({report.missingBrand.total})</span>
                        </h2>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400">
                            The brand write after a booking is allowed to fail so the stay is never lost; these are the
                            bookings where it did. The authority is the charge&apos;s own brand, so nothing here is filled in by guess.
                        </p>
                        {report.missingBrand.items.length === 0 ? (
                            <p className="text-[13px] text-slate-400">None.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-[13px] dark:divide-slate-800 dark:border-slate-800">
                                {report.missingBrand.items.map((b) => (
                                    <li key={b.bookingReference} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                                        <span className="font-medium">{b.bookingReference}</span>
                                        <span className="font-mono text-[11px] text-slate-400">{b.paymentIntentId ?? 'no payment'}</span>
                                        <span className="text-slate-500">{b.status ?? '—'}</span>
                                        <span className="text-[12px] text-slate-400">{when(b.createdAt)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            ) : null}

            {rebuilding && (
                <RebuildPanel
                    paymentIntentId={rebuilding}
                    onClose={() => setRebuilding(null)}
                    onDone={(ref) => { setRebuilding(null); setNotice(`Booking ${ref} recorded.`); void load(); }}
                />
            )}
        </div>
    );
}

const SOURCE: Record<RebuildProvenance, { label: string; tone: string }> = {
    attempt: { label: 'from the attempt', tone: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
    stripe:  { label: 'from Stripe',      tone: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
    missing: { label: 'not recorded — fill in', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
};

const FIELDS: Array<{ key: keyof RebuildFields; label: string; type?: string }> = [
    { key: 'propertyName',      label: 'Property' },
    { key: 'roomName',          label: 'Room' },
    { key: 'checkIn',           label: 'Check-in', type: 'date' },
    { key: 'checkOut',          label: 'Check-out', type: 'date' },
    { key: 'adults',            label: 'Adults', type: 'number' },
    { key: 'children',          label: 'Children', type: 'number' },
    { key: 'holderFirstName',   label: 'Holder first name' },
    { key: 'holderLastName',    label: 'Holder last name' },
    { key: 'holderEmail',       label: 'Holder email', type: 'email' },
    { key: 'supplierReference', label: 'Supplier reference' },
];

/** The pre-filled form. Money, customer and reference are shown, never editable: they are the charge's. */
function RebuildPanel({ paymentIntentId, onClose, onDone }: {
    paymentIntentId: string; onClose: () => void; onDone: (reference: string) => void;
}) {
    const [draft, setDraft] = useState<RebuildDraft | null>(null);
    const [fields, setFields] = useState<RebuildFields | null>(null);
    const [status, setStatus] = useState<RebuildStatus>('confirmed');
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        adminReconciliationApi.draft(paymentIntentId)
            .then(({ draft: d }) => {
                if (cancelled) return;
                setDraft(d); setFields(d.fields); setStatus(d.suggestedStatus);
            })
            .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not prepare the rebuild.'); });
        return () => { cancelled = true; };
    }, [paymentIntentId]);

    const set = (key: keyof RebuildFields, value: string) =>
        setFields((f) => (f ? { ...f, [key]: key === 'adults' || key === 'children' ? Number(value) : value } : f));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fields || !draft) return;
        setSaving(true);
        setError(null);
        try {
            await adminReconciliationApi.rebuild(paymentIntentId, { ...fields, status, reason: reason.trim() });
            onDone(draft.bookingReference);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not record the booking.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
            <aside
                role="dialog"
                aria-label={`Rebuild booking for ${paymentIntentId}`}
                onClick={(e) => e.stopPropagation()}
                className="flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto bg-white p-5 dark:bg-slate-950"
            >
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Rebuild booking</h2>
                        <p className="font-mono text-[11px] text-slate-400">{paymentIntentId}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
                </header>

                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

                {!draft || !fields ? (
                    !error && <div className="flex flex-col gap-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                    <form onSubmit={submit} className="flex flex-col gap-4">
                        <div className="rounded-lg bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            <strong>Check the supplier first.</strong> This writes the booking the guest paid for. Confirm the
                            stay in the supplier&apos;s dashboard and correct anything that differs before you submit.
                            {!draft.hasCancellationTerms && (
                                <div className="mt-1.5">• No cancellation terms were recorded, so this booking will be non-refundable
                                    and a cancellation will go to support.</div>
                            )}
                        </div>

                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                            <dt className="text-slate-500">Reference</dt><dd className="font-medium">{draft.bookingReference}</dd>
                            <dt className="text-slate-500">Charged</dt><dd className="font-mono">{draft.amount} {draft.currency}</dd>
                            <dt className="text-slate-500">Paid</dt><dd>{when(draft.paidAt)}</dd>
                            {Number(draft.amountRefunded) > 0 && (<><dt className="text-slate-500">Refunded</dt><dd className="font-mono">{draft.amountRefunded} {draft.currency}</dd></>)}
                            <dt className="text-slate-500">Attempt</dt><dd>{draft.attempt?.status ?? 'none recorded'}</dd>
                        </dl>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {FIELDS.map(({ key, label, type }) => (
                                <label key={key} className="flex flex-col gap-1 text-[13px]">
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="text-slate-600 dark:text-slate-300">{label}</span>
                                        <Badge className={cn('text-[10px]', SOURCE[draft.provenance[key]].tone)}>
                                            {SOURCE[draft.provenance[key]].label}
                                        </Badge>
                                    </span>
                                    <input
                                        type={type ?? 'text'}
                                        value={String(fields[key] ?? '')}
                                        min={type === 'number' ? (key === 'adults' ? 1 : 0) : undefined}
                                        required={key !== 'supplierReference'}
                                        onChange={(e) => set(key, e.target.value)}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                                    />
                                </label>
                            ))}
                        </div>

                        <label className="flex flex-col gap-1 text-[13px]">
                            <span className="text-slate-600 dark:text-slate-300">Record it as</span>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as RebuildStatus)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                            >
                                <option value="confirmed">Confirmed — the guest holds the stay</option>
                                <option value="refunded">Refunded — cancelled and the money returned</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-1 text-[13px]">
                            <span className="text-slate-600 dark:text-slate-300">Why (kept in the audit log and on the booking)</span>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                minLength={10}
                                required
                                rows={3}
                                placeholder="e.g. Supplier dashboard shows the stay confirmed under ref 31489968."
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                            />
                        </label>

                        <Button type="submit" disabled={saving}>{saving ? 'Recording…' : 'Record booking'}</Button>
                    </form>
                )}
            </aside>
        </div>
    );
}

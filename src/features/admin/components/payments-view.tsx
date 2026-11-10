'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, Search } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import {
    adminPaymentsApi,
    type EvidencePack, type PaymentListItem, type Provenance,
} from '@/features/admin/api/payments.api';

/**
 * The payment back office: search money the way a customer talks about it, then look at one
 * payment in full.
 *
 * Two things this screen does deliberately, both from ADR-0003 in api-v2:
 *
 * It shows a payment twice when two internal records claim it, marked, rather than collapsing
 * them — a double-written booking has no other way of announcing itself.
 *
 * It labels every fact with how it is known, and asserts nothing about delivery. A captured
 * payment is evidence that money moved, never that a stay was honoured.
 */

const PROVENANCE: Record<Provenance, { label: string; tone: string }> = {
    verified:          { label: 'Verified now',       tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
    provider_recorded: { label: 'Provider, at the time', tone: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
    internal:          { label: 'Our own record',     tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    unavailable:       { label: 'Not available',      tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
};

const money = (amount: string | null, currency: string | null) =>
    amount === null ? '—' : `${amount}${currency ? ` ${currency}` : ''}`;

const when = (iso: string) => iso.replace('T', ' ').slice(0, 16) + 'Z';

export function PaymentsView() {
    const [items, setItems] = useState<PaymentListItem[] | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState<string | null>(null);

    const load = useCallback(async () => {
        setItems(null);
        setError(null);
        try {
            const res = await adminPaymentsApi.list({ search: applied || undefined, page });
            setItems(res.items);
            setTotal(res.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load payments.');
            setItems([]);
        }
    }, [applied, page]);

    useEffect(() => { void load(); }, [load]);

    const pages = Math.max(1, Math.ceil(total / 25));

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-50">Payments</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Every payment we hold a record of, across stays, flights and checkouts that never
                    became a booking.
                </p>
            </header>

            <form
                className="flex gap-2"
                onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(search.trim()); }}
            >
                <div className="relative flex-1">
                    <Search size={15} aria-hidden className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Booking reference, payment intent, supplier reference or email"
                        aria-label="Search payments"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm dark:border-slate-700 dark:bg-slate-900"
                    />
                </div>
                <Button type="submit">Search</Button>
            </form>

            {error && (
                <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    {error}
                </p>
            )}

            {items === null ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
            ) : items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {applied ? `Nothing matches “${applied}”.` : 'No payments recorded yet.'}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <tr>
                                <th className="px-3 py-2 font-semibold">Reference</th>
                                <th className="px-3 py-2 font-semibold">Customer</th>
                                <th className="px-3 py-2 font-semibold">Product</th>
                                <th className="px-3 py-2 font-semibold">Our status</th>
                                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                                <th className="px-3 py-2 font-semibold">Taken</th>
                                <th className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((p) => (
                                <tr key={p.paymentIntentId} className="border-t border-slate-100 dark:border-slate-800">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-slate-900 dark:text-slate-100">
                                            {p.bookingReference ?? <span className="text-amber-700 dark:text-amber-300">no booking</span>}
                                        </div>
                                        <div className="font-mono text-[11px] text-slate-400">{p.paymentIntentId}</div>
                                        {/* Only a real disagreement is a warning. A stay held in two tables is
                                            how the system works, and shows as the quiet list of records below. */}
                                        {p.anomaly && (
                                            <Badge className="mt-1 gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                                <AlertTriangle size={11} aria-hidden />
                                                {p.anomaly === 'multiple_references'
                                                    ? 'more than one booking on this payment'
                                                    : 'recorded twice in the same table'}
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div>{p.customerName ?? '—'}</div>
                                        <div className="text-[11px] text-slate-400">{p.customerEmail ?? ''}</div>
                                    </td>
                                    <td className="px-3 py-2 capitalize">{p.product}</td>
                                    {/* Labelled "our status" on purpose: it is what we recorded, not what the
                                        supplier did. The detail panel spells that out.

                                        One line per record, named by the table it came from. A hotel booking
                                        has two — the attempt and the sale — and seeing both is how a reader
                                        tells "cancelled everywhere" from "cancelled in one place only". */}
                                    <td className="px-3 py-2">
                                        {p.records.length === 0 ? '—' : (
                                            <div className="space-y-0.5">
                                                {p.records.map((r) => (
                                                    <div key={r.internalId} className="whitespace-nowrap">
                                                        {r.bookingStatus ?? '—'}
                                                        <span className="ml-1.5 text-[11px] text-slate-400">{r.source}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums">{money(p.amount, p.currency)}</td>
                                    <td className="px-3 py-2 text-[12px] text-slate-500">{when(p.createdAt)}</td>
                                    <td className="px-3 py-2 text-right">
                                        <Button variant="outline" size="sm" onClick={() => setOpen(p.paymentIntentId)}>
                                            Evidence
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pages > 1 && (
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{total} payments</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                            <ChevronLeft size={15} aria-hidden /> Previous
                        </Button>
                        <span className="tabular-nums">{page} / {pages}</span>
                        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                            Next <ChevronRight size={15} aria-hidden />
                        </Button>
                    </div>
                </div>
            )}

            {open && <EvidencePanel paymentIntentId={open} onClose={() => setOpen(null)} />}
        </div>
    );
}

/** One payment in full: every fact, how it is known, and what happened in order. */
function EvidencePanel({ paymentIntentId, onClose }: { paymentIntentId: string; onClose: () => void }) {
    const [pack, setPack] = useState<EvidencePack | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        adminPaymentsApi.evidence(paymentIntentId)
            .then(p => { if (!cancelled) setPack(p); })
            .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not gather evidence.'); });
        return () => { cancelled = true; };
    }, [paymentIntentId]);

    const exportPdf = async () => {
        setExporting(true);
        try {
            const { url } = await adminPaymentsApi.exportPdf(paymentIntentId);
            window.open(url, '_blank', 'noopener');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not export the pack.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
            <aside
                role="dialog"
                aria-label={`Evidence for ${paymentIntentId}`}
                onClick={(e) => e.stopPropagation()}
                className="flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto bg-white p-5 dark:bg-slate-950"
            >
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Payment evidence</h2>
                        <p className="font-mono text-[11px] text-slate-400">{paymentIntentId}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={exportPdf} disabled={!pack || exporting}>
                            {exporting ? 'Preparing…' : <><Download size={14} aria-hidden /> PDF</>}
                        </Button>
                        <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
                    </div>
                </header>

                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

                {!pack ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : (
                    <>
                        {/* Printed before the facts, not after. A reader who does not find a delivery
                            claim is entitled to know the omission is deliberate. */}
                        <div className="rounded-lg bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            <strong>This does not say a service was delivered.</strong> A captured payment is
                            evidence that money moved, not that a stay was honoured or a passenger travelled.
                            {pack.limitations.map((l, i) => <div key={i} className="mt-1.5">• {l}</div>)}
                        </div>

                        <section>
                            <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">Facts, and how each is known</h3>
                            <ul className="flex flex-col gap-1.5">
                                {pack.items.map(item => (
                                    <li key={item.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 pb-1.5 dark:border-slate-800">
                                        <span className="text-[13px] text-slate-500 dark:text-slate-400">{item.label}</span>
                                        <span className={cn('text-[13px] font-medium', item.value === null && 'text-slate-400 italic')}>
                                            {item.value ?? 'not available'}
                                        </span>
                                        <Badge className={cn('text-[10px]', PROVENANCE[item.provenance].tone)}>
                                            {PROVENANCE[item.provenance].label}
                                        </Badge>
                                        {item.note && <p className="w-full text-[11px] text-slate-400">{item.note}</p>}
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section>
                            <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                                What happened, in order <span className="font-normal text-slate-400">(UTC)</span>
                            </h3>
                            {pack.timeline.length === 0 ? (
                                <p className="text-[13px] text-slate-400">No events recorded against this payment.</p>
                            ) : (
                                <ol className="flex flex-col gap-1">
                                    {pack.timeline.map((e, i) => (
                                        <li key={i} className="flex gap-3 text-[12px]">
                                            <span className="w-32 shrink-0 tabular-nums text-slate-400">{when(e.at)}</span>
                                            <span className="w-16 shrink-0 text-slate-400">{e.source}</span>
                                            <span className="text-slate-700 dark:text-slate-300">{e.label}</span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>

                        {pack.sources.length === 0 && (
                            <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-[12px] text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                                <FileText size={14} aria-hidden className="mt-0.5 shrink-0" />
                                No internal record references this payment. If Stripe shows it as succeeded, this is
                                money taken for a booking that was never written down.
                            </p>
                        )}
                    </>
                )}
            </aside>
        </div>
    );
}

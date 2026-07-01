'use client';

import { useEffect, useState } from 'react';
import {
    CreditCard, TrendingUp, RefreshCw, AlertTriangle, ExternalLink,
    Banknote, Clock, CheckCircle2, Shield, Zap,
} from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface BalanceEntry { amount: number; currency: string; }

interface StripePayment {
    id:          string;
    amount:      number;
    currency:    string;
    status:      string;
    description: string | null;
    customer:    string | null;
    created:     number;
    refunded:    boolean;
    metadata:    Record<string, string>;
}

interface StripeRefund {
    id:       string;
    amount:   number;
    currency: string;
    status:   string;
    reason:   string | null;
    created:  number;
}

interface StripeDispute {
    id:       string;
    amount:   number;
    currency: string;
    status:   string;
    reason:   string;
    created:  number;
}

interface StripePayout {
    id:          string;
    amount:      number;
    currency:    string;
    status:      string;
    arrivalDate: number;
    created:     number;
}

interface StripeData {
    isLive:   boolean;
    balance: {
        available: BalanceEntry[];
        pending:   BalanceEntry[];
    };
    stats: {
        totalPayments:  number;
        succeeded:      number;
        totalVolume:    number;
        totalRefunded:  number;
        openDisputes:   number;
    };
    payments:  StripePayment[];
    refunds:   StripeRefund[];
    disputes:  StripeDispute[];
    payouts:   StripePayout[];
}

const TABS = ['Payments', 'Refunds', 'Disputes', 'Payouts'] as const;
type Tab = typeof TABS[number];

const DASHBOARD = 'https://dashboard.stripe.com';

const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function piStatusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
    if (status === 'succeeded')  return 'success';
    if (status === 'processing') return 'warning';
    if (status === 'canceled')   return 'destructive';
    return 'secondary';
}

function SkeletonCards() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-20" />
                </div>
            ))}
        </div>
    );
}

export default function AdminStripePage() {
    const [data, setData]   = useState<StripeData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab]     = useState<Tab>('Payments');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function load() {
        try {
            const res = await http.get<StripeData>('/admin/stripe');
            setData(res);
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load Stripe data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => { load(); }, []);

    function handleRefresh() {
        setRefreshing(true);
        load();
    }

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Stripe</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Payment events and balance monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                    {data && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${data.isLive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                            <Zap size={11} />
                            {data.isLive ? 'Live' : 'Test'}
                        </span>
                    )}
                    <a href={DASHBOARD} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                        Dashboard <ExternalLink size={11} />
                    </a>
                    <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={refreshing}>
                        <RefreshCw size={13} />
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                    <AlertTriangle size={15} /> {error}
                </div>
            )}

            {loading && !data && <SkeletonCards />}

            {data && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatsCard label="Total Volume"    value={fmt(data.stats.totalVolume, data.balance.available[0]?.currency ?? 'USD')} />
                        <StatsCard label="Succeeded"       value={data.stats.succeeded.toLocaleString()} />
                        <StatsCard label="Total Refunded"  value={fmt(data.stats.totalRefunded, data.balance.available[0]?.currency ?? 'USD')} />
                        <StatsCard label="Open Disputes"   value={data.stats.openDisputes.toLocaleString()} />
                        <StatsCard label="Payments Shown"  value={data.stats.totalPayments.toLocaleString()} />
                    </div>

                    {/* Balance */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Banknote size={14} className="text-emerald-600" /></div>
                                <div><p className="text-sm font-bold text-slate-900">Available</p><p className="text-[11px] text-slate-400">Ready to pay out</p></div>
                            </div>
                            {data.balance.available.length === 0 ? <p className="text-sm text-slate-400 italic">No available balance</p>
                                : data.balance.available.map(b => (
                                    <div key={b.currency} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                        <span className="text-xs font-bold text-slate-500 uppercase">{b.currency}</span>
                                        <span className="text-lg font-bold text-emerald-600">{fmt(b.amount, b.currency)}</span>
                                    </div>
                                ))}
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><Clock size={14} className="text-amber-600" /></div>
                                <div><p className="text-sm font-bold text-slate-900">Pending</p><p className="text-[11px] text-slate-400">Settling in 2–7 days</p></div>
                            </div>
                            {data.balance.pending.length === 0 ? <p className="text-sm text-slate-400 italic">No pending balance</p>
                                : data.balance.pending.map(b => (
                                    <div key={b.currency} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                        <span className="text-xs font-bold text-slate-500 uppercase">{b.currency}</span>
                                        <span className="text-lg font-bold text-amber-600">{fmt(b.amount, b.currency)}</span>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
                            {TABS.map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}>
                                    {t}
                                    {t === 'Disputes' && data.stats.openDisputes > 0 && (
                                        <span className="ml-1 bg-rose-500 text-white rounded-full text-[9px] font-black px-1.5 py-0.5">{data.stats.openDisputes}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                            {/* Payments */}
                            {tab === 'Payments' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-slate-100 bg-slate-50/50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">ID</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {data.payments.length === 0 ? (
                                                <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-400">No payments</td></tr>
                                            ) : data.payments.map(p => (
                                                <tr key={p.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <a href={`${DASHBOARD}/payments/${p.id}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline">
                                                            {p.id.slice(0, 18)}… <ExternalLink size={10} />
                                                        </a>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-600">{p.customer ?? p.metadata?.passengerEmail ?? '—'}</td>
                                                    <td className="px-4 py-3 text-right font-bold">
                                                        <span className={p.refunded ? 'line-through text-slate-400' : 'text-slate-900'}>{fmt(p.amount, p.currency)}</span>
                                                        {p.refunded && <span className="ml-1 text-[10px] text-rose-500 font-bold">Refunded</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={piStatusVariant(p.status)} size="sm">{p.status.replace(/_/g, ' ')}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-xs text-slate-400">{fmtDate(p.created)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Refunds */}
                            {tab === 'Refunds' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-slate-100 bg-slate-50/50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">ID</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reason</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {data.refunds.length === 0 ? (
                                                <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-400">No refunds</td></tr>
                                            ) : data.refunds.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <a href={`${DASHBOARD}/refunds/${r.id}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline">
                                                            {r.id.slice(0, 18)}… <ExternalLink size={10} />
                                                        </a>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-rose-600">{fmt(r.amount, r.currency)}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={r.status === 'succeeded' ? 'success' : 'warning'} size="sm">{r.status}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{r.reason?.replace(/_/g, ' ') ?? '—'}</td>
                                                    <td className="px-4 py-3 text-right text-xs text-slate-400">{fmtDate(r.created)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Disputes */}
                            {tab === 'Disputes' && (
                                <>
                                    {data.stats.openDisputes > 0 && (
                                        <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border-b border-rose-200">
                                            <AlertTriangle size={15} className="text-rose-500 shrink-0" />
                                            <p className="text-xs font-bold text-rose-700">{data.stats.openDisputes} dispute{data.stats.openDisputes > 1 ? 's' : ''} require your response.</p>
                                            <a href={`${DASHBOARD}/disputes`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">
                                                Respond <ExternalLink size={10} />
                                            </a>
                                        </div>
                                    )}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                                <tr>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">ID</th>
                                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reason</th>
                                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {data.disputes.length === 0 ? (
                                                    <tr><td colSpan={5} className="p-12 text-center">
                                                        <Shield size={32} className="mx-auto text-slate-200 mb-2" strokeWidth={1} />
                                                        <p className="text-sm font-bold text-slate-900">No disputes — all clear</p>
                                                    </td></tr>
                                                ) : data.disputes.map(d => (
                                                    <tr key={d.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">
                                                            <a href={`${DASHBOARD}/disputes/${d.id}`} target="_blank" rel="noopener noreferrer"
                                                                className="flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline">
                                                                {d.id.slice(0, 18)}… <ExternalLink size={10} />
                                                            </a>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-rose-600">{fmt(d.amount, d.currency)}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant={d.status === 'won' ? 'success' : d.status === 'lost' ? 'destructive' : 'warning'} size="sm">
                                                                {d.status.replace(/_/g, ' ')}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-slate-500 capitalize">{d.reason.replace(/_/g, ' ')}</td>
                                                        <td className="px-4 py-3 text-right text-xs text-slate-400">{fmtDate(d.created)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {/* Payouts */}
                            {tab === 'Payouts' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-slate-100 bg-slate-50/50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">ID</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Arrival</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {data.payouts.length === 0 ? (
                                                <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-400">No payouts yet</td></tr>
                                            ) : data.payouts.map(p => (
                                                <tr key={p.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <a href={`${DASHBOARD}/payouts/${p.id}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline">
                                                            {p.id.slice(0, 18)}… <ExternalLink size={10} />
                                                        </a>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(p.amount, p.currency)}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={p.status === 'paid' ? 'success' : p.status === 'pending' ? 'warning' : 'destructive'} size="sm">{p.status}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(p.arrivalDate)}</td>
                                                    <td className="px-4 py-3 text-right text-xs text-slate-400">{fmtDate(p.created)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

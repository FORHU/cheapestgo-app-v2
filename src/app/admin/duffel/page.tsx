'use client';

import { useEffect, useState } from 'react';
import { Plane, CheckCircle2, XCircle, Clock, TrendingUp, CreditCard, ExternalLink, AlertTriangle } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface BalanceEntry { amount: number; currency: string; }

interface DuffelOrder {
    id:               string;
    bookingReference: string;
    passengerName:    string;
    origin:           string;
    destination:      string;
    status:           'confirmed' | 'cancelled' | 'awaiting_payment';
    totalAmount:      number;
    currency:         string;
    createdAt:        string;
}

interface DuffelData {
    status:           string;
    errorMessage?:    string;
    balance: {
        available: BalanceEntry[];
        pending:   BalanceEntry[];
    };
    stats: {
        totalOrders:   number;
        confirmed:     number;
        cancelled:     number;
        totalVolume:   number;
        currency:      string;
    };
    recentOrders:     DuffelOrder[];
}

const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

function orderStatusBadge(status: DuffelOrder['status']) {
    if (status === 'confirmed')         return <Badge variant="success">Confirmed</Badge>;
    if (status === 'cancelled')         return <Badge variant="destructive">Cancelled</Badge>;
    return <Badge variant="warning">Pending</Badge>;
}

function SkeletonCards() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-32" />
                </div>
            ))}
        </div>
    );
}

export default function AdminDuffelPage() {
    const [data, setData]     = useState<DuffelData | null>(null);
    const [error, setError]   = useState<string | null>(null);

    useEffect(() => {
        http.get<DuffelData>('/admin/duffel/balance')
            .then(setData)
            .catch(err => setError(err instanceof Error ? err.message : 'Failed to load Duffel data.'));
    }, []);

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Duffel</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Balance and flight order monitoring</p>
                </div>
                <a
                    href="https://app.duffel.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                >
                    Duffel Portal <ExternalLink size={12} />
                </a>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                    <AlertTriangle size={15} className="shrink-0" />
                    {error}
                </div>
            )}

            {!data && !error && <SkeletonCards />}

            {data && (
                <>
                    {/* Status banner */}
                    {data.status !== 'healthy' && data.errorMessage && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                            <AlertTriangle size={15} className="shrink-0" />
                            {data.errorMessage}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatsCard label="Total Orders"  value={data.stats.totalOrders.toLocaleString()} />
                        <StatsCard label="Confirmed"     value={data.stats.confirmed.toLocaleString()} />
                        <StatsCard label="Cancelled"     value={data.stats.cancelled.toLocaleString()} />
                        <StatsCard
                            label="Total Volume"
                            value={data.stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            prefix={data.stats.currency}
                        />
                    </div>

                    {/* Balance panels */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                    <TrendingUp size={14} className="text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Available Balance</p>
                                    <p className="text-[11px] text-slate-400">Ready to pay out</p>
                                </div>
                            </div>
                            {data.balance.available.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No available balance</p>
                            ) : data.balance.available.map(b => (
                                <div key={b.currency} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                    <span className="text-xs font-bold text-slate-500 uppercase">{b.currency}</span>
                                    <span className="text-lg font-bold text-emerald-600">{fmt(b.amount, b.currency)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                    <Clock size={14} className="text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Pending Balance</p>
                                    <p className="text-[11px] text-slate-400">Settling in 2–7 days</p>
                                </div>
                            </div>
                            {data.balance.pending.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No pending balance</p>
                            ) : data.balance.pending.map(b => (
                                <div key={b.currency} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                    <span className="text-xs font-bold text-slate-500 uppercase">{b.currency}</span>
                                    <span className="text-lg font-bold text-amber-600">{fmt(b.amount, b.currency)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent orders */}
                    <section>
                        <h2 className="text-sm font-bold text-slate-900 mb-4">Recent Orders</h2>
                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                            {data.recentOrders.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Plane size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                                    <p className="text-sm font-bold text-slate-900">No orders yet</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-slate-100 bg-slate-50/50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Ref</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Passenger</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Route</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {data.recentOrders.map(order => (
                                                <tr key={order.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold">{order.bookingReference}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-800">{order.passengerName}</td>
                                                    <td className="px-4 py-3 text-xs font-bold">{order.origin} → {order.destination}</td>
                                                    <td className="px-4 py-3">{orderStatusBadge(order.status)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(order.totalAmount, order.currency)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

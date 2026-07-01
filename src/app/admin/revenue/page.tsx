'use client';

import { useEffect, useState, useCallback } from 'react';
import { DollarSign, TrendingUp, Percent, Download, ChevronLeft, ChevronRight, Plane, Building2 } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';

interface RevenueBooking {
    id:                string;
    bookingRef:        string;
    type:              string;
    supplier:          string;
    customerName:      string;
    email:             string | null;
    totalAmount:       number;
    supplierCost:      number;
    markupAmount:      number;
    markupPercentage:  number;
    stripeFee:         number;
    netProfit:         number;
    currency:          string;
    createdAt:         string;
}

interface RevenueResponse {
    bookings:    RevenueBooking[];
    total:       number;
    page:        number;
    totalPages:  number;
    stats: {
        totalRevenue:    number;
        totalProfit:     number;
        totalMarkup:     number;
        totalStripeFees: number;
    };
    currency:    string;
}

const PAGE_SIZE = 20;

function fmt(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
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

export default function AdminRevenuePage() {
    const [data, setData]     = useState<RevenueResponse | null>(null);
    const [page, setPage]     = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);

    const totalPages = data ? Math.max(1, data.totalPages) : 1;
    const currency   = data?.currency ?? 'USD';

    const load = useCallback(async (p: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await http.get<RevenueResponse>(`/admin/revenue?page=${p}&pageSize=${PAGE_SIZE}`);
            setData(res);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load revenue data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page); }, [page, load]);

    function handleExport() {
        if (!data) return;
        const headers = ['Ref', 'Type', 'Supplier', 'Customer', 'Revenue', 'Cost', 'Markup', 'Markup%', 'Stripe Fees', 'Net Profit', 'Currency', 'Date'];
        const rows = data.bookings.map(b => [
            b.bookingRef, b.type, b.supplier, b.customerName,
            b.totalAmount, b.supplierCost, b.markupAmount, `${b.markupPercentage}%`,
            b.stripeFee, b.netProfit, b.currency,
            new Date(b.createdAt).toLocaleDateString(),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `revenue-${new Date().toISOString().split('T')[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Revenue</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Financial performance dashboard</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}>
                    <Download size={14} /> Export CSV
                </Button>
            </div>

            {!data && !error && <SkeletonCards />}

            {error && <div className="p-4 text-sm text-rose-500 bg-rose-50 border border-rose-200 rounded-xl">{error}</div>}

            {data?.stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard label="Total Revenue"  value={fmt(data.stats.totalRevenue, currency)} />
                    <StatsCard label="Net Profit"     value={fmt(data.stats.totalProfit, currency)} />
                    <StatsCard label="Stripe Fees"    value={fmt(data.stats.totalStripeFees, currency)} />
                    <StatsCard
                        label="Avg Markup %"
                        value={data.stats.totalRevenue > 0
                            ? `${((data.stats.totalMarkup / data.stats.totalRevenue) * 100).toFixed(1)}%`
                            : '—'}
                    />
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : !data || data.bookings.length === 0 ? (
                    <div className="p-12 text-center">
                        <DollarSign size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">No revenue records</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reference</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Revenue</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Markup</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Net Profit</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.bookings.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-blue-600 text-xs tracking-tight uppercase">{b.bookingRef}</span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {b.type === 'flight' ? <Plane size={10} className="text-slate-400" /> : <Building2 size={10} className="text-slate-400" />}
                                                    <span className="text-[10px] text-slate-400 uppercase">{b.supplier}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900 capitalize">{b.customerName.toLowerCase()}</span>
                                                {b.email && <span className="text-[10px] text-slate-400">{b.email}</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(b.totalAmount, b.currency)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="inline-flex items-center bg-violet-500/10 px-2 py-0.5 rounded-lg text-xs font-bold text-violet-600">{b.markupPercentage}%</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${b.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                                {fmt(b.netProfit, b.currency)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-slate-400">
                                            {new Date(b.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {!loading && !error && totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Page {page} of {totalPages} — {data?.total.toLocaleString()} records</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft size={14} />}>Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight size={14} />}>Next</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

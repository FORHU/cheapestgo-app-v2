'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, Trash2, Plane, ChevronLeft, ChevronRight } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface PriceAlert {
    id:           string;
    user_id:      string;
    email:        string;
    origin:       string;
    destination:  string;
    cabin_class:  string;
    adults:       number;
    target_price: number | null;
    is_active:    boolean;
    created_at:   string;
}

interface AlertsResponse {
    alerts:     PriceAlert[];
    total:      number;
    page:       number;
    totalPages: number;
    stats: {
        total:    number;
        active:   number;
        inactive: number;
    };
}

const PAGE_SIZE = 20;

const CABIN_LABELS: Record<string, string> = {
    economy:         'Economy',
    premium_economy: 'Prem. Economy',
    business:        'Business',
    first:           'First',
};

export default function AdminPriceAlertsPage() {
    const [data, setData]         = useState<AlertsResponse | null>(null);
    const [page, setPage]         = useState(1);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);

    const load = useCallback(async (p: number, status: string) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
            if (status !== 'all') params.set('status', status);
            const res = await http.get<AlertsResponse>(`/admin/price-alerts?${params}`);
            setData(res);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load price alerts.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page, statusFilter); }, [page, statusFilter, load]);

    async function doAction(action: 'activate' | 'deactivate' | 'delete', id: string) {
        setActionId(id);
        try {
            await http.post(`/admin/price-alerts/${id}/${action}`);
            load(page, statusFilter);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionId(null);
        }
    }

    const alerts     = data?.alerts ?? [];
    const stats      = data?.stats;
    const totalPages = data ? Math.max(1, data.totalPages) : 1;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Price Alerts</h1>
                <p className="text-sm text-slate-500 mt-0.5">User-configured fare watch alerts</p>
            </div>

            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatsCard label="Total Alerts" value={stats.total.toLocaleString()} />
                    <StatsCard label="Active"       value={stats.active.toLocaleString()} />
                    <StatsCard label="Inactive"     value={stats.inactive.toLocaleString()} />
                </div>
            )}

            {/* Status filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
                {(['all', 'active', 'inactive'] as const).map(opt => (
                    <button key={opt} onClick={() => { setStatusFilter(opt); setPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${statusFilter === opt ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}>
                        {opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-sm text-rose-500">{error}</div>
                ) : loading ? (
                    <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : alerts.length === 0 ? (
                    <div className="p-12 text-center">
                        <Bell size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">No price alerts found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Route</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Cabin</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Target</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {alerts.map(alert => (
                                    <tr key={alert.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Plane size={13} className="text-blue-500 shrink-0" />
                                                <span className="font-bold text-slate-900">{alert.origin} → {alert.destination}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px] truncate">{alert.email}</td>
                                        <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            {CABIN_LABELS[alert.cabin_class] ?? alert.cabin_class}
                                        </td>
                                        <td className="px-4 py-3">
                                            {alert.target_price ? (
                                                <span className="text-sm font-bold text-emerald-600">${alert.target_price}</span>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Any</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={alert.is_active ? 'success' : 'secondary'} size="sm">
                                                {alert.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">
                                            {new Date(alert.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center gap-1 justify-end">
                                                <Button
                                                    variant="ghost" size="sm"
                                                    disabled={actionId === alert.id}
                                                    onClick={() => doAction(alert.is_active ? 'deactivate' : 'activate', alert.id)}
                                                    className={`h-8 px-2 ${alert.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                                >
                                                    {alert.is_active ? <BellOff size={14} /> : <Bell size={14} />}
                                                </Button>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    disabled={actionId === alert.id}
                                                    onClick={() => doAction('delete', alert.id)}
                                                    className="h-8 px-2 text-rose-500 hover:bg-rose-50"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
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
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft size={14} />}>Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight size={14} />}>Next</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

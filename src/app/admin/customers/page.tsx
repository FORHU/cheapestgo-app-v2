'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Users, Search, DollarSign, Calendar, Award, Clock, X, Eye, ShieldBan, ShieldCheck, AlertTriangle } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/cn';

interface Customer {
    id:            string;
    name:          string;
    email:         string;
    status:        'active' | 'banned';
    totalBookings: number;
    totalSpend:    number;
    lastBooking:   string | null;
    joined:        string;
}

interface CustomersResponse {
    customers: Customer[];
    total:     number;
}

function fmtDate(iso: string | null) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function getSpendTier(bookings: number): { label: string; cls: string } {
    if (bookings >= 10) return { label: 'VIP',     cls: 'bg-blue-900 text-white' };
    if (bookings >= 4)  return { label: 'Regular', cls: 'bg-amber-100 text-amber-700' };
    if (bookings >= 1)  return { label: 'Active',  cls: 'bg-emerald-100 text-emerald-700' };
    return                     { label: 'New',     cls: 'bg-slate-100 text-slate-600' };
}

function SkeletonRows() {
    return (
        <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
    );
}

export default function AdminCustomersPage() {
    const [customers, setCustomers]   = useState<Customer[]>([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState<string | null>(null);
    const [search, setSearch]         = useState('');
    const [statusFilter, setStatus]   = useState<'all' | 'active' | 'banned'>('all');
    const [actionLoading, setAction]  = useState(false);
    const [toast, setToast]           = useState<{ ok: boolean; msg: string } | null>(null);

    const [selected, setSelected]     = useState<Customer | null>(null);
    const [detailOpen, setDetail]     = useState(false);
    const [banOpen, setBan]           = useState(false);
    const [deleteOpen, setDelete]     = useState(false);

    const showToast = (ok: boolean, msg: string) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await http.get<CustomersResponse>('/admin/customers');
            setCustomers(res.customers ?? []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load customers.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => customers.filter(c => {
        const matchSearch = !search ||
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.email.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchSearch && matchStatus;
    }), [customers, search, statusFilter]);

    const totalSpend   = useMemo(() => customers.reduce((s, c) => s + c.totalSpend, 0), [customers]);
    const avgBookings  = useMemo(() => customers.length ? (customers.reduce((s, c) => s + c.totalBookings, 0) / customers.length).toFixed(1) : '0', [customers]);
    const vipCount     = useMemo(() => customers.filter(c => c.totalBookings >= 10).length, [customers]);

    async function handleAction(action: 'ban' | 'unban' | 'hard_delete', target?: Customer) {
        const c = target ?? selected;
        if (!c) return;
        setAction(true);
        try {
            const res = await http.post<{ success: boolean; error?: string }>('/admin/customers', { action, userId: c.id });
            if (res.success) {
                if (action === 'hard_delete') {
                    setCustomers(prev => prev.filter(x => x.id !== c.id));
                    setDelete(false);
                    showToast(true, 'Customer permanently deleted.');
                } else {
                    const newStatus = action === 'ban' ? 'banned' : 'active';
                    setCustomers(prev => prev.map(x => x.id !== c.id ? x : { ...x, status: newStatus }));
                    setBan(false);
                    showToast(true, action === 'ban' ? 'Customer banned.' : 'Customer unbanned.');
                }
            } else {
                showToast(false, res.error ?? 'Action failed.');
            }
        } catch (err: unknown) {
            showToast(false, err instanceof Error ? err.message : 'Network error.');
        } finally {
            setAction(false);
            setSelected(null);
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Customers</h1>
                <p className="text-sm text-slate-500 mt-0.5">Booking history and account management</p>
            </div>

            {/* Stats */}
            {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard label="Total Customers"  value={customers.length.toLocaleString()} />
                    <StatsCard label="Total Revenue"    value={fmtCurrency(totalSpend)} />
                    <StatsCard label="Avg. Bookings"    value={avgBookings} />
                    <StatsCard label="VIP (10+ trips)"  value={vipCount.toLocaleString()} />
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={cn('flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border',
                    toast.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                )}>
                    {toast.msg}
                    <button onClick={() => setToast(null)} className="ml-auto opacity-70 hover:opacity-100"><X size={14} /></button>
                </div>
            )}

            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 max-w-md">
                    <Input
                        icon={Search}
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                    {(['all', 'active', 'banned'] as const).map(s => (
                        <button key={s} onClick={() => setStatus(s)}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all',
                                statusFilter === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'
                            )}>
                            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-sm text-rose-500">{error}</div>
                ) : loading ? (
                    <SkeletonRows />
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">No customers found</p>
                        {(search || statusFilter !== 'all') && (
                            <button onClick={() => { setSearch(''); setStatus('all'); }}
                                className="mt-3 text-xs text-blue-600 hover:underline">
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tier</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Spend</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Bookings</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Trip</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map(c => {
                                    const tier = getSpendTier(c.totalBookings);
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">
                                                        {c.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 leading-tight">{c.name}</p>
                                                        <p className="text-[10px] text-slate-400">{c.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', tier.cls)}>
                                                    {tier.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-900 tabular-nums">
                                                {fmtCurrency(c.totalSpend)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 font-semibold tabular-nums">
                                                {c.totalBookings}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                    <Clock size={10} />
                                                    {fmtDate(c.lastBooking)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {c.status === 'banned' ? (
                                                    <Badge variant="destructive" size="sm">Banned</Badge>
                                                ) : (
                                                    <Badge variant="success" size="sm">Active</Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => { setSelected(c); setDetail(true); }}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                        title="View details"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelected(c);
                                                            if (c.status === 'banned') handleAction('unban', c);
                                                            else setBan(true);
                                                        }}
                                                        className={cn('p-1.5 rounded-lg transition-colors',
                                                            c.status === 'banned'
                                                                ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                                                                : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                                        )}
                                                        title={c.status === 'banned' ? 'Unban' : 'Ban'}
                                                    >
                                                        {c.status === 'banned' ? <ShieldCheck size={15} /> : <ShieldBan size={15} />}
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelected(c); setDelete(true); }}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        title="Delete permanently"
                                                    >
                                                        <AlertTriangle size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
                            Showing {filtered.length} of {customers.length} customers
                        </div>
                    </div>
                )}
            </div>

            {/* ── Customer Detail Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetail}>
                <DialogContent showCloseButton>
                    {selected && (
                        <div className="p-6 space-y-5">
                            <DialogHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-black shadow-lg shadow-blue-600/20">
                                        {selected.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <DialogTitle>{selected.name}</DialogTitle>
                                        <p className="text-sm text-slate-400">{selected.email}</p>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Status',         value: selected.status },
                                    { label: 'Tier',           value: getSpendTier(selected.totalBookings).label },
                                    { label: 'Total Spend',    value: fmtCurrency(selected.totalSpend) },
                                    { label: 'Total Bookings', value: String(selected.totalBookings) },
                                    { label: 'Joined',         value: fmtDate(selected.joined) },
                                    { label: 'Last Trip',      value: fmtDate(selected.lastBooking) },
                                ].map(({ label, value }) => (
                                    <div key={label} className="p-3 rounded-xl bg-slate-50 space-y-0.5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                                        <p className="text-sm font-bold text-slate-900">{value}</p>
                                    </div>
                                ))}
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline" fullWidth>Close</Button>
                                </DialogClose>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Ban Confirmation Dialog ── */}
            <Dialog open={banOpen} onOpenChange={v => { setBan(v); if (!v) setSelected(null); }}>
                <DialogContent showCloseButton={false}>
                    <div className="p-6 space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <ShieldBan size={20} />
                        </div>
                        <DialogHeader>
                            <DialogTitle>Ban Customer</DialogTitle>
                            <DialogDescription>
                                <strong>{selected?.name}</strong> will be banned and unable to access the platform. Their booking history is preserved. You can unban them at any time.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button
                                className="bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                                isLoading={actionLoading}
                                onClick={() => handleAction('ban')}
                            >
                                Ban Customer
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation Dialog ── */}
            <Dialog open={deleteOpen} onOpenChange={v => { setDelete(v); if (!v) setSelected(null); }}>
                <DialogContent showCloseButton={false}>
                    <div className="p-6 space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                            <AlertTriangle size={20} />
                        </div>
                        <DialogHeader>
                            <DialogTitle>Delete Permanently</DialogTitle>
                            <DialogDescription>
                                This will permanently delete <strong>{selected?.name}</strong> and their account. This action <strong>cannot be undone</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button
                                variant="destructive"
                                isLoading={actionLoading}
                                onClick={() => handleAction('hard_delete')}
                            >
                                Delete Forever
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plane, Building2, Ticket, Search, Plus, X, ToggleLeft, ToggleRight, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';

type Tab = 'vouchers' | 'flight_deals' | 'hotel_deals';

interface DealsResponse { items: any[]; total: number; page: number; }

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'vouchers',     label: 'Vouchers',     icon: Ticket    },
    { key: 'flight_deals', label: 'Flight Deals', icon: Plane     },
    { key: 'hotel_deals',  label: 'Hotel Deals',  icon: Building2 },
];

const EMPTY_FORM = {
    code: '', description: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: '', min_booking_amount: '', usage_limit: '',
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
};

function fmtDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SkeletonRows({ cols }: { cols: number }) {
    return (
        <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                    {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} className="h-8 flex-1" />)}
                </div>
            ))}
        </div>
    );
}

function VouchersTable({ items, loading, onToggle, onDelete, loadingId }: {
    items: any[]; loading: boolean;
    onToggle: (id: string) => void; onDelete: (id: string) => void;
    loadingId: string | null;
}) {
    if (loading && items.length === 0) return <SkeletonRows cols={6} />;
    if (!loading && items.length === 0) return (
        <div className="p-12 text-center">
            <Ticket size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
            <p className="text-sm font-bold text-slate-900">No vouchers yet</p>
        </div>
    );
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                    <tr>{['Code', 'Description', 'Discount', 'Uses', 'Valid Until', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {items.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono font-bold text-xs text-slate-900">{v.code}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{v.description || '—'}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                                {v.discount_type === 'percent' ? `${Number(v.discount_value)}%` : `$${Number(v.discount_value)}`} off
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                                {v.times_used ?? 0}{v.usage_limit ? ` / ${v.usage_limit}` : ''}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(v.valid_until)}</td>
                            <td className="px-4 py-3">
                                {v.active ? <Badge variant="success" size="sm">Active</Badge> : <Badge variant="secondary" size="sm">Inactive</Badge>}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                    <button disabled={loadingId === v.id} onClick={() => onToggle(v.id)}
                                        className={cn('p-1.5 rounded-lg transition-colors', v.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100')}
                                        title={v.active ? 'Deactivate' : 'Activate'}>
                                        {v.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                    </button>
                                    <button disabled={loadingId === v.id} onClick={() => onDelete(v.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function FlightDealsTable({ items, loading }: { items: any[]; loading: boolean }) {
    if (loading && items.length === 0) return <SkeletonRows cols={5} />;
    if (!loading && items.length === 0) return (
        <div className="p-12 text-center">
            <Plane size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
            <p className="text-sm font-bold text-slate-900">No flight deals</p>
            <p className="text-xs text-slate-400 mt-1">Populated by the sync-flight-deals cron</p>
        </div>
    );
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                    <tr>{['Route', 'Airline', 'Price', 'Departure', 'Tag', 'Updated'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {items.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-xs text-slate-900">{f.origin} → {f.destination}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{f.airline ?? '—'}</td>
                            <td className="px-4 py-3 text-xs font-semibold">{f.currency ?? 'USD'} {Number(f.price).toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(f.departure_date)}</td>
                            <td className="px-4 py-3">{f.discount_tag ? <Badge variant="warning" size="sm">{f.discount_tag}</Badge> : <span className="text-xs text-slate-400">—</span>}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(f.updated_at)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function HotelDealsTable({ items, loading }: { items: any[]; loading: boolean }) {
    if (loading && items.length === 0) return <SkeletonRows cols={5} />;
    if (!loading && items.length === 0) return (
        <div className="p-12 text-center">
            <Building2 size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
            <p className="text-sm font-bold text-slate-900">No hotel deals</p>
            <p className="text-xs text-slate-400 mt-1">Populated via TravelgateX sync</p>
        </div>
    );
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                    <tr>{['Hotel', 'Destination', 'Price', 'Check-in', 'Discount', 'Stars'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {items.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-xs text-slate-900 max-w-[180px] truncate">{h.name}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{h.destination}</td>
                            <td className="px-4 py-3 text-xs font-semibold">{h.currency ?? 'USD'} {Number(h.price).toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(h.check_in)}</td>
                            <td className="px-4 py-3">{h.discount_pct ? <Badge variant="warning" size="sm">{h.discount_pct}% off</Badge> : <span className="text-xs text-slate-400">—</span>}</td>
                            <td className="px-4 py-3 text-xs text-amber-400">{'★'.repeat(Math.min(5, Number(h.stars ?? 0)))}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function AdminDealsPage() {
    const [tab, setTab]         = useState<Tab>('vouchers');
    const [items, setItems]     = useState<any[]>([]);
    const [total, setTotal]     = useState(0);
    const [page, setPage]       = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [loadingId, setLId]   = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [form, setFormState]  = useState({ ...EMPTY_FORM });
    const [toast, setToast]     = useState<{ ok: boolean; msg: string } | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / 25));

    const showToast = (ok: boolean, msg: string) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await http.get<DealsResponse>(`/admin/deals?tab=${tab}&page=${p}&q=${encodeURIComponent(search)}`);
            setItems(res.items ?? []);
            setTotal(res.total ?? 0);
        } catch { setItems([]); }
        finally { setLoading(false); }
    }, [tab, search]);

    useEffect(() => { setPage(1); load(1); }, [tab, search]);
    useEffect(() => { load(page); }, [page]);

    async function apiPost(body: object) {
        const res = await http.post<{ success: boolean; active?: boolean; error?: string }>('/admin/deals', body);
        if (!res.success) throw new Error(res.error ?? 'Action failed');
        return res;
    }

    async function handleToggle(id: string) {
        setLId(id);
        try {
            const res = await apiPost({ action: 'toggle_voucher', id });
            setItems(prev => prev.map(v => v.id !== id ? v : { ...v, active: res.active }));
            showToast(true, res.active ? 'Voucher activated.' : 'Voucher deactivated.');
        } catch (e: any) { showToast(false, e.message); }
        finally { setLId(null); }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this voucher permanently?')) return;
        setLId(id);
        try {
            await apiPost({ action: 'delete_voucher', id });
            setItems(prev => prev.filter(v => v.id !== id));
            setTotal(t => t - 1);
            showToast(true, 'Voucher deleted.');
        } catch (e: any) { showToast(false, e.message); }
        finally { setLId(null); }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!form.code || !form.discount_value || !form.valid_until) return;
        setSaving(true);
        try {
            await apiPost({ action: 'create_voucher', ...form });
            await load(1);
            setShowForm(false);
            setFormState({ ...EMPTY_FORM });
            showToast(true, 'Voucher created.');
        } catch (e: any) { showToast(false, e.message); }
        finally { setSaving(false); }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Deals</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Vouchers, flight deals, and hotel offers</p>
                </div>
                {tab === 'vouchers' && (
                    <Button size="sm" onClick={() => setShowForm(v => !v)}>
                        <Plus size={15} /> {showForm ? 'Cancel' : 'New Voucher'}
                    </Button>
                )}
            </div>

            {toast && (
                <div className={cn('flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border',
                    toast.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                )}>
                    {toast.msg}
                    <button onClick={() => setToast(null)} className="ml-auto"><X size={14} /></button>
                </div>
            )}

            {tab === 'vouchers' && showForm && (
                <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
                    <h2 className="text-sm font-bold text-slate-900">Create Voucher</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Code *</label>
                            <Input placeholder="SUMMER25" value={form.code} onChange={e => setFormState(f => ({ ...f, code: e.target.value.toUpperCase() }))} required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</label>
                            <select value={form.discount_type} onChange={e => setFormState(f => ({ ...f, discount_type: e.target.value as any }))}
                                className="w-full rounded-xl border border-slate-200 bg-white text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <option value="percent">Percentage (%)</option>
                                <option value="fixed">Fixed Amount</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Value *</label>
                            <Input type="number" min="0" step="0.01" placeholder={form.discount_type === 'percent' ? '25' : '100'}
                                value={form.discount_value} onChange={e => setFormState(f => ({ ...f, discount_value: e.target.value }))} required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min. Order</label>
                            <Input type="number" min="0" placeholder="500" value={form.min_booking_amount}
                                onChange={e => setFormState(f => ({ ...f, min_booking_amount: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Usage Limit</label>
                            <Input type="number" min="0" placeholder="Unlimited" value={form.usage_limit}
                                onChange={e => setFormState(f => ({ ...f, usage_limit: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Valid Until *</label>
                            <Input type="date" value={form.valid_until} onChange={e => setFormState(f => ({ ...f, valid_until: e.target.value }))} required />
                        </div>
                        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Description</label>
                            <Input placeholder="e.g. Summer discount for hotel bookings" value={form.description}
                                onChange={e => setFormState(f => ({ ...f, description: e.target.value }))} />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" size="sm" isLoading={saving}>Create Voucher</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                    </div>
                </form>
            )}

            {/* Tab bar + search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                tab === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'
                            )}>
                            <Icon size={13} />{label}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <Input icon={Search} placeholder={`Search…`} value={search} onChange={e => setSearch(e.target.value)} />
                    {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={14} /></button>}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {tab === 'vouchers'     && <VouchersTable     items={items} loading={loading} onToggle={handleToggle} onDelete={handleDelete} loadingId={loadingId} />}
                {tab === 'flight_deals' && <FlightDealsTable  items={items} loading={loading} />}
                {tab === 'hotel_deals'  && <HotelDealsTable   items={items} loading={loading} />}

                {total > 0 && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400">
                        <span>Showing {items.length} of {total}</span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                    <ChevronLeft size={14} />
                                </Button>
                                <span className="font-medium">Page {page} of {totalPages}</span>
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                                    <ChevronRight size={14} />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

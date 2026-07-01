'use client';

import { useEffect, useState, useCallback } from 'react';
import { Globe, Plus, Pencil, Trash2, Check, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface Destination {
    id:            string;
    city:          string;
    country:       string;
    image_url:     string | null;
    average_price: number | null;
    created_at:    string;
}

interface DestinationsResponse {
    destinations: Destination[];
    total:        number;
    page:         number;
    totalPages:   number;
}

const PAGE_SIZE = 20;
const EMPTY = { city: '', country: '', image_url: '', average_price: '' };

export default function AdminDestinationsPage() {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [total, setTotal]               = useState(0);
    const [page, setPage]                 = useState(1);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState<string | null>(null);
    const [search, setSearch]             = useState('');
    const [query, setQuery]               = useState('');

    const [showForm, setShowForm]         = useState(false);
    const [editingId, setEditingId]       = useState<string | null>(null);
    const [form, setForm]                 = useState(EMPTY);
    const [saving, setSaving]             = useState(false);
    const [deletingId, setDeletingId]     = useState<string | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const load = useCallback(async (p: number, q: string) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
            if (q) params.set('q', q);
            const res = await http.get<DestinationsResponse>(`/admin/destinations?${params}`);
            setDestinations(res.destinations ?? []);
            setTotal(res.total ?? 0);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page, query); }, [page, query, load]);

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setPage(1);
        setQuery(search);
    }

    async function handleSave(isEdit: boolean, id?: string) {
        if (!form.city.trim() || !form.country.trim()) return;
        setSaving(true);
        try {
            if (isEdit && id) {
                await http.put(`/admin/destinations/${id}`, {
                    city: form.city, country: form.country,
                    image_url: form.image_url || null,
                    average_price: form.average_price ? parseFloat(form.average_price) : null,
                });
            } else {
                await http.post('/admin/destinations', {
                    city: form.city, country: form.country,
                    image_url: form.image_url || null,
                    average_price: form.average_price ? parseFloat(form.average_price) : null,
                });
            }
            setForm(EMPTY);
            setShowForm(false);
            setEditingId(null);
            load(page, query);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this destination?')) return;
        setDeletingId(id);
        try {
            await http.delete(`/admin/destinations/${id}`);
            load(page, query);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Delete failed');
        } finally {
            setDeletingId(null);
        }
    }

    function startEdit(dest: Destination) {
        setEditingId(dest.id);
        setForm({ city: dest.city, country: dest.country, image_url: dest.image_url ?? '', average_price: dest.average_price?.toString() ?? '' });
        setShowForm(false);
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Destinations</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{total > 0 ? `${total.toLocaleString()} total` : 'Manage popular destinations'}</p>
                </div>
                <Button size="sm" onClick={() => { setShowForm(v => !v); setEditingId(null); setForm(EMPTY); }}>
                    <Plus size={14} /> Add Destination
                </Button>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-end gap-2 max-w-md">
                <Input icon={Search} placeholder="Search city or country…" value={search} onChange={e => setSearch(e.target.value)} />
                <Button type="submit" size="sm" className="shrink-0">Search</Button>
                {query && <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>Clear</Button>}
            </form>

            {/* Create form */}
            {showForm && (
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">New Destination</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input label="City *" placeholder="Tokyo" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                        <Input label="Country *" placeholder="Japan" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                        <Input label="Image URL" placeholder="https://…" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
                        <Input label="Average Price (USD)" type="number" placeholder="299" value={form.average_price} onChange={e => setForm(f => ({ ...f, average_price: e.target.value }))} />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY); }}>Cancel</Button>
                        <Button size="sm" isLoading={saving} onClick={() => handleSave(false)}>{saving ? 'Saving…' : 'Create'}</Button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-sm text-rose-500">{error}</div>
                ) : loading ? (
                    <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : destinations.length === 0 ? (
                    <div className="p-16 text-center">
                        <Globe size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">No destinations found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">City</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Country</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg Price</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {destinations.map(dest => (
                                    <>
                                        <tr key={dest.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {dest.image_url ? (
                                                        <img src={dest.image_url} alt={dest.city} className="w-8 h-8 rounded-lg object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Globe size={14} className="text-slate-400" /></div>
                                                    )}
                                                    <span className="font-bold text-slate-900">{dest.city}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{dest.country}</td>
                                            <td className="px-4 py-3">
                                                {dest.average_price ? (
                                                    <span className="text-emerald-600 font-bold">${dest.average_price}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <Button variant="ghost" size="sm" onClick={() => startEdit(dest)} className="h-8 px-2 text-blue-600 hover:bg-blue-50"><Pencil size={14} /></Button>
                                                    <Button variant="ghost" size="sm" disabled={deletingId === dest.id} onClick={() => handleDelete(dest.id)} className="h-8 px-2 text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></Button>
                                                </div>
                                            </td>
                                        </tr>
                                        {editingId === dest.id && (
                                            <tr key={`edit-${dest.id}`} className="bg-blue-50/40">
                                                <td colSpan={4} className="px-4 py-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                                                        <Input label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                                                        <Input label="Country" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                                                        <Input label="Image URL" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
                                                        <Input label="Avg Price" type="number" value={form.average_price} onChange={e => setForm(f => ({ ...f, average_price: e.target.value }))} />
                                                    </div>
                                                    <div className="flex gap-2 mt-3 justify-end">
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X size={14} className="mr-1" />Cancel</Button>
                                                        <Button size="sm" isLoading={saving} onClick={() => handleSave(true, dest.id)}><Check size={14} className="mr-1" />{saving ? 'Saving…' : 'Save'}</Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
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

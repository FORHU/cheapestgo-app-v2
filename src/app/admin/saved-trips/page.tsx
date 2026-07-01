'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bookmark, Plane, Building2, Trash2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface SavedTrip {
    id:         string;
    user_id:    string;
    type:       'flight' | 'hotel';
    title:      string;
    subtitle:   string | null;
    price:      number | null;
    currency:   string;
    image_url:  string | null;
    deep_link:  string;
    created_at: string;
}

interface TripsResponse {
    trips:      SavedTrip[];
    total:      number;
    page:       number;
    totalPages: number;
    stats: {
        total:   number;
        flights: number;
        hotels:  number;
    };
}

const PAGE_SIZE = 20;

function fmt(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export default function AdminSavedTripsPage() {
    const [data, setData]         = useState<TripsResponse | null>(null);
    const [page, setPage]         = useState(1);
    const [typeFilter, setTypeFilter] = useState<'all' | 'flight' | 'hotel'>('all');
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const totalPages = data ? Math.max(1, data.totalPages) : 1;

    const load = useCallback(async (p: number, type: string) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
            if (type !== 'all') params.set('type', type);
            const res = await http.get<TripsResponse>(`/admin/saved-trips?${params}`);
            setData(res);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load saved trips.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page, typeFilter); }, [page, typeFilter, load]);

    async function handleDelete(id: string) {
        if (!confirm('Remove this saved trip?')) return;
        setDeletingId(id);
        try {
            await http.delete(`/admin/saved-trips/${id}`);
            load(page, typeFilter);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Delete failed');
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Saved Trips</h1>
                <p className="text-sm text-slate-500 mt-0.5">User-saved flight and hotel offers</p>
            </div>

            {data?.stats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatsCard label="Total Saved" value={data.stats.total.toLocaleString()} />
                    <StatsCard label="Flights"     value={data.stats.flights.toLocaleString()} />
                    <StatsCard label="Hotels"      value={data.stats.hotels.toLocaleString()} />
                </div>
            )}

            {/* Type filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
                {(['all', 'flight', 'hotel'] as const).map(opt => (
                    <button key={opt} onClick={() => { setTypeFilter(opt); setPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${typeFilter === opt ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}>
                        {opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1) + 's'}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-sm text-rose-500">{error}</div>
                ) : loading ? (
                    <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : !data || data.trips.length === 0 ? (
                    <div className="p-12 text-center">
                        <Bookmark size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">No saved trips found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Trip</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Price</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Saved</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.trips.map(trip => (
                                    <tr key={trip.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {trip.image_url ? (
                                                    <img src={trip.image_url} alt={trip.title} className="w-8 h-8 rounded-lg object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                ) : (
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${trip.type === 'flight' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                                        {trip.type === 'flight' ? <Plane size={14} /> : <Building2 size={14} />}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{trip.title}</p>
                                                    {trip.subtitle && <p className="text-xs text-slate-400 truncate max-w-[200px]">{trip.subtitle}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={trip.type === 'flight' ? 'default' : 'success'} size="sm">
                                                {trip.type === 'flight' ? 'Flight' : 'Hotel'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-900">
                                            {trip.price ? fmt(trip.price, trip.currency) : <span className="text-slate-400 italic text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <code className="text-xs font-mono text-slate-400">{trip.user_id.slice(0, 8)}…</code>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">
                                            {new Date(trip.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center gap-1 justify-end">
                                                <a href={trip.deep_link} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="ghost" size="sm" className="h-8 px-2 text-blue-600 hover:bg-blue-50"><ExternalLink size={14} /></Button>
                                                </a>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    disabled={deletingId === trip.id}
                                                    onClick={() => handleDelete(trip.id)}
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
                    <span>Page {page} of {totalPages} — {data?.total.toLocaleString()} trips</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft size={14} />}>Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight size={14} />}>Next</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star, MessageSquare, Trash2, Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface HotelReview {
    id:            string;
    hotel_id:      string;
    reviewer_name: string | null;
    rating:        number | null;
    review_text:   string | null;
    source:        string | null;
    created_at:    string;
}

interface ReviewsResponse {
    reviews:    HotelReview[];
    total:      number;
    page:       number;
    totalPages: number;
    stats: {
        total:    number;
        lastWeek: number;
    };
}

const PAGE_SIZE = 20;

function StarRating({ rating }: { rating: number | null }) {
    if (rating == null) return <span className="text-xs text-slate-400">—</span>;
    const full = Math.round(rating);
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={11} className={i < full ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
            ))}
            <span className="text-xs font-bold text-slate-600 ml-1">{rating.toFixed(1)}</span>
        </div>
    );
}

export default function AdminReviewsPage() {
    const [data, setData]         = useState<ReviewsResponse | null>(null);
    const [page, setPage]         = useState(1);
    const [search, setSearch]     = useState('');
    const [query, setQuery]       = useState('');
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const totalPages = data ? Math.max(1, data.totalPages) : 1;

    const load = useCallback(async (p: number, q: string) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
            if (q) params.set('q', q);
            const res = await http.get<ReviewsResponse>(`/admin/reviews?${params}`);
            setData(res);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load reviews.');
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

    async function handleDelete(id: string) {
        if (!confirm('Delete this review? This cannot be undone.')) return;
        setDeletingId(id);
        try {
            await http.delete(`/admin/reviews/${id}`);
            load(page, query);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Delete failed');
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Reviews</h1>
                <p className="text-sm text-slate-500 mt-0.5">Hotel review moderation</p>
            </div>

            {data?.stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatsCard label="Total Reviews"    value={data.stats.total.toLocaleString()} />
                    <StatsCard label="Added This Week"  value={data.stats.lastWeek.toLocaleString()} />
                </div>
            )}

            <form onSubmit={handleSearch} className="flex items-end gap-2 max-w-md">
                <Input icon={Search} placeholder="Search hotel ID or reviewer…" value={search} onChange={e => setSearch(e.target.value)} />
                <Button type="submit" size="sm" className="shrink-0">Search</Button>
                {query && <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>Clear</Button>}
            </form>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-sm text-rose-500">{error}</div>
                ) : loading ? (
                    <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : !data || data.reviews.length === 0 ? (
                    <div className="p-12 text-center">
                        <Star size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">No reviews found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Hotel</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reviewer</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Rating</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Review</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Source</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.reviews.map(review => (
                                    <tr key={review.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Building2 size={13} className="text-slate-400 shrink-0" />
                                                <code className="text-xs font-mono font-bold text-blue-600">{review.hotel_id}</code>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700">{review.reviewer_name ?? '—'}</td>
                                        <td className="px-4 py-3"><StarRating rating={review.rating} /></td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs text-slate-500 max-w-[200px] truncate" title={review.review_text ?? ''}>
                                                {review.review_text ?? <span className="italic text-slate-400">No text</span>}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">{review.source ?? '—'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost" size="sm"
                                                disabled={deletingId === review.id}
                                                onClick={() => handleDelete(review.id)}
                                                className="h-8 px-2 text-rose-500 hover:bg-rose-50"
                                            >
                                                <Trash2 size={14} />
                                            </Button>
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
                    <span>Page {page} of {totalPages} — {data?.total.toLocaleString()} reviews</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft size={14} />}>Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight size={14} />}>Next</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

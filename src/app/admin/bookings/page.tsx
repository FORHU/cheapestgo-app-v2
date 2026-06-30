'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { BookingsTable } from '@/features/admin/components/bookings-table';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { Booking, PaginatedResponse } from '@/shared/types';

const PAGE_SIZE = 20;

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [total, setTotal]       = useState(0);
    const [page, setPage]         = useState(1);
    const [search, setSearch]     = useState('');
    const [query, setQuery]       = useState(''); // committed search term
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const loadBookings = useCallback(async (p: number, q: string) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page:     String(p),
                pageSize: String(PAGE_SIZE),
            });
            if (q) params.set('q', q);

            const res = await http.get<PaginatedResponse<Booking>>(`/api/bookings?${params}`);
            setBookings(res.data ?? []);
            setTotal(res.total ?? 0);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load bookings.');
            setBookings([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBookings(page, query);
    }, [page, query, loadBookings]);

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setPage(1);
        setQuery(search);
    }

    function handleClear() {
        setSearch('');
        setQuery('');
        setPage(1);
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Bookings</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {total > 0 ? `${total.toLocaleString()} total` : 'All platform bookings'}
                    </p>
                </div>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex items-end gap-2 max-w-md">
                <Input
                    icon={Search}
                    placeholder="Search by booking ID…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <Button type="submit" size="sm" className="shrink-0">Search</Button>
                {query && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                        Clear
                    </Button>
                )}
            </form>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-sm text-rose-500">{error}</div>
                ) : loading ? (
                    <div className="p-6 space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                        ))}
                    </div>
                ) : (
                    <BookingsTable bookings={bookings} />
                )}
            </div>

            {/* Pagination */}
            {!loading && !error && totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>
                        Page {page} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            leftIcon={<ChevronLeft size={14} />}
                        >
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            rightIcon={<ChevronRight size={14} />}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

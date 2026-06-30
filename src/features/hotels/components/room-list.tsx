'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Users, Bed, Check, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';

export interface RoomOption {
    id: string;
    offerId?: string;
    name: string;
    price: number;
    currency: string;
    /** "RFN" = refundable, "NRFN" = non-refundable */
    refundableTag?: string;
    maxOccupancy?: number;
    bedType?: string;
    boardType?: string;
    /** Room area in m² */
    size?: number;
    amenities?: string[];
}

interface RoomListProps {
    hotelId: string;
    rooms: RoomOption[];
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
}

type RateFilter = 'all' | 'rfn' | 'nrfn';

const ROOMS_PER_PAGE = 5;

function RoomCard({
    room,
    hotelId,
    checkIn,
    checkOut,
    adults,
    children,
}: { room: RoomOption; hotelId: string; checkIn?: string; checkOut?: string; adults?: number; children?: number }) {
    const router = useRouter();
    const isRefundable = room.refundableTag === 'RFN';

    const handleBook = () => {
        const params = new URLSearchParams({
            hotelId,
            roomId:   room.id,
            offerId:  room.offerId ?? room.id,
            currency: room.currency,
        });
        if (checkIn)  params.set('checkIn', checkIn);
        if (checkOut) params.set('checkOut', checkOut);
        if (adults)   params.set('adults', String(adults));
        if (children) params.set('children', String(children));
        router.push(`/checkout?${params.toString()}`);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
                {/* Name */}
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm md:text-base">
                    {room.name}
                </h4>

                {/* Meta pills */}
                <div className="flex flex-wrap gap-2 text-xs">
                    {room.maxOccupancy && (
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Users size={12} />
                            Up to {room.maxOccupancy} guests
                        </span>
                    )}
                    {room.bedType && (
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Bed size={12} />
                            {room.bedType}
                        </span>
                    )}
                    {room.size && (
                        <span className="text-slate-500 dark:text-slate-400">{room.size} m²</span>
                    )}
                    {room.boardType && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                            {room.boardType}
                        </span>
                    )}
                </div>

                {/* Amenities */}
                {room.amenities && room.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {room.amenities.slice(0, 4).map((a) => (
                            <span
                                key={a}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 dark:bg-white/5 text-[10px] text-slate-500 dark:text-slate-400"
                            >
                                <Check size={9} className="text-emerald-500" />
                                {a}
                            </span>
                        ))}
                    </div>
                )}

                {/* Cancellation */}
                <div className={cn('flex items-center gap-1 text-xs font-medium', isRefundable ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500')}>
                    {isRefundable ? (
                        <>
                            <Check size={12} />
                            Free cancellation
                        </>
                    ) : (
                        <>
                            <X size={12} />
                            Non-refundable
                        </>
                    )}
                </div>
            </div>

            {/* Price + CTA */}
            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0">
                <div className="text-right">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {room.currency} {room.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-slate-400">/night</p>
                </div>
                <Button size="sm" onClick={handleBook}>
                    Book Room
                </Button>
            </div>
        </div>
    );
}

export function RoomList({ hotelId, rooms, checkIn, checkOut, adults, children }: RoomListProps) {
    const [filter, setFilter] = useState<RateFilter>('all');
    const [page, setPage] = useState(1);

    const rfnCount  = rooms.filter((r) => r.refundableTag === 'RFN').length;
    const nrfnCount = rooms.filter((r) => r.refundableTag !== 'RFN').length;

    const filtered = filter === 'all'
        ? rooms
        : rooms.filter((r) => (filter === 'rfn' ? r.refundableTag === 'RFN' : r.refundableTag !== 'RFN'));

    const totalPages = Math.ceil(filtered.length / ROOMS_PER_PAGE);
    const paginated  = filtered.slice((page - 1) * ROOMS_PER_PAGE, page * ROOMS_PER_PAGE);

    return (
        <div id="rooms" className="space-y-4 scroll-mt-24">
            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                Available Rooms {filtered.length > 0 && `(${filtered.length})`}
            </h3>

            {rooms.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    {([
                        { key: 'all',  label: 'All',            count: rooms.length },
                        { key: 'rfn',  label: 'Refundable',     count: rfnCount },
                        { key: 'nrfn', label: 'Non-refundable', count: nrfnCount },
                    ] as { key: RateFilter; label: string; count: number }[]).map(({ key, label, count }) => (
                        <button
                            key={key}
                            onClick={() => { setFilter(key); setPage(1); }}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                                filter === key
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400',
                            )}
                        >
                            {label}
                            <span className={cn('text-[10px] px-1 rounded-full', filter === key ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500')}>
                                {count}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {filtered.length > 0 ? (
                <>
                    {filtered.length > ROOMS_PER_PAGE && (
                        <p className="text-xs text-slate-400">
                            Showing {(page - 1) * ROOMS_PER_PAGE + 1}–{Math.min(page * ROOMS_PER_PAGE, filtered.length)} of {filtered.length} rooms
                        </p>
                    )}
                    <div className="space-y-3">
                        {paginated.map((room) => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                hotelId={hotelId}
                                checkIn={checkIn}
                                checkOut={checkOut}
                                adults={adults}
                                children={children}
                            />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                            <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={cn(
                                            'min-w-[30px] h-8 px-2 rounded-lg text-xs font-medium border transition-colors',
                                            p === page
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
                                        )}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="py-10 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-sm">
                    {filter !== 'all'
                        ? `No ${filter === 'rfn' ? 'refundable' : 'non-refundable'} rooms available.`
                        : 'No rooms available for the selected dates.'}
                </div>
            )}
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function RoomListSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-7 w-48 rounded bg-slate-200 dark:bg-white/10" />
            {[1, 2, 3].map((n) => (
                <div key={n} className="h-[120px] rounded-xl bg-slate-200 dark:bg-white/10" />
            ))}
        </div>
    );
}

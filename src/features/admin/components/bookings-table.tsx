'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/cn';
import type { Booking, BookingStatus } from '@/shared/types';

// ─── Status badge mapping ─────────────────────────────────────────────────────

const STATUS_VARIANT: Record<BookingStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    confirmed: 'success',
    pending:   'warning',
    cancelled: 'destructive',
    failed:    'secondary',
};

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = 'id' | 'type' | 'status' | 'totalAmount' | 'createdAt';
type SortDir = 'asc' | 'desc';

function sortBookings(list: Booking[], key: SortKey, dir: SortDir): Booking[] {
    return [...list].sort((a, b) => {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return dir === 'asc' ? cmp : -cmp;
    });
}

// ─── Column header ────────────────────────────────────────────────────────────

function SortableHeader({
    label, sortKey, current, dir, onSort,
}: {
    label: string;
    sortKey: SortKey;
    current: SortKey;
    dir: SortDir;
    onSort: (k: SortKey) => void;
}) {
    const active = current === sortKey;
    return (
        <th
            className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-pointer select-none whitespace-nowrap hover:text-slate-700 transition-colors"
            onClick={() => onSort(sortKey)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {active
                    ? dir === 'asc'
                        ? <ChevronUp size={12} className="text-blue-500" />
                        : <ChevronDown size={12} className="text-blue-500" />
                    : <ChevronsUpDown size={12} className="text-slate-300" />
                }
            </span>
        </th>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookingsTableProps {
    bookings: Booking[];
    userEmailMap?: Record<string, string>; // userId → email
}

export function BookingsTable({ bookings, userEmailMap = {} }: BookingsTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    function handleSort(key: SortKey) {
        if (key === sortKey) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    }

    const sorted = sortBookings(bookings, sortKey, sortDir);

    if (sorted.length === 0) {
        return (
            <div className="text-center py-16 text-slate-400 text-sm">
                No bookings found.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-100">
                        <SortableHeader label="Booking ID" sortKey="id"          current={sortKey} dir={sortDir} onSort={handleSort} />
                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                            User
                        </th>
                        <SortableHeader label="Type"       sortKey="type"        current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Status"     sortKey="status"      current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Amount"     sortKey="totalAmount" current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Date"       sortKey="createdAt"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((booking) => (
                        <tr
                            key={booking.id}
                            className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                        >
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                {booking.reference ?? booking.id.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px] truncate">
                                {userEmailMap[booking.userId] ?? booking.userId.slice(0, 8) + '…'}
                            </td>
                            <td className="px-4 py-3">
                                <Badge variant="secondary" size="sm" className="capitalize">
                                    {booking.type}
                                </Badge>
                            </td>
                            <td className="px-4 py-3">
                                <Badge
                                    variant={STATUS_VARIANT[booking.status]}
                                    size="sm"
                                    className="capitalize"
                                >
                                    {booking.status}
                                </Badge>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 tabular-nums">
                                {booking.currency}&nbsp;
                                {booking.totalAmount.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                                {new Date(booking.createdAt).toLocaleDateString('en-US', {
                                    year:  'numeric',
                                    month: 'short',
                                    day:   'numeric',
                                })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

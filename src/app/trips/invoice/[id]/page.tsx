'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/store';
import { http } from '@/shared/lib/http';
import { formatCurrency } from '@/shared/lib/format';
import type { HotelBooking, FlightBooking } from '@/shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateNights(checkIn: string, checkOut: string): number {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function fmtDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Print button ─────────────────────────────────────────────────────────────

function PrintButton() {
    return (
        <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-sm"
        >
            Print / Save PDF
        </button>
    );
}

// ─── Invoice renderer ─────────────────────────────────────────────────────────

type AnyBooking = HotelBooking | FlightBooking;

interface InvoiceProps {
    booking: AnyBooking;
    isHotel: boolean;
    customerEmail: string;
}

function InvoiceView({ booking, isHotel, customerEmail }: InvoiceProps) {
    const invoiceNumber = `INV-${booking.id.slice(0, 8).toUpperCase()}`;
    const issuedDate = new Date(booking.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
    const currency = booking.currency || 'PHP';
    const totalPrice = ('charged_price' in booking && booking.charged_price != null)
        ? booking.charged_price
        : booking.total_price;

    const hotel = isHotel ? (booking as HotelBooking) : null;
    const flight = !isHotel ? (booking as FlightBooking) : null;

    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-lg print:shadow-none print:rounded-none">
            {/* Header */}
            <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <h1 className="text-2xl font-extrabold text-indigo-600 tracking-tight">CheapestGo</h1>
                    <p className="text-xs text-slate-400 mt-0.5">Your Travel Partner</p>
                </div>
                <div className="text-right">
                    <p className="text-xl font-bold text-slate-800 dark:text-white">RECEIPT</p>
                    <p className="text-xs text-slate-400 mt-0.5">{invoiceNumber}</p>
                    <p className="text-xs text-slate-400">Issued: {issuedDate}</p>
                </div>
            </div>

            {/* Billed to */}
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Billed to</p>
                {isHotel && hotel ? (
                    <>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                            {hotel.holder_first_name} {hotel.holder_last_name}
                        </p>
                        <p className="text-xs text-slate-500">{hotel.holder_email}</p>
                    </>
                ) : (
                    <>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                            {flight?.passengers?.[0]?.first_name} {flight?.passengers?.[0]?.last_name}
                        </p>
                        <p className="text-xs text-slate-500">{customerEmail}</p>
                    </>
                )}
            </div>

            {/* Booking details */}
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Booking Details</p>

                {isHotel && hotel ? (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800">
                                <th className="text-left pb-2 font-medium">Description</th>
                                <th className="text-right pb-2 font-medium">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            <tr>
                                <td className="py-3">
                                    <p className="font-semibold text-slate-800 dark:text-white">{hotel.property_name}</p>
                                    {hotel.room_name && (
                                        <p className="text-xs text-slate-500">{hotel.room_name}</p>
                                    )}
                                    <p className="text-xs text-slate-500">
                                        {fmtDate(hotel.check_in)}
                                        {' → '}
                                        {fmtDate(hotel.check_out)}
                                        {' · '}
                                        {calculateNights(hotel.check_in, hotel.check_out)} nights
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {hotel.guests_adults} adult{hotel.guests_adults !== 1 ? 's' : ''}
                                        {hotel.guests_children > 0 && `, ${hotel.guests_children} child${hotel.guests_children !== 1 ? 'ren' : ''}`}
                                    </p>
                                </td>
                                <td className="py-3 text-right font-semibold text-slate-800 dark:text-white">
                                    {formatCurrency(totalPrice, currency)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800">
                                <th className="text-left pb-2 font-medium">Flight</th>
                                <th className="text-left pb-2 font-medium">Route</th>
                                <th className="text-left pb-2 font-medium">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {(flight?.flight_segments ?? []).map((seg, i) => (
                                <tr key={i}>
                                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                        {seg.airline} {seg.flight_number}
                                    </td>
                                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                                        {seg.origin} → {seg.destination}
                                    </td>
                                    <td className="py-2.5 text-xs text-slate-500">
                                        {fmtDate(seg.departure)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Passengers for flights */}
                {!isHotel && flight?.passengers && flight.passengers.length > 0 && (
                    <div className="mt-4">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Passengers</p>
                        <div className="space-y-1">
                            {flight.passengers.map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                                    <span>
                                        {p.first_name} {p.last_name}{' '}
                                        {p.type && <span className="text-slate-400">({p.type})</span>}
                                    </span>
                                    {p.ticket_number && (
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[10px]">
                                            E-TKT: {p.ticket_number}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Booking reference */}
            <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-6 text-xs text-slate-500">
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">Booking Ref</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                        {isHotel ? (hotel?.booking_id ?? booking.id.slice(0, 8).toUpperCase()) : flight?.pnr}
                    </span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">Type</span>
                    <span className="text-slate-700 dark:text-slate-300 capitalize">
                        {isHotel ? 'Hotel' : `Flight · ${flight?.trip_type ?? 'one-way'}`}
                    </span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">Provider</span>
                    <span className="text-slate-700 dark:text-slate-300 capitalize">
                        {isHotel ? 'Hotel Partner' : (flight?.provider ?? '—')}
                    </span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">Payment</span>
                    <span className="text-slate-700 dark:text-slate-300">Stripe (Card)</span>
                </div>
            </div>

            {/* Total */}
            <div className="px-8 py-5 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">Total Paid</p>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {formatCurrency(totalPrice, currency)}
                </p>
            </div>

            {/* Footer */}
            <div className="px-8 pb-8">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-5 py-4 text-xs text-slate-400 text-center">
                    Thank you for booking with CheapestGo. For support, contact{' '}
                    <span className="text-indigo-500">crm@myfarebox.com</span>
                </div>
            </div>
        </div>
    );
}

// ─── Inner page — uses useParams + useSearchParams ────────────────────────────

function InvoicePageInner() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const id = params.id;
    const type = searchParams.get('type') ?? 'hotel';
    const isHotel = type === 'hotel';

    const user = useAuthStore((s) => s.user);
    const isLoading = useAuthStore((s) => s.isLoading);

    const [booking, setBooking] = useState<AnyBooking | null>(null);
    const [fetchError, setFetchError] = useState('');
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        if (isLoading) return; // wait for auth to hydrate

        setIsFetching(true);
        http.get<{ booking: AnyBooking }>(`/bookings/${id}?type=${type}`)
            .then(({ booking: b }) => {
                setBooking(b);
                setFetchError('');
            })
            .catch((err: Error) => {
                setFetchError(err.message || 'Failed to load booking.');
            })
            .finally(() => setIsFetching(false));
    }, [id, type, isLoading]);

    if (isLoading || isFetching) {
        return (
            <div className="max-w-3xl mx-auto animate-pulse space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg h-96" />
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg px-8 py-12 text-center space-y-3">
                    <p className="text-lg font-bold text-slate-800 dark:text-white">Unable to load invoice</p>
                    <p className="text-sm text-slate-500">{fetchError}</p>
                </div>
            </div>
        );
    }

    if (!booking) return null;

    const customerEmail = user?.email ?? '';

    return (
        <InvoiceView
            booking={booking}
            isHotel={isHotel}
            customerEmail={customerEmail}
        />
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicePage() {
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4">
            {/* Print button — hidden when printing */}
            <div className="max-w-3xl mx-auto mb-4 flex justify-end print:hidden">
                <PrintButton />
            </div>

            <Suspense fallback={
                <div className="max-w-3xl mx-auto animate-pulse">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg h-96" />
                </div>
            }>
                <InvoicePageInner />
            </Suspense>

            <style>{`
                @media print {
                    /* Hide everything on the page by default */
                    body > * { display: none !important; }

                    /* Show only the root wrapper that contains the invoice */
                    body > div { display: block !important; }

                    /* Hide header, footer, nav, dev tools, fixed overlays */
                    header, footer, nav,
                    [data-react-scan], [id*="react-scan"],
                    [class*="react-scan"], [class*="fps"],
                    [class*="GlobalSparkle"], [class*="sparkle"],
                    [class*="pwa"], [class*="PWA"],
                    [class*="AuthModal"], [class*="Toaster"],
                    [style*="position: fixed"], [style*="position:fixed"] {
                        display: none !important;
                    }

                    /* Invoice wrapper */
                    body { background: white !important; margin: 0; }
                    .print\\:hidden { display: none !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:rounded-none { border-radius: 0 !important; }

                    /* Tighten spacing so it fits on one page */
                    .max-w-3xl { max-width: 100% !important; }
                    .py-8 { padding-top: 12px !important; padding-bottom: 12px !important; }
                    .px-8 { padding-left: 24px !important; padding-right: 24px !important; }
                    .pt-8 { padding-top: 16px !important; }
                    .pb-8 { padding-bottom: 12px !important; }
                    .py-5 { padding-top: 10px !important; padding-bottom: 10px !important; }
                    .py-4 { padding-top: 8px !important; padding-bottom: 8px !important; }
                    .mb-4 { margin-bottom: 0 !important; }
                    .mt-14 { margin-top: 16px !important; }
                    .rounded-2xl { border-radius: 0 !important; }
                    .shadow-lg { box-shadow: none !important; }

                    /* Force single page */
                    html, body { height: auto !important; }
                    @page { margin: 10mm 12mm; size: A4; }
                }
            `}</style>
        </div>
    );
}

'use client';

/**
 * One route for all three documents, because they load the same booking the same way
 * and differ only in what they are allowed to show.
 *
 * The kind asked for is checked against `availableDocuments` rather than trusted: a URL
 * is a guess, and `?kind=eticket` on a booking the airline has not ticketed must not
 * produce a document that says it has.
 */
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Printer, Clock } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { useAuthStore } from '@/shared/auth/store';
import type { AnyBooking, FlightBooking, HotelBooking } from '@/shared/types';
import { availableDocuments, pendingReason, type TravelDocument } from '@/features/trips/lib/documents';
import { FlightETicket, HotelVoucher, PaymentReceipt } from './travel-documents';

const KINDS: TravelDocument[] = ['eticket', 'voucher', 'receipt'];

function PrintButton() {
    const t = useTranslations();
    return (
        <div className="max-w-3xl mx-auto mb-4 flex justify-end print:hidden">
            <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
                <Printer size={15} />
                {t('trips.invoice.print')}
            </button>
        </div>
    );
}

/** Paid, but the thing being waited on has not happened. Said plainly, not left blank. */
function Pending({ reason }: { reason: 'awaiting_ticket' | 'awaiting_confirmation' }) {
    const t = useTranslations();
    return (
        <div className="max-w-3xl mx-auto rounded-2xl bg-white dark:bg-slate-900 px-8 py-12 text-center shadow-lg">
            <Clock size={28} className="mx-auto mb-3 text-amber-500" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
                {t(reason === 'awaiting_ticket'
                    ? 'documents.pending.awaitingTicket'
                    : 'documents.pending.awaitingConfirmation')}
            </p>
        </div>
    );
}

function Inner() {
    const t = useTranslations();
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const id = params.id;
    const type = searchParams.get('type') ?? 'hotel';
    const asked = searchParams.get('kind');
    const kind: TravelDocument = KINDS.includes(asked as TravelDocument) ? (asked as TravelDocument) : 'receipt';

    const isLoading = useAuthStore((s) => s.isLoading);
    const [booking, setBooking] = useState<AnyBooking | null>(null);
    const [fetchError, setFetchError] = useState('');
    const [isFetching, setIsFetching] = useState(true);
    /**
     * The property's address and phone, read when the voucher is opened rather than
     * stored with the booking. A guest arriving today wants the number that works today,
     * not the one that was on file when they booked. The rate terms are the opposite and
     * are snapshotted — see `provider_metadata.board`.
     */
    const [property, setProperty] = useState<{ address?: string; phone?: string; checkInTime?: string; checkOutTime?: string } | null>(null);

    useEffect(() => {
        if (isLoading) return;
        setIsFetching(true);
        http.get<{ booking: AnyBooking }>(`/bookings/${id}?type=${type}`)
            .then(({ booking: b }) => { setBooking(b); setFetchError(''); })
            .catch((err: Error) => setFetchError(err.message || 'Failed to load booking.'))
            .finally(() => setIsFetching(false));
    }, [id, type, isLoading]);

    // Best-effort: a voucher without a phone number is still a valid voucher, so a
    // property lookup that fails must not take the document down with it.
    const hotelCode = booking?.type === 'hotel' ? booking.provider_metadata?.hotelCode : undefined;
    useEffect(() => {
        if (kind !== 'voucher' || !hotelCode) return;
        let cancelled = false;
        http.get<{ content?: { address?: string; city?: string; country?: string; contact_info?: { phone?: string }; check_in_time?: string; check_out_time?: string } }>(
            `/hotels/property/${encodeURIComponent(hotelCode)}`,
        )
            .then(({ content }) => {
                if (cancelled || !content) return;
                // Suppliers often end the street address with the city already, so
                // appending it blindly prints "…Songpa-gu, Seoul, Seoul, KR".
                const line = [content.address, content.city, content.country]
                    .filter((part): part is string => Boolean(part))
                    .filter((part, i, all) => !all.slice(0, i).some((prev) => prev.toLowerCase().includes(part.toLowerCase())))
                    .join(', ');
                setProperty({
                    address:      line || undefined,
                    phone:        content.contact_info?.phone,
                    checkInTime:  content.check_in_time,
                    checkOutTime: content.check_out_time,
                });
            })
            .catch(() => { /* the voucher stands without it */ });
        return () => { cancelled = true; };
    }, [kind, hotelCode]);

    if (isLoading || isFetching) {
        return <div className="max-w-3xl mx-auto h-96 animate-pulse rounded-2xl bg-white shadow-lg dark:bg-slate-900" />;
    }

    if (fetchError || !booking) {
        return (
            <div className="max-w-3xl mx-auto rounded-2xl bg-white dark:bg-slate-900 px-8 py-12 text-center shadow-lg">
                <p className="text-lg font-bold text-slate-800 dark:text-white">{t('trips.invoice.loadError')}</p>
                {fetchError && <p className="mt-2 text-sm text-slate-500">{fetchError}</p>}
            </div>
        );
    }

    // The URL asked; the booking decides. A traveller who edits the query string gets the
    // pending notice, not a document claiming something that has not happened.
    if (!availableDocuments(booking).includes(kind)) {
        const why = pendingReason(booking);
        return why ? <Pending reason={why} /> : (
            <div className="max-w-3xl mx-auto rounded-2xl bg-white dark:bg-slate-900 px-8 py-12 text-center shadow-lg">
                <p className="text-sm text-slate-500">{t('trips.invoice.loadError')}</p>
            </div>
        );
    }

    return (
        <>
            <PrintButton />
            {kind === 'eticket' && <FlightETicket booking={booking as FlightBooking} />}
            {kind === 'voucher' && <HotelVoucher booking={booking as HotelBooking} property={property} />}
            {kind === 'receipt' && <PaymentReceipt booking={booking} />}
        </>
    );
}

export function TravelDocumentView() {
    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 print:bg-white print:p-0">
            <Suspense fallback={<div className="max-w-3xl mx-auto h-96 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />}>
                <Inner />
            </Suspense>
        </div>
    );
}

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
import { Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer, Clock, Download, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/lib/cn';
import { ACTION, CHIP, MUTED, SOFT, TEXT } from './booking-card-parts';
import { http } from '@/shared/lib/http';
import { fetchBooking } from '../lib/bookings-api';
import { useAuthStore } from '@/shared/auth/store';
import type { AnyBooking, FlightBooking, HotelBooking } from '@/shared/types';
import { availableDocuments, pendingReason, type TravelDocument } from '@/features/trips/lib/documents';
import { FlightETicket, HotelVoucher, PaymentReceipt } from './travel-documents';
import { pdfFilename, useSavePdf } from '@/shared/lib/receipt-pdf';

const KINDS: TravelDocument[] = ['eticket', 'voucher', 'receipt'];

/** What each document's file is called: `Receipt_GG-AB12CD.pdf`, `E-Ticket_…`, `Voucher_…`. */
const FILE_PREFIX: Record<TravelDocument, string> = { receipt: 'Receipt', eticket: 'E-Ticket', voucher: 'Voucher' };

/**
 * Download beside Print. Download saves the printed copy as a PDF without the print dialog
 * (`receipt-pdf.ts`), so the file and the paper say the same thing.
 */
function DocumentActions({ target, filename }: { target: RefObject<HTMLDivElement | null>; filename: string }) {
    const t = useTranslations();
    const { save, busy, failed } = useSavePdf();
    return (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2.5 print:hidden">
            {failed && (
                <span role="status" className="text-[13px] text-red-600 dark:text-red-400">
                    {t('trips.invoice.pdfError')}
                </span>
            )}
            <button
                type="button"
                onClick={() => window.print()}
                className={cn(ACTION, SOFT, TEXT)}
            >
                <Printer size={15} aria-hidden />
                {t('trips.invoice.print')}
            </button>
            <button
                type="button"
                onClick={() => save(target.current, filename)}
                disabled={busy}
                aria-busy={busy}
                className={cn(ACTION, CHIP, 'disabled:cursor-wait disabled:opacity-60')}
            >
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Download size={15} aria-hidden />}
                {busy ? t('trips.invoice.generating') : t('trips.invoice.downloadPdf')}
            </button>
        </div>
    );
}

/** Paid, but the thing being waited on has not happened. Said plainly, not left blank. */
function Pending({ reason }: { reason: 'awaiting_ticket' | 'awaiting_confirmation' }) {
    const t = useTranslations();
    return (
        <div className="rounded-[20px] bg-white dark:bg-slate-900 px-6 py-12 text-center shadow-sm">
            <Clock size={28} className="mx-auto mb-3 text-amber-500" />
            <p className="text-[14px] text-slate-700 dark:text-slate-100">
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
    const documentRef = useRef<HTMLDivElement>(null);
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
        fetchBooking(http, id)
            .then((b) => { setBooking(b); setFetchError(''); })
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
        return <div className="h-96 animate-pulse rounded-[20px] bg-white shadow-sm dark:bg-slate-900" />;
    }

    if (fetchError || !booking) {
        return (
            <div className="rounded-[20px] bg-white dark:bg-slate-900 px-6 py-12 text-center shadow-sm">
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
            <div className="rounded-[20px] bg-white dark:bg-slate-900 px-6 py-12 text-center shadow-sm">
                <p className="text-sm text-slate-500">{t('trips.invoice.loadError')}</p>
            </div>
        );
    }

    // The reference the receipt itself prints, so the file is found by the number on it.
    const reference = ('booking_reference' in booking && booking.booking_reference) || booking.id.slice(0, 8).toUpperCase();

    return (
        <>
            <DocumentActions target={documentRef} filename={pdfFilename(FILE_PREFIX[kind], reference)} />
            <div ref={documentRef}>
                {kind === 'eticket' && <FlightETicket booking={booking as FlightBooking} />}
                {kind === 'voucher' && <HotelVoucher booking={booking as HotelBooking} property={property} />}
                {kind === 'receipt' && <PaymentReceipt booking={booking} />}
            </div>
        </>
    );
}

/** Back to the booking the document belongs to — the trips pages' own back link. */
function BackToBooking() {
    const t = useTranslations();
    const params = useParams<{ id: string }>();
    return (
        <Link
            href={params?.id ? `/trips/${params.id}` : '/trips'}
            className={cn('mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-[14px] transition-colors hover:text-slate-900 dark:hover:text-white print:hidden', MUTED)}
        >
            <ArrowLeft size={15} aria-hidden />
            {t('trips.bookingDetails')}
        </Link>
    );
}

export function TravelDocumentView() {
    return (
        // The booking page's measure (`booking-detail.tsx`), so the column starts where it did.
        <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 pt-2 pb-24 md:pt-4 md:pb-28 print:p-0">
            <div className="max-w-3xl mx-auto">
                <Suspense fallback={null}>
                    <BackToBooking />
                </Suspense>
                <Suspense fallback={<div className="h-96 animate-pulse rounded-[20px] bg-white shadow-sm dark:bg-slate-900" />}>
                    <Inner />
                </Suspense>
            </div>
        </main>
    );
}

'use client';

/**
 * The three documents a traveller actually needs, drawn as one family.
 *
 * They share the shell the receipt already used — same card, same section rules, same
 * uppercase micro-labels — because they are printed together and read together. What
 * differs is what each one is allowed to claim:
 *
 *   - the **E-ticket** claims an airline issued a ticket, so it is gated on issuance and
 *     never on the PNR;
 *   - the **Hotel Voucher** claims a property is holding a room, and leads with the
 *     reference that property can actually find;
 *   - the **Payment Receipt** claims only that money moved.
 *
 * Deliberately absent: a boarding pass. One is issued by the airline at check-in and
 * carries their barcode; anything this app drew would be a picture of a boarding pass,
 * which is worse than none at all. The e-ticket links to the airline's check-in instead.
 */
import { useTranslations } from 'next-intl';
import { Plane, Hotel, Receipt as ReceiptIcon, ExternalLink } from 'lucide-react';
import { BRAND_NAME } from '@/shared/lib/brand';
import { formatCurrency } from '@/shared/lib/format';
import { nightsBetween } from '@/shared/lib/stay';
import type { FlightBooking, HotelBooking } from '@/shared/types';
import { Link } from '@/i18n/navigation';
import { availableDocuments, pendingReason, supplierReference, ticketNumbers } from '@/features/trips/lib/documents';

// ─── Shared shell ─────────────────────────────────────────────────────────────

const CARD    = 'max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-lg print:shadow-none print:rounded-none';
const SECTION = 'px-8 py-5 border-b border-slate-100 dark:border-slate-800';
const LABEL   = 'text-[10px] font-semibold text-slate-400 uppercase tracking-wide';
const VALUE   = 'text-sm font-semibold text-slate-800 dark:text-white';

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function Shell({ title, icon, reference, status, children }: {
    title: string;
    icon: React.ReactNode;
    reference?: string | null;
    status: { label: string; tone: 'green' | 'amber' | 'slate' };
    children: React.ReactNode;
}) {
    const tone = {
        green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    }[status.tone];

    return (
        <div className={CARD}>
            <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <h1 className="text-2xl font-extrabold text-indigo-600 tracking-tight">{BRAND_NAME}</h1>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">{icon}{title}</p>
                </div>
                <div className="text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>
                        {status.label}
                    </span>
                    {reference && <p className="mt-1 font-mono text-xs text-slate-400">{reference}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

/** A label above its value, the unit every section is built from. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className={LABEL}>{label}</p>
            <p className={`${VALUE} mt-0.5`}>{children}</p>
        </div>
    );
}

// ─── Flight e-ticket ──────────────────────────────────────────────────────────

export function FlightETicket({ booking }: { booking: FlightBooking }) {
    const t = useTranslations();
    const tickets = ticketNumbers(booking);
    const segments = booking.flight_segments ?? [];
    const lead = booking.passengers?.[0];

    return (
        <Shell
            title={t('documents.eticket.title')}
            icon={<Plane size={12} />}
            reference={booking.pnr}
            status={{ label: t('documents.status.ticketed'), tone: 'green' }}
        >
            <div className={`${SECTION} grid grid-cols-2 gap-4 sm:grid-cols-3`}>
                <Field label={t('documents.eticket.passenger')}>
                    {lead ? `${lead.first_name} ${lead.last_name}`.toUpperCase() : '—'}
                </Field>
                <Field label={t('documents.eticket.pnr')}>
                    <span className="font-mono">{booking.pnr ?? '—'}</span>
                </Field>
                {/* Only ever printed once the airline has issued — the whole reason this
                    document is gated rather than drawn from the PNR. */}
                <Field label={t('documents.eticket.ticketNumber')}>
                    <span className="font-mono">{tickets[0] ?? '—'}</span>
                </Field>
            </div>

            {segments.map((s, i) => (
                <div key={i} className={`${SECTION} grid grid-cols-2 gap-4 sm:grid-cols-4`}>
                    <Field label={t('documents.eticket.flight')}>
                        {[s.airline, s.flight_number].filter(Boolean).join(' ') || '—'}
                    </Field>
                    <Field label={t('documents.eticket.from')}>
                        <span className="font-mono">{s.origin}</span>
                        <span className="block text-xs font-normal text-slate-500">{fmtDateTime(s.departure)}</span>
                    </Field>
                    <Field label={t('documents.eticket.to')}>
                        <span className="font-mono">{s.destination}</span>
                        <span className="block text-xs font-normal text-slate-500">
                            {s.arrival ? fmtDateTime(s.arrival) : '—'}
                        </span>
                    </Field>
                    <Field label={t('documents.eticket.seat')}>
                        {booking.passengers?.[0]?.seat_number ?? t('documents.eticket.atCheckIn')}
                    </Field>
                </div>
            ))}

            <div className={SECTION}>
                <p className={LABEL}>{t('documents.eticket.fareConditions')}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {booking.fare_policy?.isRefundable
                        ? t('documents.eticket.refundable')
                        : t('documents.eticket.nonRefundable')}
                    {booking.fare_policy?.isChangeable === false && ` · ${t('documents.eticket.nonChangeable')}`}
                </p>
            </div>

            {/* No boarding pass here, and no barcode. Check-in belongs to the airline,
                and a barcode this app invented would scan as nothing at a gate. */}
            <div className="px-8 py-5 print:hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('documents.eticket.checkInHint')}</p>
            </div>

            <div className={`${SECTION} border-b-0 text-[11px] text-slate-400`}>
                {t('documents.eticket.footer')}
            </div>
        </Shell>
    );
}

// ─── Hotel voucher ────────────────────────────────────────────────────────────

export function HotelVoucher({ booking, property }: {
    booking: HotelBooking;
    /** Fetched when the voucher renders — a guest arriving today wants today's number. */
    property?: { address?: string; phone?: string; checkInTime?: string; checkOutTime?: string } | null;
}) {
    const t = useTranslations();
    const meta = booking.provider_metadata;
    const supplierRef = supplierReference(booking);
    const nights = nightsBetween(booking.check_in, booking.check_out) ?? 1;

    return (
        <Shell
            title={t('documents.voucher.title')}
            icon={<Hotel size={12} />}
            reference={supplierRef}
            status={{ label: t('documents.status.confirmed'), tone: 'green' }}
        >
            <div className={SECTION}>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{booking.property_name}</p>
                {property?.address && <p className="text-xs text-slate-500">{property.address}</p>}
                {property?.phone && <p className="text-xs text-slate-500">{property.phone}</p>}
            </div>

            {/* The headline number is the supplier's, because that is the one the
                property's own system holds. Ours is shown too — it is what support will
                ask for — but it would not find the reservation at a front desk. */}
            <div className={`${SECTION} grid grid-cols-2 gap-4`}>
                <Field label={t('documents.voucher.confirmationNumber')}>
                    <span className="font-mono">{supplierRef ?? '—'}</span>
                </Field>
                <Field label={t('documents.voucher.ourReference')}>
                    <span className="font-mono text-slate-500">{booking.booking_reference ?? booking.id.slice(0, 8).toUpperCase()}</span>
                </Field>
            </div>

            <div className={`${SECTION} grid grid-cols-2 gap-4 sm:grid-cols-4`}>
                {/* Snapshot first, then the property's current time. A check-in hour is a
                    house rule rather than part of the rate, so reading it live is right —
                    but if a booking ever captured one, that is what the guest agreed to. */}
                <Field label={t('documents.voucher.checkIn')}>
                    {fmtDate(booking.check_in)}
                    {(meta?.checkInTime ?? property?.checkInTime) && (
                        <span className="block text-xs font-normal text-slate-500">
                            {t('documents.voucher.fromTime', { time: meta?.checkInTime ?? property?.checkInTime ?? '' })}
                        </span>
                    )}
                </Field>
                <Field label={t('documents.voucher.checkOut')}>
                    {fmtDate(booking.check_out)}
                    {(meta?.checkOutTime ?? property?.checkOutTime) && (
                        <span className="block text-xs font-normal text-slate-500">
                            {t('documents.voucher.untilTime', { time: meta?.checkOutTime ?? property?.checkOutTime ?? '' })}
                        </span>
                    )}
                </Field>
                <Field label={t('documents.voucher.stay')}>{t('search.nights', { count: nights })}</Field>
                <Field label={t('documents.voucher.guests')}>
                    {t('documents.voucher.occupancy', {
                        adults: booking.guests_adults ?? 1,
                        children: booking.guests_children ?? 0,
                    })}
                </Field>
            </div>

            <div className={`${SECTION} grid grid-cols-2 gap-4`}>
                <Field label={t('documents.voucher.leadGuest')}>
                    {`${booking.holder_first_name ?? ''} ${booking.holder_last_name ?? ''}`.trim().toUpperCase() || '—'}
                </Field>
                <Field label={t('documents.voucher.room')}>{booking.room_name ?? '—'}</Field>
                {/* Only shown when it was snapshotted at booking. An unknown meal plan is
                    left out rather than guessed — a guest told breakfast is included and
                    then charged for it at the desk is worse off than one who asked. */}
                {meta?.board && <Field label={t('documents.voucher.mealPlan')}>{meta.board}</Field>}
            </div>

            <div className={`${SECTION} grid grid-cols-2 gap-4`}>
                <Field label={t('documents.voucher.paymentStatus')}>{t('documents.voucher.paidOnline')}</Field>
                <Field label={t('documents.voucher.payAtProperty')}>
                    {formatCurrency(0, booking.currency || 'PHP')}
                </Field>
            </div>

            {booking.special_requests && (
                <div className={SECTION}>
                    <p className={LABEL}>{t('documents.voucher.specialRequests')}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{booking.special_requests}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{t('documents.voucher.requestsNotGuaranteed')}</p>
                </div>
            )}

            <div className={`${SECTION} border-b-0 text-[11px] text-slate-400`}>
                {t('documents.voucher.footer')}
            </div>
        </Shell>
    );
}

// ─── Payment receipt ──────────────────────────────────────────────────────────

export function PaymentReceipt({ booking, cardLast4 }: {
    booking: FlightBooking | HotelBooking;
    /** Masked, always. Nothing here ever holds a full number, an expiry or a CVC. */
    cardLast4?: string | null;
}) {
    const t = useTranslations();
    const currency = booking.currency || 'PHP';
    const total = ('charged_price' in booking && booking.charged_price != null)
        ? booking.charged_price
        : booking.total_price;

    return (
        <Shell
            title={t('documents.receipt.title')}
            icon={<ReceiptIcon size={12} />}
            reference={`CG-RCP-${booking.id.slice(0, 8).toUpperCase()}`}
            status={{ label: t('documents.receipt.paid'), tone: 'green' }}
        >
            <div className={`${SECTION} grid grid-cols-2 gap-4 sm:grid-cols-4`}>
                <Field label={t('documents.receipt.receiptNumber')}>
                    <span className="font-mono">CG-RCP-{booking.id.slice(0, 8).toUpperCase()}</span>
                </Field>
                <Field label={t('documents.receipt.bookingReference')}>
                    <span className="font-mono">
                        {('booking_reference' in booking && booking.booking_reference) || booking.id.slice(0, 8).toUpperCase()}
                    </span>
                </Field>
                <Field label={t('documents.receipt.paymentDate')}>{fmtDate(booking.created_at)}</Field>
                <Field label={t('documents.receipt.paymentMethod')}>
                    {cardLast4 ? `•••• ${cardLast4}` : t('documents.receipt.card')}
                </Field>
            </div>

            <div className={SECTION}>
                <div className="flex items-center justify-between text-base font-bold text-slate-900 dark:text-white">
                    <span>{t('documents.receipt.totalPaid')}</span>
                    <span>{formatCurrency(total, currency)}</span>
                </div>
            </div>

            {/* A receipt proves a payment and nothing else. Saying so on the document is
                what stops it being carried to a desk as if it were a ticket. */}
            <div className={`${SECTION} border-b-0 text-[11px] text-slate-400`}>
                {t('documents.receipt.footer')}
            </div>
        </Shell>
    );
}

// ─── Where a traveller reaches them ───────────────────────────────────────────

/**
 * The documents this booking has, on the booking itself.
 *
 * Only what exists: no greyed-out "e-ticket" on a booking the airline has not ticketed.
 * A disabled control invites a click and explains nothing; the pending line says what is
 * being waited on instead.
 */
export function DocumentLinks({ booking }: { booking: FlightBooking | HotelBooking }) {
    const t = useTranslations();
    const docs = availableDocuments(booking);
    const pending = pendingReason(booking);
    if (!docs.length && !pending) return null;

    const href = (kind: string) =>
        `/trips/document/${booking.id}?type=${booking.type}&kind=${kind}`;

    const ACTION = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';

    return (
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <span className="text-slate-400"><ReceiptIcon size={15} /></span>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('documents.section')}</h2>
            </div>
            <div className="flex flex-wrap gap-2 px-5 py-4">
                {docs.includes('eticket') && <Link href={href('eticket')} className={ACTION}><Plane size={13} />{t('documents.actions.eticket')}</Link>}
                {docs.includes('voucher') && <Link href={href('voucher')} className={ACTION}><Hotel size={13} />{t('documents.actions.voucher')}</Link>}
                {docs.includes('receipt') && <Link href={href('receipt')} className={ACTION}><ReceiptIcon size={13} />{t('documents.actions.receipt')}</Link>}
                {pending && (
                    <p className="w-full text-xs text-slate-500 dark:text-slate-400">
                        {t(pending === 'awaiting_ticket'
                            ? 'documents.pending.awaitingTicket'
                            : 'documents.pending.awaitingConfirmation')}
                    </p>
                )}
            </div>
        </div>
    );
}

export { ExternalLink };

'use client';

/**
 * The three documents a traveller actually needs, drawn as one family.
 *
 * They share one shell — the booking detail page's card, section heads and label-and-value
 * rows — because they are printed together and read together. What
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
import { useLocale, useTranslations } from 'next-intl';
import { Plane, Hotel, Receipt as ReceiptIcon, ExternalLink, UserRound, Users, CreditCard, Info, type LucideIcon } from 'lucide-react';
import { LogoWordmark } from '@/features/landing/components/logo-wordmark';
import { formatCurrency } from '@/shared/lib/format';
import { nightsBetween } from '@/shared/lib/stay';
import type { FlightBooking, HotelBooking } from '@/shared/types';
import { Link } from '@/i18n/navigation';
import { availableDocuments, isCancelled, isTicketed, pendingReason, supplierReference, ticketNumbers } from '@/features/trips/lib/documents';
import { formatBookingDate, formatBookingTime } from '@/features/flights/lib/flight-utils';
import { cn } from '@/shared/lib/cn';
import { BookingStatusBadge, CHIP, DetailPanel, HAIRLINE, MUTED, SOFT, TEXT, TITLE } from './booking-card-parts';

// ─── Shared shell ─────────────────────────────────────────────────────────────
//
// The booking detail page's materials (`booking-card-parts.tsx`), so a document opened from a
// booking reads as part of it: the panel's white card and 20px corners, its icon-and-title
// section heads, its label-and-value rows split by a hairline, v2's slate type and the brand's
// one blue-to-cyan gradient. `print-color-adjust` keeps the tinted blocks on paper.

const CARD    = 'max-w-3xl mx-auto overflow-hidden rounded-[20px] bg-white shadow-sm dark:bg-slate-900 print:shadow-none print:rounded-none [print-color-adjust:exact] [-webkit-print-color-adjust:exact]';
const PAD     = 'px-5 sm:px-6';
const SECTION = `${PAD} py-5 border-b ${HAIRLINE}`;
const LABEL   = `text-[12px] ${MUTED}`;
const VALUE   = `text-[14px] font-medium ${TEXT}`;

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The booking card's status colours (`BookingStatusBadge`), one per meaning. */
const TONE = {
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
} as const;

function Shell({ title, icon, reference, issued, status, children }: {
    title: string;
    icon: React.ReactNode;
    reference?: string | null;
    /** The document's own date line beside the reference, already worded. */
    issued?: string;
    status: { label: string; tone: keyof typeof TONE };
    children: React.ReactNode;
}) {
    return (
        <div className={CARD}>
            {/* The masthead: who issued it, what it is, and how to find it again. */}
            <div className={`${PAD} pt-6 pb-5`}>
                <div className="flex items-center justify-between gap-4">
                    <LogoWordmark tone="default" height={22} />
                    <BookingStatusBadge label={status.label} color={TONE[status.tone]} />
                </div>
                <h1 className={`mt-5 flex items-center gap-2.5 text-[20px] font-bold leading-tight ${TITLE}`}>
                    <span className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden>{icon}</span>
                    {title}
                </h1>
                {(reference || issued) && (
                    <p className={`mt-1.5 text-[13px] ${MUTED}`}>
                        {reference && <span className={`font-mono font-semibold tracking-wider ${TEXT}`}>{reference}</span>}
                        {reference && issued && <span aria-hidden> · </span>}
                        {issued}
                    </p>
                )}
            </div>
            <div aria-hidden className={`h-[3px] ${CHIP}`} />
            {children}
        </div>
    );
}

/** A section's head, as the detail page's panels set theirs: an icon, then the title. */
function Band({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
    return (
        <h2 className={`${PAD} flex items-center gap-2.5 pt-6 pb-1 text-[17px] ${TITLE}`}>
            <Icon size={17} strokeWidth={1.75} className="shrink-0 text-slate-700 dark:text-white" aria-hidden />
            {children}
        </h2>
    );
}

/** Label-and-value rows (`DetailRow`), in two columns on a page wide enough for them. */
function Facts({ children }: { children: React.ReactNode }) {
    return <dl className={`${PAD} grid grid-cols-1 gap-x-8 pb-2 sm:grid-cols-2`}>{children}</dl>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className={`flex items-start justify-between gap-4 border-b py-3 ${HAIRLINE}`}>
            <dt className={`shrink-0 text-[14px] ${MUTED}`}>{label}</dt>
            <dd className={`min-w-0 text-right text-[14px] font-medium ${TEXT}`}>{children}</dd>
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
            icon={<Plane size={18} />}
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
            <div className="px-5 sm:px-6 py-5 print:hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('documents.eticket.checkInHint')}</p>
            </div>

            <div className={`${SECTION} border-b-0 text-[12px] text-slate-500 dark:text-slate-400`}>
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
            icon={<Hotel size={18} />}
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
                    <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{t('documents.voucher.requestsNotGuaranteed')}</p>
                </div>
            )}

            <div className={`${SECTION} border-b-0 text-[12px] text-slate-500 dark:text-slate-400`}>
                {t('documents.voucher.footer')}
            </div>
        </Shell>
    );
}

// ─── Payment receipt ──────────────────────────────────────────────────────────
//
// Laid out the way an airline's "e-ticket receipt & itinerary" is — passenger and booking
// facts, then the flights, then the fare and the notices — because that is the document people
// already know how to read and file. What it does not borrow is the claim: this one proves a
// payment, and a ticket number appears only once the airline has issued one.
//
// Absent on purpose: a fare/tax breakdown and the baggage allowance. Neither is stored with
// the booking, and the only split we hold is our cost against our price — which is the
// margin, not a tax line.

/** Ticket numbers as airlines print them: the carrier's three digits, then the ten. */
const fmtTicket = (n: string) => n.replace(/\s+/g, '').replace(/^(\d{3})(\d{10})$/, '$1 $2');

/** `premium_economy` → `Premium economy`. */
const fmtCabin = (c?: string) => {
    const words = (c ?? '').replace(/_/g, ' ').trim().toLowerCase();
    return words ? words[0].toUpperCase() + words.slice(1) : '—';
};

/** Passport style, the way a check-in desk reads a name: `DELA CRUZ/JUAN`. */
const fmtTravellerName = (first?: string, last?: string) =>
    [last, first].filter(Boolean).join('/').toUpperCase() || '—';

/** `7C` + `7C2104` → `7C 2104`; `7C` + `2104` → `7C 2104`. Suppliers send it both ways. */
const fmtFlight = (airline?: string, number?: string) => {
    const digits = airline && number?.toUpperCase().startsWith(airline.toUpperCase()) ? number.slice(airline.length) : number;
    return [airline, digits].filter(Boolean).join(' ') || '—';
};

const PAX_TYPE: Record<string, 'adult' | 'child' | 'infant'> = {
    ADT: 'adult', adult: 'adult', CHD: 'child', child: 'child', INF: 'infant', infant: 'infant',
};

const TRIP_TYPE: Record<string, 'oneWay' | 'roundTrip' | 'multiCity'> = {
    'one-way': 'oneWay', 'round-trip': 'roundTrip', 'multi-city': 'multiCity',
};

const receiptNumber = (b: { id: string }) => `CG-RCP-${b.id.slice(0, 8).toUpperCase()}`;

export function PaymentReceipt({ booking, cardLast4 }: {
    booking: FlightBooking | HotelBooking;
    /** Masked, always. Nothing here ever holds a full number, an expiry or a CVC. */
    cardLast4?: string | null;
}) {
    const t = useTranslations();
    const number = receiptNumber(booking);
    const refunded = String(booking.status) === 'refunded';

    return (
        <Shell
            title={t(booking.type === 'flight' ? 'documents.receipt.titleItinerary' : 'documents.receipt.title')}
            icon={<ReceiptIcon size={18} />}
            reference={number}
            issued={t('documents.receipt.issuedOn', { date: fmtDate(booking.created_at) })}
            status={isCancelled(booking)
                ? { label: t(refunded ? 'documents.receipt.refunded' : 'documents.receipt.cancelled'), tone: 'slate' }
                : { label: t('documents.receipt.paid'), tone: 'green' }}
        >
            <p className={`${PAD} pt-5 text-[13px] leading-relaxed ${MUTED}`}>
                {t(booking.type === 'flight' ? 'documents.receipt.introFlight' : 'documents.receipt.introHotel')}
            </p>

            {booking.type === 'flight'
                ? <FlightReceiptBody booking={booking} number={number} />
                : <HotelReceiptBody booking={booking} number={number} />}

            <FareAndPayment booking={booking} cardLast4={cardLast4} />

            {booking.type === 'flight' && <FlightNotices />}

            {/* A receipt proves a payment and nothing else. Saying so on the document is
                what stops it being carried to a desk as if it were a ticket. */}
            <div className={`${PAD} py-5 text-[12px] text-slate-500 dark:text-slate-400`}>
                {t('documents.receipt.footer')}
            </div>
        </Shell>
    );
}

/** Four columns on a page, two on a phone — where each value carries its own label. */
const COLS = 'grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-[1fr_1.25fr_1.5fr_1fr]';
const ROW  = `${PAD} ${COLS} border-b ${HAIRLINE} py-3 text-[14px]`;

function TableHead({ labels }: { labels: string[] }) {
    return (
        <div className={`${PAD} ${LABEL} hidden ${COLS} border-b ${HAIRLINE} pt-3 pb-2 sm:grid`}>
            {labels.map((l) => <span key={l}>{l}</span>)}
        </div>
    );
}

/** The column's name above a value on a phone, where the header row is hidden. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <span className={`${LABEL} block sm:hidden`}>{label}</span>
            {children}
        </div>
    );
}

function FlightReceiptBody({ booking, number }: { booking: FlightBooking; number: string }) {
    const t = useTranslations();
    const locale = useLocale();
    const ticketed = isTicketed(booking);
    const tickets = ticketNumbers(booking);
    const passengers = booking.passengers ?? [];
    const lead = passengers[0];
    const segments = [...(booking.flight_segments ?? [])].sort((a, b) =>
        (a.segment_index ?? 0) - (b.segment_index ?? 0) || a.departure.localeCompare(b.departure));
    const directions = new Set(segments.map((s) => s.segment_index ?? 0));
    const tripType = booking.trip_type ? TRIP_TYPE[booking.trip_type] : undefined;
    const segmentStatus = t(isCancelled(booking) ? 'documents.receipt.segCancelled' : 'documents.receipt.segConfirmed');

    const day  = (iso?: string) => (iso ? formatBookingDate(iso, locale) : '—');
    const time = (iso?: string) => (iso ? formatBookingTime(iso) : '');

    const paxLabels = {
        name:   t('documents.receipt.name'),
        type:   t('documents.receipt.paxType'),
        ticket: t('documents.receipt.eticketNumber'),
        seat:   t('documents.receipt.seat'),
    };
    const legLabels = {
        flight:  t('documents.receipt.flight'),
        when:    t('documents.receipt.departArrive'),
        airport: t('documents.receipt.airportTerminal'),
        cabin:   t('documents.receipt.cabin'),
    };

    return (
        <>
            <Band icon={UserRound}>{t('documents.receipt.sections.passengerBooking')}</Band>
            <Facts>
                <Fact label={t('documents.receipt.leadPassenger')}>{fmtTravellerName(lead?.first_name, lead?.last_name)}</Fact>
                <Fact label={t('documents.receipt.bookingReference')}>
                    <span className="font-mono">{booking.booking_reference || booking.id.slice(0, 8).toUpperCase()}</span>
                </Fact>
                <Fact label={t('documents.receipt.airlineReference')}><span className="font-mono">{booking.pnr || '—'}</span></Fact>
                <Fact label={t('documents.receipt.receiptNumber')}><span className="font-mono">{number}</span></Fact>
                <Fact label={t('documents.receipt.paymentDate')}>{fmtDate(booking.created_at)}</Fact>
                <Fact label={t('documents.receipt.ticketStatus')}>
                    {ticketed
                        ? (booking.ticketed_at
                            ? t('documents.receipt.ticketIssuedOn', { date: fmtDate(booking.ticketed_at) })
                            : t('documents.status.ticketed'))
                        : <span className="text-amber-600 dark:text-amber-400">{t('documents.receipt.ticketPending')}</span>}
                </Fact>
                {tripType && <Fact label={t('documents.receipt.tripType')}>{t(`documents.receipt.tripTypes.${tripType}`)}</Fact>}
            </Facts>

            {passengers.length > 0 && <>
                <Band icon={Users}>{t('documents.receipt.sections.passengers')}</Band>
                <TableHead labels={Object.values(paxLabels)} />
                {passengers.map((p, i) => {
                    const type = p.type ? PAX_TYPE[p.type] : undefined;
                    // Never before issuance: a number on a receipt reads as a ticket at a desk.
                    const ticket = ticketed ? (p.ticket_number ?? tickets[i]) : undefined;
                    return (
                        <div key={i} className={ROW}>
                            <Cell label={paxLabels.name}>
                                <span className="font-semibold text-slate-700 dark:text-slate-100">{fmtTravellerName(p.first_name, p.last_name)}</span>
                            </Cell>
                            <Cell label={paxLabels.type}>
                                <span className="text-slate-600 dark:text-slate-300">{type ? t(`documents.receipt.paxTypes.${type}`) : (p.type ?? '—')}</span>
                            </Cell>
                            <Cell label={paxLabels.ticket}>
                                {ticket
                                    ? <span className="font-mono text-slate-700 dark:text-slate-100">{fmtTicket(ticket)}</span>
                                    : <span className="text-slate-400">{t('documents.receipt.pending')}</span>}
                            </Cell>
                            <Cell label={paxLabels.seat}>
                                <span className="text-slate-600 dark:text-slate-300">{p.seat_number ?? t('documents.eticket.atCheckIn')}</span>
                            </Cell>
                        </div>
                    );
                })}
            </>}

            {segments.length > 0 && <>
                <Band icon={Plane}>{t('documents.receipt.sections.travel')}</Band>
                <TableHead labels={Object.values(legLabels)} />
                {segments.map((s, i) => {
                    const direction = s.segment_index ?? 0;
                    const firstOfDirection = i === 0 || (segments[i - 1].segment_index ?? 0) !== direction;
                    return (
                        <div key={i}>
                            {directions.size > 1 && firstOfDirection && (
                                <p className={`${PAD} pt-4 text-[13px] font-semibold text-blue-600 dark:text-blue-400`}>
                                    {t(direction === 0 ? 'documents.receipt.outbound' : 'documents.receipt.return')}
                                </p>
                            )}
                            <div className={ROW}>
                                <Cell label={legLabels.flight}>
                                    <span className="block font-mono font-semibold text-slate-700 dark:text-slate-100">{fmtFlight(s.airline, s.flight_number)}</span>
                                    <span className="block text-xs text-emerald-600 dark:text-emerald-400">{segmentStatus}</span>
                                </Cell>
                                <Cell label={legLabels.when}>
                                    <span className="block text-slate-700 dark:text-slate-100">{day(s.departure)} <span className="font-mono">{time(s.departure)}</span></span>
                                    <span className="block text-slate-500">{day(s.arrival)} <span className="font-mono">{time(s.arrival)}</span></span>
                                </Cell>
                                <Cell label={legLabels.airport}>
                                    <span className="block text-slate-700 dark:text-slate-100">
                                        <span className="font-mono font-semibold">{s.origin}</span>
                                        {s.origin_terminal && <span className="text-slate-500"> · {t('documents.receipt.terminal', { terminal: s.origin_terminal })}</span>}
                                    </span>
                                    <span className="block text-slate-500">
                                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{s.destination}</span>
                                        {s.destination_terminal && <span> · {t('documents.receipt.terminal', { terminal: s.destination_terminal })}</span>}
                                    </span>
                                </Cell>
                                <Cell label={legLabels.cabin}>
                                    <span className="text-slate-600 dark:text-slate-300">{fmtCabin(s.cabin_class)}</span>
                                </Cell>
                            </div>
                        </div>
                    );
                })}
                <p className={`${PAD} py-2 text-[12px] text-slate-500 dark:text-slate-400`}>{t('documents.receipt.localTimes')}</p>
            </>}
        </>
    );
}

function HotelReceiptBody({ booking, number }: { booking: HotelBooking; number: string }) {
    const t = useTranslations();
    const nights = nightsBetween(booking.check_in, booking.check_out) ?? 1;

    return (
        <>
            <Band icon={Hotel}>{t('documents.receipt.sections.stay')}</Band>
            <div className={`${PAD} pt-4`}>
                <p className="text-base font-bold text-slate-900 dark:text-white">{booking.property_name}</p>
                {booking.room_name && <p className="text-xs text-slate-500">{booking.room_name}</p>}
            </div>
            <Facts>
                <Fact label={t('documents.receipt.bookingReference')}>
                    <span className="font-mono">{booking.booking_reference || booking.id.slice(0, 8).toUpperCase()}</span>
                </Fact>
                <Fact label={t('documents.receipt.receiptNumber')}><span className="font-mono">{number}</span></Fact>
                <Fact label={t('documents.voucher.leadGuest')}>{fmtTravellerName(booking.holder_first_name, booking.holder_last_name)}</Fact>
                <Fact label={t('documents.receipt.paymentDate')}>{fmtDate(booking.created_at)}</Fact>
                <Fact label={t('documents.voucher.checkIn')}>{fmtDate(booking.check_in)}</Fact>
                <Fact label={t('documents.voucher.checkOut')}>{fmtDate(booking.check_out)}</Fact>
                <Fact label={t('documents.voucher.stay')}>{t('search.nights', { count: nights })}</Fact>
                <Fact label={t('documents.voucher.guests')}>
                    {t('documents.voucher.occupancy', { adults: booking.guests_adults ?? 1, children: booking.guests_children ?? 0 })}
                </Fact>
            </Facts>
        </>
    );
}

function FareAndPayment({ booking, cardLast4 }: { booking: FlightBooking | HotelBooking; cardLast4?: string | null }) {
    const t = useTranslations();
    const currency = booking.currency || 'PHP';
    const total = ('charged_price' in booking && booking.charged_price != null)
        ? booking.charged_price
        : booking.total_price;
    const policy = booking.type === 'flight' ? booking.fare_policy : undefined;
    const refundAmount = booking.type === 'flight' ? Number(booking.refund_amount ?? 0) : 0;
    const refund = booking.type === 'flight' && refundAmount > 0
        ? formatCurrency(refundAmount, booking.refund_currency || currency)
        : null;

    return (
        <>
            <Band icon={CreditCard}>{t('documents.receipt.sections.farePayment')}</Band>
            <Facts>
                <Fact label={t('documents.receipt.paymentMethod')}>
                    {cardLast4 ? `${t('documents.receipt.card')} •••• ${cardLast4}` : t('documents.receipt.card')}
                </Fact>
                <Fact label={t('documents.receipt.currency')}>{currency}</Fact>
                {policy && (
                    <Fact label={t('documents.eticket.fareConditions')}>
                        {policy.isRefundable ? t('documents.eticket.refundable') : t('documents.eticket.nonRefundable')}
                        {policy.isChangeable === false && ` · ${t('documents.eticket.nonChangeable')}`}
                        {policy.isRefundable && policy.refundPenaltyAmount ? (
                            <span className="block text-xs font-normal text-slate-500">
                                {t('documents.receipt.cancellationFee', {
                                    amount: formatCurrency(policy.refundPenaltyAmount, policy.refundPenaltyCurrency || currency),
                                })}
                            </span>
                        ) : null}
                    </Fact>
                )}
                {refund && <Fact label={t('documents.receipt.refundedAmount')}>{refund}</Fact>}
            </Facts>
            <div className={`mx-5 sm:mx-6 mt-3 mb-5 flex items-baseline justify-between gap-4 rounded-2xl px-5 py-4 ${SOFT}`}>
                <span className={`text-[14px] font-medium ${MUTED}`}>{t('documents.receipt.totalInclTaxes')}</span>
                <span className={`text-[22px] font-bold ${TITLE}`}>{formatCurrency(total, currency)}</span>
            </div>
        </>
    );
}

function FlightNotices() {
    const t = useTranslations();
    const keys = ['checkIn', 'airport', 'names', 'liquids', 'baggage'] as const;
    return (
        <>
            <Band icon={Info}>{t('documents.receipt.sections.important')}</Band>
            <ul className={`list-disc space-y-1.5 py-4 pr-5 pl-9 sm:pr-8 sm:pl-12 text-[13px] leading-relaxed ${TEXT}`}>
                {keys.map((k) => <li key={k}>{t(`documents.receipt.notices.${k}`)}</li>)}
            </ul>
        </>
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

    // The flight card's second action — the soft pill beside Select Now — a step smaller to sit in a panel.
    const ACTION = cn('inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-opacity hover:opacity-85', SOFT, TEXT);

    return (
        <DetailPanel title={t('documents.section')} icon={ReceiptIcon}>
            <div className="flex flex-wrap gap-2 py-1">
                {docs.includes('eticket') && <Link href={href('eticket')} className={ACTION}><Plane size={14} aria-hidden />{t('documents.actions.eticket')}</Link>}
                {docs.includes('voucher') && <Link href={href('voucher')} className={ACTION}><Hotel size={14} aria-hidden />{t('documents.actions.voucher')}</Link>}
                {docs.includes('receipt') && <Link href={href('receipt')} className={ACTION}><ReceiptIcon size={14} aria-hidden />{t('documents.actions.receipt')}</Link>}
                {pending && (
                    <p className={cn('w-full text-[13px]', MUTED)}>
                        {t(pending === 'awaiting_ticket'
                            ? 'documents.pending.awaitingTicket'
                            : 'documents.pending.awaitingConfirmation')}
                    </p>
                )}
            </div>
        </DetailPanel>
    );
}

export { ExternalLink };

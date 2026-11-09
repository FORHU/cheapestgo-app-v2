'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, Check, Copy, CopyCheck, Download, Plane } from 'lucide-react';
import { ACCENT_FILL, type Palette } from '@/features/checkout/lib/palette';
import { BRAND } from '@/shared/lib/palette';
import { airportLabel, formatDateTimeLocale, groupSegmentsIntoSlices } from '@/features/flights/lib/flight-utils';
import type { FlightOffer, NormalizedSegment } from '@/shared/types';
import { formatMoney } from '@/features/checkout/lib/format-money';
import { arrivalStay } from '@/features/checkout/lib/trip-next-steps';
import { CheckoutToolbar } from './checkout-toolbar';
import { SkeletonBar } from './skeleton-bar';
import { TripNextSteps } from './trip-next-steps';
import { useUserCurrency } from '@/shared/stores/search.store';
import { convertForDisplay } from '@/shared/lib/currency';
import { useLiveRates } from '@/shared/lib/use-live-rates';

/** Prices, times and references: tabular figures, so they line up and read as data. */
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
/** The form's field corners (`FIELD_RADIUS` on the checkout page), so a field shown here reads
 *  as the one the traveller filled in. */
const FIELD_RADIUS = 14;

// ─── Small pieces ───────────────────────────────────────────────────────────────

/** The airline's logo, same CDN the rest of the app reads it from. A plane in the pill fill
 *  stands in while there is none to show — an airline the CDN has no logo for, or the offer not
 *  read yet. Decorative: the airline's name is written beside it. */
function AirlineAvatar({ code, palette }: { code?: string; palette: Palette }) {
    const [broken, setBroken] = useState(false);
    return (
        <div aria-hidden style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: palette.stepIdle, color: palette.title, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {code && !broken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`https://images.kiwi.com/airlines/64/${code}.png`}
                    alt=""
                    style={{ width: 26, height: 26, objectFit: 'contain' }}
                    onError={() => setBroken(true)}
                />
            ) : <Plane size={18} />}
        </div>
    );
}

function Pill({ children, palette }: { children: React.ReactNode; palette: Palette }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999,
            fontSize: 13, background: palette.stepIdle, color: palette.title,
        }}>
            {children}
        </span>
    );
}

/** The box a field is drawn in on the form, without the input: the same height, fill, hairline
 *  and corners, but no hover or focus ring, since there is nothing here to type into. */
function fieldBox(palette: Palette): React.CSSProperties {
    return {
        display: 'flex', alignItems: 'center', minWidth: 0, height: 'var(--cg-field-h)', padding: '0 16px',
        borderRadius: FIELD_RADIUS, border: `1px solid ${palette.fieldLine}`, background: palette.fieldBg,
        color: palette.text, fontSize: 'var(--cg-field-fs)', boxSizing: 'border-box',
    };
}

const ellipsis: React.CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/** One answer from the form, shown back as the field it was typed into: the form's caption over
 *  the form's box. A `dt`/`dd` pair, so it reads as a label and its value. */
function ShownField({ label, value, palette }: { label: string; value: string; palette: Palette }) {
    return (
        <div style={{ minWidth: 0 }}>
            <dt style={{ fontSize: 'var(--cg-label-fs)', fontWeight: 500, color: palette.text, marginBottom: 8, paddingLeft: 2 }}>{label}</dt>
            <dd title={value} style={{ ...fieldBox(palette), margin: 0 }}>
                <span style={ellipsis}>{value || '—'}</span>
            </dd>
        </div>
    );
}

/**
 * The checkout's three steps, every one of them done. The form's bar marks only the step in hand;
 * once the booking is confirmed there is no step in hand, and the bar says instead that all three
 * are behind the traveller: each disc filled and ticked, the hairlines between them in the same
 * blue. Same geometry as the form's (32px discs, its `--step-gap` connectors, 12px captions), so
 * the bar does not jump when the confirmation replaces the payment step.
 */
const STEP_KEYS = ['steps.details', 'steps.payment', 'steps.verification'] as const;

function DoneSteps({ palette }: { palette: Palette }) {
    const t = useTranslations('checkout');
    return (
        <ol style={{ display: 'flex', alignItems: 'flex-start', listStyle: 'none', margin: 0, padding: 0 }}>
            {STEP_KEYS.map((key, i) => (
                <li key={key} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 32, flexShrink: 0 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: BRAND.primaryStrong, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Check aria-hidden size={16} strokeWidth={2.5} />
                        </div>
                        <div style={{ fontSize: 12, color: palette.text, whiteSpace: 'nowrap' }}>{t(key)}</div>
                    </div>
                    {i < STEP_KEYS.length - 1 && (
                        <div aria-hidden style={{ width: 'clamp(40px,6vw,90px)', height: 1, marginTop: 16, background: BRAND.primaryStrong }} />
                    )}
                </li>
            ))}
        </ol>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FlightPassengerInfo {
    firstName: string;
    lastName:  string;
    type:      'ADT' | 'CHD' | 'INF';
}

interface FlightConfirmedScreenProps {
    palette:       Palette;
    /** The offer bought, read once by the page: null while it loads, or when it could not be read. */
    offer:         FlightOffer | null;
    loadingOffer:  boolean;
    bookingId:     string | null;
    /** The airline's own record locator. The booking reference above is ours; an airport kiosk
     *  or the airline's own app asks for theirs. Shown only when `/flights/confirm` returned one. */
    pnr:           string | null;
    origin:        string;
    destination:   string;
    departureDate: string;
    cabin?:        string;
    currency:      string;
    /** What the card was held for. */
    total:         number;
    adults:        number;
    /** Named `childPassengers`, not `children` — the latter collides with React's own prop. */
    childPassengers: number;
    infants:       number;
    passengers:    FlightPassengerInfo[];
    contactEmail:  string;
    /** The toolbar's back button — to wherever the traveller came from. */
    backLabel:     string;
    onBack:        () => void;
    onHome:        () => void;
    onTrips:       () => void;
}

// ─── The screen ───────────────────────────────────────────────────────────────
//
// As designed ("Booking Confirmed", in the checkout-alignment project): the confirmation is drawn
// on the checkout form's own grid, so arriving here reads as the form's last step, not a new page.
// The steps sit top right where the form's bar was, all three done. The left column holds what the
// form collected, shown back in the form's own boxes: our booking reference (and where the receipt
// went), the flight bought, each passenger's name, the lead's email. The summary card stays on the
// right where it was through the checkout, now with what was paid.
//
// The itinerary's detail — airline, airport names, terminals, bags, fare terms — comes from the
// offer the page read, a GET the URL's own params never carried; everything else (the fare paid,
// who flies, where the e-ticket went) is what the booking itself already knows, so it is never
// blocked on that fetch.
//
// The fare is one figure: the service fee is part of it, as the checkout's summary has it.
//
// Below the two columns' first rows: the trips button and, under it, the rest of the trip — a
// hotel where the flight lands and a tee time there, which waits for the offer, the only thing
// that says which city that is. On a phone the summary comes before that button, so the receipt
// reads through before the way out of it.
export function FlightConfirmedScreen({
    palette, offer, loadingOffer, bookingId, pnr, origin, destination, departureDate, cabin,
    currency, total, adults, childPassengers, infants, passengers, contactEmail,
    backLabel, onBack, onHome, onTrips,
}: FlightConfirmedScreenProps) {
    const tAll = useTranslations();
    const t = useTranslations('checkout');
    const locale = useLocale();
    const [copied, setCopied] = useState(false);

    // The receipt states what the card was charged, in the currency it was charged in — that is a
    // fact, and it does not move with the selector. The selector's currency gets a second line, an
    // estimate at today's rate; it is left out until the rates are live, and when the two are the
    // same currency.
    const userCurrency = useUserCurrency();
    useLiveRates();
    const approx = convertForDisplay(total, currency, userCurrency);
    const approxShown = approx.currency !== currency;

    const totalPax = adults + childPassengers + infants;
    const slices: NormalizedSegment[][] = offer ? groupSegmentsIntoSlices(offer.segments) : [];

    const firstSegment = slices[0]?.[0];
    // Where the outbound lands — not the last slice, which on a round trip lands back home.
    const stay = arrivalStay(slices);
    const destinationCity = stay?.city;

    const isRefundable = offer ? (offer.farePolicy ? offer.farePolicy.isRefundable : offer.refundable) : false;
    const penalty = offer?.farePolicy?.refundPenaltyAmount;
    const refundLabel = !isRefundable
        ? tAll('flights.card.nonRefundable')
        : penalty === 0
            ? tAll('flights.card.freeCancellation')
            : tAll('checkout.flight.receipt.refundable');
    const checkedBags = offer?.baggage?.checkedBags ?? 0;
    const cabinName = (firstSegment?.cabinClass ?? cabin ?? '').replace(/_/g, ' ');
    const loadingItinerary = loadingOffer && !offer;

    const handleCopy = async () => {
        if (!bookingId) return;
        try {
            await navigator.clipboard.writeText(bookingId);
            setCopied(true);
            toast.success(tAll('checkout.flight.receipt.copyReferenceDone'));
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access denied or unavailable — the reference is still on screen to
            // select by hand, so this fails quietly rather than with an error the traveller
            // can do nothing about.
        }
    };

    // The form's two headings: a section's spaced capitals, and a group's sentence case under a
    // hairline (`sectionLabelStyle` and `groupTitleStyle` on the checkout page).
    const sectionLabel: React.CSSProperties = { fontWeight: 700, fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: palette.title, margin: 0 };
    const group: React.CSSProperties = { marginTop: 28, paddingTop: 24, borderTop: `1px solid ${palette.hairline}` };
    const groupTitle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: palette.title, margin: '0 0 16px' };

    // The summary card's parts, as on the form's.
    const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, color: palette.text };
    const rule = (margin: string) => <div aria-hidden style={{ height: 1, background: palette.cardLine, margin }} />;
    // A quiet action beside the main one: text, but a 44px target.
    const textBtn = (color: string): React.CSSProperties => ({
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 8px', border: 'none',
        background: 'transparent', color, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
    });

    /** One end of a flight: what it is, the airport by full name and code, the day and the clock,
     *  and the terminal when the airline gave one. */
    const end = (caption: string, e: NormalizedSegment['departure'], code: string) => (
        <div>
            <div style={{ fontSize: 12, color: palette.muted }}>{caption}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: palette.title, marginTop: 2 }}>{airportLabel(e, code)}</div>
            <div style={{ fontSize: 13, color: palette.text, marginTop: 2, fontFamily: MONO }}>
                <span>{formatDateTimeLocale(e.time, locale)}</span>
                {/* The terminal wraps as one piece, never as "Terminal" at a line's end and its number below. */}
                {e.terminal && <>{' '}<span style={{ whiteSpace: 'nowrap' }}>· <span>{tAll('checkout.flight.receipt.terminal')} {e.terminal}</span></span></>}
            </div>
        </div>
    );

    const paxLabel = (p: FlightPassengerInfo, i: number) => {
        // Numbered within its own type, as the airline lists them and the form headed them.
        const nth = passengers.slice(0, i + 1).filter(q => q.type === p.type).length;
        return p.type === 'CHD' ? tAll('checkout.userDetails.childN', { n: nth })
            : p.type === 'INF' ? tAll('checkout.flight.infantN', { n: nth })
                : tAll('checkout.flight.adultN', { n: nth });
    };

    return (
        <div className="cg-receipt" style={{ minHeight: '100vh', background: palette.bg, color: palette.text }}>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: #fff !important; }
                    .cg-receipt, .cg-receipt * { color: #000 !important; box-shadow: none !important; }
                    .cg-receipt { background: #fff !important; }
                    .receipt-card { background: #fff !important; border: 1px solid #ddd !important; }
                }
            `}</style>

            <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,44px) 80px' }}>
                <CheckoutToolbar palette={palette} backLabel={backLabel} onBack={onBack} />

                {/* The form's grid: the form's column on the left, the steps and the summary on the right. */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,645px)_minmax(300px,370px)] lg:justify-between gap-x-[clamp(40px,8vw,130px)]">
                    <div className="no-print lg:col-start-2 lg:row-start-1 flex lg:justify-center mb-8 lg:mb-0 lg:pt-1.5">
                        <DoneSteps palette={palette} />
                    </div>

                    <div className="lg:col-start-1 lg:row-start-1">
                        <h1 className="font-bold tracking-[-0.01em]" style={{ fontSize: 'clamp(32px,4.4vw,60px)', lineHeight: 1.05, color: palette.title, margin: 0 }}>
                            {tAll('checkout.flight.receipt.allSet')}
                        </h1>
                        <p style={{ fontSize: 'clamp(19px,2.2vw,32px)', fontWeight: 400, lineHeight: 1.25, color: palette.text, margin: '10px 0 0' }}>
                            {tAll('checkout.flight.receipt.confirmedToDestination', { destination: destinationCity ?? destination })}
                        </p>
                    </div>

                    {/* What the form collected, shown back */}
                    <div className="lg:col-start-1 lg:row-start-2 min-w-0" style={{ marginTop: 30 }}>
                        {/* Our reference, and where the receipt went */}
                        <section aria-labelledby="cg-ref-title">
                            <h2 id="cg-ref-title" style={sectionLabel}>{t('bookingReference')}</h2>
                            <p style={{ fontSize: 'var(--cg-note-fs)', lineHeight: 1.45, color: palette.muted, margin: '6px 0 0' }}>
                                {tAll('checkout.flight.receipt.receiptSentTo', { email: contactEmail })}
                            </p>
                            {bookingId && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                    {/* The link blue: blue-400 on the dark field, blue-600 on the light. */}
                                    <div title={bookingId} style={{ ...fieldBox(palette), flex: 1, fontFamily: MONO, color: palette.icon }}>
                                        <span style={ellipsis}>{bookingId}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="no-print"
                                        style={{ ...fieldBox(palette), flexShrink: 0, gap: 8, color: palette.title, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        {copied ? <CopyCheck aria-hidden size={15} /> : <Copy aria-hidden size={15} />}
                                        {copied ? tAll('checkout.flight.receipt.copyReferenceDone') : tAll('checkout.flight.receipt.copyReference')}
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* The airline, its reference, and what the fare includes */}
                        <section aria-labelledby="cg-flight-title" style={group}>
                            <h2 id="cg-flight-title" style={groupTitle}>{tAll('checkout.summary.flight')}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                                <AirlineAvatar code={firstSegment?.airline} palette={palette} />
                                <div style={{ minWidth: 0 }}>
                                    {loadingItinerary ? (
                                        <div aria-busy="true" style={{ display: 'grid', gap: 6 }}>
                                            <SkeletonBar palette={palette} width={150} height={15} />
                                            <SkeletonBar palette={palette} width={110} height={12} />
                                            <span className="sr-only">{tAll('checkout.flight.receipt.loadingItinerary')}</span>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 15, fontWeight: 600, color: palette.title }}>
                                            {firstSegment ? (firstSegment.airlineName || firstSegment.airline) : `${origin} → ${destination}`}
                                        </div>
                                    )}
                                    {!loadingItinerary && (firstSegment?.flightNumber || pnr) && (
                                        <div style={{ fontSize: 13, color: palette.muted, marginTop: 2, fontFamily: MONO }}>
                                            {[firstSegment?.flightNumber, pnr && `${tAll('trips.pnr')} ${pnr}`].filter(Boolean).join(' · ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {offer && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                                    <Pill palette={palette}>{refundLabel}</Pill>
                                    {cabinName && <Pill palette={palette}><span style={{ textTransform: 'capitalize' }}>{cabinName}</span></Pill>}
                                    {offer.baggage?.cabinBag && <Pill palette={palette}>{tAll('checkout.flight.receipt.carryOnBag')}</Pill>}
                                    {checkedBags > 0 && <Pill palette={palette}>{tAll('checkout.flight.receipt.checkedBagsCount', { count: checkedBags })}</Pill>}
                                </div>
                            )}
                        </section>

                        {/* Who flies — and, on the lead, where the e-ticket went */}
                        <div style={group}>
                            {passengers.map((p, i) => (
                                <section key={i} aria-labelledby={`cg-pax-${i}`} style={{ marginTop: i ? 28 : 0 }}>
                                    <h2 id={`cg-pax-${i}`} style={sectionLabel}>{paxLabel(p, i)}</h2>
                                    <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', columnGap: 12, rowGap: 16, margin: '16px 0 0' }}>
                                        <ShownField label={tAll('checkout.userDetails.firstName')} value={p.firstName} palette={palette} />
                                        <ShownField label={tAll('checkout.userDetails.lastName')} value={p.lastName} palette={palette} />
                                        {i === 0 && contactEmail && <ShownField label={tAll('checkout.userDetails.email')} value={contactEmail} palette={palette} />}
                                    </dl>
                                </section>
                            ))}
                        </div>
                    </div>

                    {/* Right: the summary, under the steps, as through the checkout */}
                    <aside className="lg:col-start-2 lg:row-start-2 lg:row-span-2 mt-10 lg:mt-0 lg:pt-[30px]">
                        <div style={{ position: 'sticky', top: 24 }}>
                            <div className="receipt-card" style={{ background: palette.surface, borderRadius: 12, padding: '18px 30px 26px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17, color: palette.title }}>
                                    <span>{origin}</span>
                                    <ArrowRight aria-hidden size={16} />
                                    <span>{destination}</span>
                                </div>
                                <div style={{ fontSize: 13, color: palette.muted, marginTop: 4 }}>
                                    {cabinName && <><span style={{ textTransform: 'capitalize' }}>{cabinName}</span> · </>}
                                    {tAll('checkout.flight.receipt.passengersCount', { count: totalPax })}
                                </div>

                                {/* Where it leaves and where it lands, once for each direction */}
                                {slices.map((segs, idx) => {
                                    const first = segs[0];
                                    const last = segs[segs.length - 1];
                                    return (
                                        <div key={idx} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                                            {slices.length > 1 && (
                                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.faint }}>
                                                    {idx === 0 ? tAll('checkout.flight.receipt.outbound') : tAll('checkout.flight.receipt.return')}
                                                </div>
                                            )}
                                            {end(tAll('checkout.flight.receipt.departFrom'), first.departure, first.origin)}
                                            {end(tAll('checkout.flight.receipt.arriveAt'), last.arrival, last.destination)}
                                        </div>
                                    );
                                })}
                                {loadingItinerary && (
                                    <div aria-busy="true" style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                                        {[0, 1].map(i => (
                                            <div key={i} style={{ display: 'grid', gap: 7 }}>
                                                <SkeletonBar palette={palette} width={64} height={10} />
                                                <SkeletonBar palette={palette} width="72%" height={14} />
                                                <SkeletonBar palette={palette} width="54%" height={12} />
                                            </div>
                                        ))}
                                        <span className="sr-only">{tAll('checkout.flight.receipt.loadingItinerary')}</span>
                                    </div>
                                )}
                                {/* The offer could not be read: the day the link carried. */}
                                {!offer && !loadingOffer && departureDate && (
                                    <div style={{ fontSize: 13, color: palette.text, marginTop: 12, fontFamily: MONO }}>
                                        {new Date(`${departureDate}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                    </div>
                                )}

                                {rule('16px 0 12px')}

                                {/* What was paid. One fare line: the service fee is part of it. */}
                                <div style={{ display: 'grid', gap: 8 }}>
                                    <div style={row}>
                                        <span>{tAll('checkout.flight.receipt.fareLine', { count: totalPax })}</span>
                                        <span style={{ fontFamily: MONO }}>{formatMoney(total, currency)}</span>
                                    </div>
                                    <div style={row}>
                                        <span>{tAll('checkout.flight.receipt.taxesAndFees')}</span>
                                        <span style={{ color: palette.muted }}>{tAll('checkout.flight.receipt.includedLabel')}</span>
                                    </div>
                                </div>

                                {rule('12px 0')}

                                <div style={{ ...row, fontSize: 14, fontWeight: 700, color: palette.title }}>
                                    <span>{t('totalPaid')}</span>
                                    <span style={{ fontFamily: MONO }}>{formatMoney(total, currency)}</span>
                                </div>
                                {approxShown && (
                                    <div style={{ ...row, fontSize: 12, color: palette.muted, marginTop: 6 }}>
                                        <span>{tAll('checkout.flight.receipt.approxTotal', { currency: approx.currency })}</span>
                                        <span style={{ fontFamily: MONO }}>≈ {formatMoney(approx.amount, approx.currency)}</span>
                                    </div>
                                )}
                                <div style={{ fontSize: 12, color: palette.muted, marginTop: 10 }}>{tAll('checkout.flight.receipt.paymentProcessedSecurely')}</div>
                            </div>
                        </div>
                    </aside>

                    {/* Where to go next */}
                    <div className="no-print lg:col-start-1 lg:row-start-3 min-w-0" style={{ marginTop: 36 }}>
                        {/* The form's main action, in the same place: a full-width pill in the brand gradient. */}
                        <button
                            type="button"
                            onClick={onTrips}
                            style={{
                                width: '100%', padding: '17px 0', borderRadius: 999, border: 'none',
                                background: ACCENT_FILL, color: '#fff', boxShadow: BRAND.gradientShadow,
                                fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            {tAll('checkout.flight.receipt.viewBookings')}
                        </button>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 20px', marginTop: 8 }}>
                            <button type="button" onClick={() => window.print()} style={textBtn(palette.title)}>
                                <Download aria-hidden size={15} /> {tAll('checkout.success.downloadReceipt')}
                            </button>
                            <button type="button" onClick={onHome} style={textBtn(palette.icon)}>
                                {t('planAnotherTrip')}
                            </button>
                        </div>

                        {stay && <TripNextSteps palette={palette} stay={stay} adults={adults} childPassengers={childPassengers} />}
                    </div>
                </div>
            </div>
        </div>
    );
}

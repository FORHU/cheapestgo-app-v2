'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Armchair, BaggageClaim, Copy, CopyCheck, Download, Luggage } from 'lucide-react';
import { ACCENT, ACCENT_FILL, type Palette } from '@/features/checkout/lib/palette';
import { BRAND } from '@/shared/lib/palette';
import { airportLabel, formatDateTimeLocale, groupSegmentsIntoSlices } from '@/features/flights/lib/flight-utils';
import type { FlightOffer, NormalizedSegment } from '@/shared/types';
import { formatMoney } from '@/features/checkout/lib/format-money';
import { CheckoutToolbar } from './checkout-toolbar';
import { SkeletonBar } from './skeleton-bar';
import { useUserCurrency } from '@/shared/stores/search.store';
import { convertForDisplay } from '@/shared/lib/currency';
import { useLiveRates } from '@/shared/lib/use-live-rates';

// ─── Small pieces ───────────────────────────────────────────────────────────────

/** The airline's logo, same CDN the rest of the app reads it from. A plain disc stands in
 *  while there is none to show — an airline the CDN has no logo for, or the offer not read yet. */
function AirlineAvatar({ code, palette }: { code?: string; palette: Palette }) {
    const [broken, setBroken] = useState(false);
    return (
        <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: palette.stepIdle, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {code && !broken && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`https://images.kiwi.com/airlines/64/${code}.png`}
                    alt={code}
                    style={{ width: 36, height: 36, objectFit: 'contain' }}
                    onError={() => setBroken(true)}
                />
            )}
        </div>
    );
}

function Pill({ children, palette }: { children: React.ReactNode; palette: Palette }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999,
            fontSize: 14, background: palette.stepIdle, color: palette.title,
        }}>
            {children}
        </span>
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
    /** The airline's own record locator. The booking reference below the card is ours; an
     *  airport kiosk or the airline's own app asks for theirs. Shown only when
     *  `/flights/confirm` returned one. */
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
// As designed: a heading, one sentence saying where the flight goes and where the receipt went,
// and a single card — the airline, its reference and what the fare includes across the top;
// where the flight leaves and where it lands beneath; what was paid at the foot. The itinerary's
// detail — airport names, terminals, bags, fare terms — comes from the offer the page read, a
// GET the URL's own params never carried; everything else (the fare paid, who flew, where the
// e-ticket went) is what the booking itself already knows, so it is never blocked on that fetch.
//
// The fare is one figure: the service fee is part of it, as the checkout's summary has it.
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
    const lastSlice = slices[slices.length - 1];
    const destinationCity = lastSlice?.[lastSlice.length - 1]?.arrival?.city;

    const isRefundable = offer ? (offer.farePolicy ? offer.farePolicy.isRefundable : offer.refundable) : false;
    const penalty = offer?.farePolicy?.refundPenaltyAmount;
    const refundLabel = !isRefundable
        ? tAll('flights.card.nonRefundable')
        : penalty === 0
            ? tAll('flights.card.freeCancellation')
            : tAll('checkout.flight.receipt.refundable');
    const checkedBags = offer?.baggage?.checkedBags ?? 0;
    const cabinName = (firstSegment?.cabinClass ?? cabin ?? '').replace(/_/g, ' ');

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

    const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 15, color: palette.text };
    const rule = <div aria-hidden style={{ height: 1, background: palette.cardLine, margin: 'clamp(20px,2.5vw,28px) 0' }} />;
    const outlineBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', borderRadius: 100, border: `1.5px solid ${palette.summaryBorder}`, background: 'transparent', color: palette.title, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' };

    /** One end of a flight: what it is, the airport by full name and code, the day and the clock. */
    const end = (caption: string, e: NormalizedSegment['departure'], code: string) => (
        <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: palette.title }}>{caption}</div>
            <div style={{ fontSize: 15, color: palette.text, marginTop: 6 }}>{airportLabel(e, code)}</div>
            <div style={{ fontSize: 15, color: palette.text, marginTop: 2 }}>{formatDateTimeLocale(e.time, locale)}</div>
            {e.terminal && <div style={{ fontSize: 15, color: palette.text, marginTop: 2 }}>{tAll('checkout.flight.receipt.terminal')} {e.terminal}</div>}
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: palette.bg, color: palette.text }}>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: #fff !important; color: #000 !important; }
                    .receipt-card { background: #fff !important; border: 1px solid #ddd !important; color: #000 !important; box-shadow: none !important; }
                    .receipt-card * { color: #000 !important; }
                }
            `}</style>

            <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,44px) 80px' }}>
                <CheckoutToolbar palette={palette} backLabel={backLabel} onBack={onBack} />
                <h1 className="font-bold tracking-[-0.01em]" style={{ fontSize: 'clamp(36px,4.4vw,60px)', lineHeight: 1.05, color: palette.title, margin: 0 }}>
                    {tAll('checkout.flight.receipt.allSet')}
                </h1>
                <p style={{ fontSize: 'clamp(19px,2.2vw,32px)', fontWeight: 400, lineHeight: 1.25, color: palette.text, margin: '10px 0 0' }}>
                    {tAll('checkout.flight.receipt.confirmedSentTo', { destination: destinationCity ?? destination, email: contactEmail })}
                </p>

                <div className="receipt-card" style={{ background: palette.surface, borderRadius: 12, padding: 'clamp(20px,3vw,36px)', marginTop: 'clamp(24px,3vw,40px)' }}>
                    {/* The airline, its reference, and what the fare includes */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                            <AirlineAvatar code={firstSegment?.airline} palette={palette} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 16, color: palette.title }}>{firstSegment ? (firstSegment.airlineName || firstSegment.airline) : `${origin} → ${destination}`}</div>
                                {(firstSegment?.flightNumber || pnr) && (
                                    <div style={{ fontSize: 15, color: palette.faint, marginTop: 2 }}>
                                        {[firstSegment?.flightNumber, pnr && `${tAll('trips.pnr')} ${pnr}`].filter(Boolean).join(' · ')}
                                    </div>
                                )}
                            </div>
                        </div>
                        {offer && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <Pill palette={palette}>{refundLabel}</Pill>
                                {cabinName && <Pill palette={palette}><Armchair size={14} /> <span style={{ textTransform: 'capitalize' }}>{cabinName}</span></Pill>}
                                {offer.baggage?.cabinBag && <Pill palette={palette}><Luggage size={14} /> {tAll('checkout.flight.receipt.carryOnBag')}</Pill>}
                                {checkedBags > 0 && <Pill palette={palette}><BaggageClaim size={14} /> {tAll('checkout.flight.receipt.checkedBagsCount', { count: checkedBags })}</Pill>}
                            </div>
                        )}
                    </div>

                    {/* Where it leaves and where it lands, once for each direction */}
                    {offer ? slices.map((segs, idx) => {
                        const first = segs[0];
                        const last = segs[segs.length - 1];
                        return (
                            <div key={idx} style={{ marginTop: 'clamp(20px,2.5vw,28px)' }}>
                                {slices.length > 1 && (
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: palette.faint, marginBottom: 12 }}>
                                        {idx === 0 ? tAll('checkout.flight.receipt.outbound') : tAll('checkout.flight.receipt.return')}
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px 32px' }}>
                                    {end(tAll('checkout.flight.receipt.departFrom'), first.departure, first.origin)}
                                    {end(tAll('checkout.flight.receipt.arriveAt'), last.arrival, last.destination)}
                                </div>
                            </div>
                        );
                    }) : (
                        <div style={{ marginTop: 'clamp(20px,2.5vw,28px)', fontSize: 15, color: palette.text }}>
                            {departureDate && <div>{new Date(`${departureDate}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>}
                            {loadingOffer && (
                                <div aria-busy="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px 32px', marginTop: 16 }}>
                                    {[0, 1].map(i => (
                                        <div key={i} style={{ display: 'grid', gap: 8 }}>
                                            <SkeletonBar palette={palette} width={84} height={14} />
                                            <SkeletonBar palette={palette} width="80%" height={15} />
                                            <SkeletonBar palette={palette} width="60%" height={15} />
                                        </div>
                                    ))}
                                    <span className="sr-only">{tAll('checkout.flight.receipt.loadingItinerary')}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {rule}

                    {/* What was paid. One fare line: the service fee is part of it. */}
                    <div style={{ fontWeight: 700, fontSize: 15, color: palette.title, marginBottom: 14 }}>{tAll('checkout.flight.receipt.paymentSummary')}</div>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div style={row}>
                            <span>{tAll('checkout.flight.receipt.fareLine', { count: totalPax })}</span>
                            <span>{formatMoney(total, currency)}</span>
                        </div>
                        <div style={row}>
                            <span>{tAll('checkout.flight.receipt.taxesAndFees')}</span>
                            <span style={{ color: palette.muted }}>{tAll('checkout.flight.receipt.includedLabel')}</span>
                        </div>
                        <div style={{ ...row, fontWeight: 700, color: palette.title, paddingTop: 12, borderTop: `1px solid ${palette.cardLine}`, marginTop: 4 }}>
                            <span>{t('totalPaid')}</span>
                            <span>{formatMoney(total, currency)}</span>
                        </div>
                        {approxShown && (
                            <div style={{ ...row, fontSize: 13, color: palette.muted }}>
                                <span>{tAll('checkout.flight.receipt.approxTotal', { currency: approx.currency })}</span>
                                <span>≈ {formatMoney(approx.amount, approx.currency)}</span>
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: palette.faint, marginTop: 14 }}>{tAll('checkout.flight.receipt.paymentProcessedSecurely')}</div>

                    {rule}

                    {/* Who flies, and where the e-ticket went */}
                    <div style={{ fontWeight: 700, fontSize: 15, color: palette.title, marginBottom: 14 }}>{tAll('checkout.flight.receipt.passengerSectionTitle')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 24px' }}>
                        {passengers.map((p, i) => {
                            const nth = passengers.slice(0, i + 1).filter(q => q.type === p.type).length;
                            const label = p.type === 'CHD' ? tAll('checkout.userDetails.childN', { n: nth })
                                : p.type === 'INF' ? tAll('checkout.flight.infantN', { n: nth })
                                    : tAll('checkout.flight.adultN', { n: nth });
                            const name = `${p.firstName} ${p.lastName}`.trim();
                            return (
                                <div key={i}>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontSize: 15, color: palette.title }}>{name || '—'}</div>
                                </div>
                            );
                        })}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>{tAll('checkout.flight.receipt.contact')}</div>
                            <div style={{ fontSize: 15, color: palette.title, wordBreak: 'break-word' }}>{contactEmail}</div>
                        </div>
                    </div>
                </div>

                {/* Our reference, and where to go next */}
                <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginTop: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: palette.faint, textTransform: 'uppercase', marginBottom: 2 }}>{t('bookingReference')}</div>
                            <div style={{ fontFamily: "var(--font-mono), 'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: '.04em', color: ACCENT }}>{bookingId}</div>
                        </div>
                        {bookingId && (
                            <button onClick={handleCopy} style={{ ...outlineBtn, padding: '8px 16px', fontSize: 13 }}>
                                {copied ? <CopyCheck size={14} /> : <Copy size={14} />}
                                {copied ? tAll('checkout.flight.receipt.copyReferenceDone') : tAll('checkout.flight.receipt.copyReference')}
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => window.print()} style={outlineBtn}>
                            <Download size={15} /> {tAll('checkout.success.downloadReceipt')}
                        </button>
                        <button
                            onClick={onTrips}
                            style={{ ...outlineBtn, border: 'none', background: ACCENT_FILL, boxShadow: BRAND.gradientShadow, color: '#fff' }}
                        >
                            {tAll('checkout.flight.receipt.viewBookings')}
                        </button>
                        <button
                            onClick={onHome}
                            style={{ border: 'none', background: 'transparent', color: ACCENT, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}
                        >
                            {t('planAnotherTrip')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

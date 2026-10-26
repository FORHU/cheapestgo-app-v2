'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
    ArrowLeft, ArrowLeftRight, Armchair, BaggageClaim, Calendar, Check, Copy, CopyCheck,
    Download, Luggage, Plane, Users,
} from 'lucide-react';
import { ACCENT, ACCENT_FILL, GREEN, type Palette } from '@/features/checkout/lib/palette';
import { BRAND } from '@/shared/lib/palette';
import { formatDuration, formatTime, groupSegmentsIntoSlices, stopsLabel } from '@/features/flights/lib/flight-utils';
import type { FlightOffer, NormalizedSegment } from '@/shared/types';
import { formatMoney, moneyFigure } from '@/features/checkout/lib/format-money';

// ─── Small pieces ───────────────────────────────────────────────────────────────

/** The airline's logo, same CDN the rest of the app reads it from — the two-letter code
 *  stands in, Duffel-sandbox-style, for an airline the CDN has no logo for. */
function AirlineAvatar({ code }: { code: string }) {
    const [broken, setBroken] = useState(false);
    return (
        <div style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: `${ACCENT}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {!broken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`https://images.kiwi.com/airlines/64/${code}.png`}
                    alt={code}
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                    onError={() => setBroken(true)}
                />
            ) : (
                <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{code}</span>
            )}
        </div>
    );
}

/** A labelled fact — the small uppercase caption over a value — repeated throughout. */
function Fact({ label, children, palette }: { label: string; children: React.ReactNode; palette: Palette }) {
    return (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>
                {label}
            </div>
            {children}
        </div>
    );
}

function Pill({ children, tone, palette }: { children: React.ReactNode; tone?: 'green'; palette: Palette }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
            fontSize: 12, fontWeight: 600,
            background: tone === 'green' ? `${GREEN}1f` : palette.surface,
            color: tone === 'green' ? GREEN : palette.soft,
        }}>
            {children}
        </span>
    );
}

// ─── Date/time formatting ────────────────────────────────────────────────────────
// Segment times are Local Airport Time digits with no zone attached — see `formatTime`'s own
// note. Pinned to UTC before formatting, for the same reason `formatOfferDate` is: reading them
// through a bare `new Date(iso)` would print a different calendar day for half the planet.

function fmtFlightDate(iso?: string): string {
    if (!iso) return '';
    const day = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(day)) return '';
    return new Date(day).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortDate(iso?: string): string {
    if (!iso) return '';
    const day = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(day)) return '';
    return new Date(day).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

function cityLabel(code: string, city?: string): string {
    return city ? `${city} (${code})` : code;
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
    /** The airline's own record locator — not shown in the reference design but worth keeping
     *  on screen: the booking reference above is ours, and an airport kiosk or the airline's
     *  own app asks for theirs. Shown only when `/flights/confirm` returned one. */
    pnr:           string | null;
    origin:        string;
    destination:   string;
    departureDate: string;
    cabin?:        string;
    currency:      string;
    /** What the card was held for. */
    total:         number;
    /** The airline's fare and our service fee within `total`, when the server said. */
    fare?:         number;
    serviceFee?:   number;
    adults:        number;
    /** Named `childPassengers`, not `children` — the latter collides with React's own prop. */
    childPassengers: number;
    infants:       number;
    passengers:    FlightPassengerInfo[];
    contactEmail:  string;
    onBack:        () => void;
    onHome:        () => void;
    onTrips:       () => void;
}

// ─── The screen ───────────────────────────────────────────────────────────────
//
// Built for its own layout rather than squeezed into the hotel's single-card receipt: a
// toolbar naming the trip, the itinerary as a boarding-pass-style card (one block per slice —
// outbound, and the return when there is one) beside a payment summary, and the travellers
// below both. The itinerary's detail — terminals, airport names, duration, bags, fare terms —
// comes from the offer the page read, a GET the URL's own params never carried; everything else
// (the fare paid, who flew, where the e-ticket went) is what the booking itself already knows,
// so it is never blocked on that fetch.
export function FlightConfirmedScreen({
    palette, offer, loadingOffer, bookingId, pnr, origin, destination, departureDate, cabin,
    currency, total, fare, serviceFee, adults, childPassengers, infants, passengers, contactEmail,
    onBack, onHome, onTrips,
}: FlightConfirmedScreenProps) {
    const tAll = useTranslations();
    const t = useTranslations('checkout');
    const loading = loadingOffer;
    const [copied, setCopied] = useState(false);

    const totalPax = adults + childPassengers + infants;
    const slices: NormalizedSegment[][] = offer ? groupSegmentsIntoSlices(offer.segments) : [];

    const originCity = slices[0]?.[0]?.departure?.city;
    const lastSlice = slices[slices.length - 1];
    const destinationCity = lastSlice?.[lastSlice.length - 1]?.arrival?.city;

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

    const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13 };
    const outlineBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', borderRadius: 100, border: `1.5px solid ${palette.summaryBorder}`, background: 'transparent', color: palette.title, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' };

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

            <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(16px,3vw,40px)', paddingBottom: 80 }}>
                {/* Toolbar: back, the route, the date/party/cabin */}
                <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, background: palette.menuBg, border: `1px solid ${palette.summaryBorder}`, borderRadius: 18, padding: '12px 20px', marginBottom: 28 }}>
                    <button
                        onClick={onBack}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: palette.title, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                        <ArrowLeft size={16} /> {tAll('property.v2.goBack')}
                    </button>
                    <span aria-hidden style={{ width: 1, height: 18, background: palette.hairline }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: palette.title }}>
                        {cityLabel(origin, originCity)} <ArrowLeftRight size={13} color={palette.faint} /> {cityLabel(destination, destinationCity)}
                    </span>
                    <span aria-hidden style={{ width: 1, height: 18, background: palette.hairline }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: palette.soft }}>
                        <Calendar size={13} color={palette.faint} />
                        {fmtShortDate(departureDate)} · {tAll('checkout.flight.receipt.passengersCount', { count: totalPax })}
                        {cabin && <span style={{ textTransform: 'capitalize' }}> · {cabin.replace(/_/g, ' ')}</span>}
                    </span>
                </div>

                {/* Hero */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 0 28px' }}>
                    <div style={{ width: 96, height: 96, borderRadius: '50%', background: `${GREEN}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <Check size={28} strokeWidth={3} />
                        </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 28, color: palette.title, marginTop: 20 }}>
                        {t('allSet')}
                    </div>
                    <div style={{ fontSize: 13, color: palette.muted, marginTop: 6 }}>
                        {tAll('checkout.flight.receipt.confirmedToDestination', { destination: destinationCity ?? destination })}{' '}
                        {tAll.rich('checkout.flight.receipt.receiptSentRich', { email: contactEmail, b: (c) => <strong style={{ color: palette.soft }}>{c}</strong> })}
                    </div>
                </div>

                {/* Booking reference */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 20, background: palette.menuBg, border: `1px solid ${palette.summaryBorder}`, borderRadius: 18, padding: '18px 28px', marginBottom: 32 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>{t('bookingReference')}</div>
                        <div style={{ fontFamily: "var(--font-mono), 'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: '.04em', color: ACCENT }}>{bookingId}</div>
                    </div>
                    {bookingId && (
                        <button onClick={handleCopy} className="no-print" style={{ ...outlineBtn, padding: '8px 16px', fontSize: 13 }}>
                            {copied ? <CopyCheck size={14} /> : <Copy size={14} />}
                            {copied ? tAll('checkout.flight.receipt.copyReferenceDone') : tAll('checkout.flight.receipt.copyReference')}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,660px)_minmax(300px,380px)] lg:justify-between gap-x-[clamp(32px,6vw,80px)] gap-y-8">
                    {/* Flight details */}
                    <div className="receipt-card" style={{ background: palette.summaryBg, border: `1px solid ${palette.summaryBorder}`, borderRadius: 24, overflow: 'hidden' }}>
                        <div style={{ padding: 28 }}>
                            {offer ? slices.map((segs, idx) => {
                                const first = segs[0];
                                const last = segs[segs.length - 1];
                                const duration = offer.sliceDurations?.[first.segmentIndex]
                                    ?? segs.reduce((n, s) => n + (s.duration ?? 0), 0);
                                const stops = segs.length - 1;
                                const isRefundable = offer.farePolicy ? offer.farePolicy.isRefundable : offer.refundable;
                                const penalty = offer.farePolicy?.refundPenaltyAmount;
                                const refundLabel = !isRefundable
                                    ? tAll('flights.card.nonRefundable')
                                    : penalty === 0
                                        ? tAll('flights.card.freeCancellation')
                                        : tAll('checkout.flight.receipt.refundable');
                                const checkedBags = offer.baggage?.checkedBags ?? 0;

                                return (
                                    <div key={idx} style={idx > 0 ? { marginTop: 28, paddingTop: 28, borderTop: `1px solid ${palette.hairline}` } : undefined}>
                                        {slices.length > 1 && (
                                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: palette.faint, marginBottom: 12 }}>
                                                {idx === 0 ? tAll('checkout.flight.receipt.outbound') : tAll('checkout.flight.receipt.return')}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                <AirlineAvatar code={first.airline} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 800, fontSize: 17, color: palette.title }}>{first.airlineName || first.airline}</div>
                                                    <div style={{ fontSize: 12, color: palette.muted, marginTop: 1 }}>
                                                        {first.flightNumber} · {fmtFlightDate(first.departure.time)}
                                                        {idx === 0 && pnr && ` · ${tAll('trips.pnr')} ${pnr}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <Pill tone="green" palette={palette}>
                                                <Check size={12} /> {tAll('checkout.flight.receipt.confirmedBadge')}
                                            </Pill>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div>
                                                <div style={{ fontSize: 26, fontWeight: 800, color: palette.title, lineHeight: 1 }}>{formatTime(first.departure.time)}</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: palette.muted, marginTop: 4 }}>{first.origin}</div>
                                            </div>
                                            <div style={{ flex: 1, textAlign: 'center', minWidth: 60 }}>
                                                <div style={{ fontSize: 11, color: palette.faint, marginBottom: 4 }}>{formatDuration(duration)}</div>
                                                <div style={{ position: 'relative', height: 1, background: palette.cardLine }}>
                                                    <Plane size={13} color={ACCENT} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(90deg)', background: palette.summaryBg, padding: '0 2px' }} />
                                                </div>
                                                <div style={{ fontSize: 11, color: palette.faint, marginTop: 4 }}>{stopsLabel(stops)}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 26, fontWeight: 800, color: palette.title, lineHeight: 1 }}>{formatTime(last.arrival.time)}</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: palette.muted, marginTop: 4 }}>{last.destination}</div>
                                            </div>
                                        </div>

                                        <div style={{ height: 1, background: palette.hairline, margin: '20px 0' }} />

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                                            <Fact label={tAll('checkout.flight.receipt.departFrom')} palette={palette}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: palette.title }}>{first.departure.airportName || first.origin}</div>
                                                <div style={{ fontSize: 11, color: palette.muted, marginTop: 2 }}>{fmtFlightDate(first.departure.time)} · {formatTime(first.departure.time)}</div>
                                                {first.departure.terminal && <div style={{ fontSize: 11, color: palette.faint, marginTop: 1 }}>{tAll('checkout.flight.receipt.terminal')} {first.departure.terminal}</div>}
                                            </Fact>
                                            <Fact label={tAll('checkout.flight.receipt.arriveAt')} palette={palette}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: palette.title }}>{last.arrival.airportName || last.destination}</div>
                                                <div style={{ fontSize: 11, color: palette.muted, marginTop: 2 }}>{fmtFlightDate(last.arrival.time)} · {formatTime(last.arrival.time)}</div>
                                                {last.arrival.terminal && <div style={{ fontSize: 11, color: palette.faint, marginTop: 1 }}>{tAll('checkout.flight.receipt.terminal')} {last.arrival.terminal}</div>}
                                            </Fact>
                                        </div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
                                            <Pill tone={isRefundable ? 'green' : undefined} palette={palette}>{refundLabel}</Pill>
                                            {first.cabinClass && (
                                                <Pill palette={palette}><Armchair size={13} /> <span style={{ textTransform: 'capitalize' }}>{first.cabinClass.replace(/_/g, ' ')}</span></Pill>
                                            )}
                                            {offer.baggage?.cabinBag && (
                                                <Pill palette={palette}><Luggage size={13} /> {tAll('checkout.flight.receipt.carryOnBag')}</Pill>
                                            )}
                                            {checkedBags > 0 && (
                                                <Pill palette={palette}><BaggageClaim size={13} /> {tAll('checkout.flight.receipt.checkedBagsCount', { count: checkedBags })}</Pill>
                                            )}
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 20, color: palette.title }}>{origin} → {destination}</div>
                                    {departureDate && <div style={{ fontSize: 13, color: palette.muted, marginTop: 4 }}>{fmtFlightDate(departureDate)}</div>}
                                    {cabin && <div style={{ fontSize: 13, color: palette.soft, marginTop: 2, textTransform: 'capitalize' }}>{cabin.replace(/_/g, ' ')}</div>}
                                    {loading && <div style={{ fontSize: 12, color: palette.muted, marginTop: 16 }}>{tAll('checkout.flight.receipt.loadingItinerary')}</div>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment summary + actions */}
                    <div style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
                        <div className="receipt-card" style={{ background: palette.summaryBg, border: `1px solid ${palette.summaryBorder}`, borderRadius: 20, padding: '22px 24px' }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: palette.title, marginBottom: 16 }}>{tAll('checkout.flight.receipt.paymentSummary')}</div>
                            <div style={{ display: 'grid', gap: 10 }}>
                                <div style={row}>
                                    <span style={{ color: palette.soft }}>{tAll('checkout.flight.receipt.fareLine', { count: totalPax })}</span>
                                    <span style={{ fontWeight: 700, color: palette.title }}>{formatMoney(fare ?? total, currency)}</span>
                                </div>
                                <div style={row}>
                                    <span style={{ color: palette.soft }}>{tAll('checkout.flight.receipt.taxesAndFees')}</span>
                                    <span style={{ color: palette.muted }}>{tAll('checkout.flight.receipt.includedLabel')}</span>
                                </div>
                                {serviceFee !== undefined && serviceFee > 0 && (
                                    <div style={row}>
                                        <span style={{ color: palette.soft }}>{t('serviceFee')}</span>
                                        <span style={{ fontWeight: 700, color: palette.title }}>{formatMoney(serviceFee, currency)}</span>
                                    </div>
                                )}
                            </div>
                            <div style={{ height: 1, background: palette.hairline, margin: '16px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: palette.title }}>{t('totalPaid')}</div>
                                    <Pill tone="green" palette={palette}>{tAll('checkout.flight.receipt.paidBadge')}</Pill>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: palette.faint, fontWeight: 700 }}>{currency}</div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: GREEN, lineHeight: 1.1 }}>{moneyFigure(total, currency)}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: palette.faint, marginTop: 16 }}>{tAll('checkout.flight.receipt.paymentProcessedSecurely')}</div>
                        </div>

                        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                            <button
                                onClick={() => window.print()}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 24px', borderRadius: 100, border: 'none', background: ACCENT_FILL, boxShadow: BRAND.gradientShadow, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                <Download size={15} /> {tAll('checkout.success.downloadReceipt')}
                            </button>
                            <button onClick={onTrips} style={outlineBtn}>
                                {tAll('checkout.flight.receipt.viewBookings')}
                            </button>
                            <button
                                onClick={onHome}
                                style={{ border: 'none', background: 'transparent', color: ACCENT, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit', textAlign: 'center' }}
                            >
                                {t('planAnotherTrip')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Passengers */}
                <div className="receipt-card" style={{ marginTop: 28, background: palette.summaryBg, border: `1px solid ${palette.summaryBorder}`, borderRadius: 20, padding: '24px 28px' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: palette.title, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={16} color={ACCENT} /> {tAll('checkout.flight.receipt.passengerSectionTitle')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '18px 24px' }}>
                        {passengers.map((p, i) => {
                            const nth = passengers.slice(0, i + 1).filter(q => q.type === p.type).length;
                            const label = p.type === 'CHD' ? tAll('checkout.userDetails.childN', { n: nth })
                                : p.type === 'INF' ? tAll('checkout.flight.infantN', { n: nth })
                                    : tAll('checkout.flight.adultN', { n: nth });
                            const name = `${p.firstName} ${p.lastName}`.trim();
                            return (
                                <Fact key={i} label={label} palette={palette}>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: palette.title }}>{name || '—'}</div>
                                </Fact>
                            );
                        })}
                        <Fact label={tAll('checkout.flight.receipt.contact')} palette={palette}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: palette.title, wordBreak: 'break-word' }}>{contactEmail}</div>
                        </Fact>
                    </div>
                </div>
            </div>
        </div>
    );
}

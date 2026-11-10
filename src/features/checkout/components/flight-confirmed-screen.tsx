'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Copy, CopyCheck, Download } from 'lucide-react';
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
/** The form's field corners (`FIELD_RADIUS` on the checkout page), so a box shown here reads as
 *  one of the form's. */
const FIELD_RADIUS = 14;

// ─── Small pieces ───────────────────────────────────────────────────────────────

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

/** One fact about the booking: a quiet caption over its value. A `dt`/`dd` pair, so it reads as
 *  a label and its value. */
function Fact({ label, children, palette }: { label: string; children: React.ReactNode; palette: Palette }) {
    return (
        <div style={{ minWidth: 0 }}>
            <dt style={{ fontSize: 'var(--cg-label-fs)', color: palette.muted }}>{label}</dt>
            <dd style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: palette.title, overflowWrap: 'anywhere' }}>{children}</dd>
        </div>
    );
}

/** A terminal as the boards write it: "2" becomes "T2"; a name the airline already spelled out
 *  is left as it is. */
const shortTerminal = (terminal: string) => (/^\d/.test(terminal) ? `T${terminal}` : terminal);

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
    /** The airline's own record locator. The booking reference is ours; an airport kiosk or the
     *  airline's own app asks for theirs. Shown only when `/flights/confirm` returned one. */
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

type CopyTarget = 'reference' | 'pnr';

// ─── The screen ───────────────────────────────────────────────────────────────
//
// As designed ("Booking Confirmed 1b", in the checkout-alignment project): the checkout's last
// step, on the form's own grid. The steps sit top right where the form's bar was, all three done,
// with the summary card beneath them as it was through the checkout, now with what was paid.
//
// The left column answers what a traveller looks for at the airport. Who flies, which flight, the
// cabin, the bags and the terminal at each end, as a grid of facts; then the two references, each
// in a box with its own Copy: ours, for anything about the booking, and the airline's PNR, which
// is what check-in asks for.
//
// The itinerary's detail — flights, terminals, bags, airport names — comes from the offer the
// page read, a GET the URL's own params never carried. Everything else (who flies, the fare paid,
// both references, where the receipt went) is what the booking itself already knows, so it is
// never blocked on that fetch.
//
// The fare is one figure: the service fee is part of it, as the checkout's summary has it.
//
// Below: the trips button and, under it, the rest of the trip — a hotel where the flight lands and
// a tee time there, which waits for the offer, the only thing that says which city that is. On a
// phone the summary comes before that button, so the receipt reads through before the way out.
export function FlightConfirmedScreen({
    palette, offer, loadingOffer, bookingId, pnr, origin, destination, departureDate, cabin,
    currency, total, adults, childPassengers, infants, passengers, contactEmail,
    backLabel, onBack, onHome, onTrips,
}: FlightConfirmedScreenProps) {
    const tAll = useTranslations();
    const t = useTranslations('checkout');
    const locale = useLocale();
    const [copied, setCopied] = useState<CopyTarget | null>(null);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(copiedTimer.current), []);

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
    const loadingItinerary = loadingOffer && !offer;

    const outbound = slices[0] ?? [];
    const firstSegment = outbound[0];
    const lastOutbound = outbound[outbound.length - 1];
    // Where the outbound lands — not the last slice, which on a round trip lands back home.
    const stay = arrivalStay(slices);
    const destinationCity = stay?.city;

    // Every flight on the ticket, in order: a connection or a return is a flight number too.
    const flightNumbers = Array.from(new Set(slices.flat().map(s => s.flightNumber).filter(Boolean)));
    const airlineName = firstSegment ? (firstSegment.airlineName || firstSegment.airline) : '';
    const cabinName = (firstSegment?.cabinClass ?? cabin ?? '').replace(/_/g, ' ');
    const checkedBags = offer?.baggage?.checkedBags ?? 0;
    const bags = [
        offer?.baggage?.cabinBag ? tAll('checkout.flight.receipt.carryOnBag') : null,
        checkedBags > 0 ? tAll('checkout.flight.receipt.checkedBagsCount', { count: checkedBags }) : null,
    ].filter((b): b is string => b !== null);
    const terminalLabel = tAll('checkout.flight.receipt.terminal');
    const departTerminal = firstSegment?.departure.terminal;
    const arriveTerminal = lastOutbound?.arrival.terminal;

    const handleCopy = async (value: string, target: CopyTarget) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(target);
            toast.success(tAll('checkout.flight.receipt.copyReferenceDone'));
            clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => setCopied(null), 2000);
        } catch {
            // Clipboard access denied or unavailable — the reference is still on screen to
            // select by hand (a click selects all of it), so this fails quietly rather than with
            // an error the traveller can do nothing about.
        }
    };

    const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, color: palette.text };
    const rule = (margin: string) => <div aria-hidden style={{ height: 1, background: palette.cardLine, margin }} />;
    // A quiet action beside the main one: text, but a 44px target.
    const textBtn = (color: string): React.CSSProperties => ({
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 8px', border: 'none',
        background: 'transparent', color, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
    });
    const caption: React.CSSProperties = { fontSize: 'var(--cg-label-fs)', color: palette.muted };
    const skeletonValue = <span aria-hidden style={{ display: 'block', paddingTop: 4 }}><SkeletonBar palette={palette} width={96} height={14} /></span>;

    /** A reference in the form's box, picked whole by one click, with its own Copy. The button is
     *  named "Copy" and described by the caption above, so the two read apart. */
    const referenceBox = (value: string, target: CopyTarget, captionId: string, extra?: React.CSSProperties) => (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div title={value} style={{ ...fieldBox(palette), flex: 1, fontFamily: MONO, color: palette.title, userSelect: 'all', ...extra }}>
                <span style={ellipsis}>{value}</span>
            </div>
            <button
                type="button"
                onClick={() => handleCopy(value, target)}
                aria-describedby={captionId}
                className="no-print"
                style={{ ...fieldBox(palette), flexShrink: 0, gap: 8, color: palette.title, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
                {copied === target ? <CopyCheck aria-hidden size={15} /> : <Copy aria-hidden size={15} />}
                {copied === target ? tAll('checkout.flight.receipt.copyReferenceDone') : tAll('checkout.flight.receipt.copyReference')}
            </button>
        </div>
    );

    /** One end of a flight: what it is, the airport by full name and code, the day and the clock,
     *  and the terminal as the boards write it. */
    const end = (label: string, e: NormalizedSegment['departure'], code: string) => (
        <div>
            <div style={{ fontSize: 12, color: palette.muted }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: palette.title, marginTop: 2 }}>{airportLabel(e, code)}</div>
            <div style={{ fontSize: 13, color: palette.text, marginTop: 2, fontFamily: MONO }}>
                <span>{formatDateTimeLocale(e.time, locale)}</span>
                {e.terminal && <>{' '}<span style={{ whiteSpace: 'nowrap' }}>· {shortTerminal(e.terminal)}</span></>}
            </div>
        </div>
    );

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
                        <p style={{ fontSize: 'clamp(19px,2.2vw,32px)', fontWeight: 400, lineHeight: 1.25, color: palette.text, margin: '8px 0 0' }}>
                            {tAll('checkout.flight.receipt.confirmedToDestination', { destination: destinationCity ?? destination })}
                        </p>
                        <p style={{ fontSize: 'var(--cg-note-fs)', lineHeight: 1.45, color: palette.muted, margin: '10px 0 0', overflowWrap: 'anywhere' }}>
                            {tAll('checkout.flight.receipt.receiptSentTo', { email: contactEmail })}
                        </p>
                    </div>

                    {/* What the traveller needs at the airport */}
                    <div className="lg:col-start-1 lg:row-start-2 min-w-0" style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${palette.hairline}` }}>
                        <dl
                            aria-busy={loadingItinerary || undefined}
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px 24px', margin: 0 }}
                        >
                            <Fact label={totalPax === 1 ? tAll('documents.eticket.passenger') : tAll('checkout.flight.receipt.passengerSectionTitle')} palette={palette}>
                                {passengers.map((p, i) => <div key={i}>{`${p.firstName} ${p.lastName}`.trim() || '—'}</div>)}
                            </Fact>
                            {(loadingItinerary || flightNumbers.length > 0) && (
                                <Fact label={tAll('checkout.summary.flight')} palette={palette}>
                                    {loadingItinerary ? skeletonValue : <>
                                        <div style={{ fontFamily: MONO }}>{flightNumbers.join(' · ')}</div>
                                        {/* Which airline the PNR below belongs to. */}
                                        {airlineName && <div style={{ fontSize: 13, fontWeight: 400, color: palette.muted, marginTop: 2 }}>{airlineName}</div>}
                                    </>}
                                </Fact>
                            )}
                            {cabinName && (
                                <Fact label={tAll('flights.topBar.cabin')} palette={palette}>
                                    <span style={{ textTransform: 'capitalize' }}>{cabinName}</span>
                                </Fact>
                            )}
                            {(loadingItinerary || bags.length > 0) && (
                                <Fact label={tAll('checkout.flight.receipt.bagsLabel')} palette={palette}>
                                    {/* Each allowance wraps whole, never "1" at a line's end and "checked bag" below. */}
                                    {loadingItinerary ? skeletonValue : bags.map((b, i) => (
                                        <React.Fragment key={b}>{i > 0 && ' · '}<span style={{ whiteSpace: 'nowrap' }}>{b}</span></React.Fragment>
                                    ))}
                                </Fact>
                            )}
                            {(loadingItinerary || departTerminal) && (
                                <Fact label={tAll('checkout.flight.receipt.departureTerminal')} palette={palette}>
                                    {loadingItinerary || !firstSegment ? skeletonValue
                                        : <><span>{firstSegment.departure.airport || firstSegment.origin}</span> · <span>{terminalLabel} {departTerminal}</span></>}
                                </Fact>
                            )}
                            {(loadingItinerary || arriveTerminal) && (
                                <Fact label={tAll('checkout.flight.receipt.arrivalTerminal')} palette={palette}>
                                    {loadingItinerary || !lastOutbound ? skeletonValue
                                        : <><span>{lastOutbound.arrival.airport || lastOutbound.destination}</span> · <span>{terminalLabel} {arriveTerminal}</span></>}
                                </Fact>
                            )}
                        </dl>
                        {loadingItinerary && <span className="sr-only">{tAll('checkout.flight.receipt.loadingItinerary')}</span>}

                        {/* Ours, for anything about the booking */}
                        {bookingId && <>
                            <div id="cg-ref-caption" style={{ ...caption, marginTop: 28 }}>{tAll('checkout.bookingPage.reference')}</div>
                            {referenceBox(bookingId, 'reference', 'cg-ref-caption')}
                        </>}

                        {/* The airline's, which check-in asks for */}
                        {pnr && <>
                            <div id="cg-pnr-caption" style={{ ...caption, marginTop: 18 }}>
                                {tAll('checkout.flight.receipt.airlinePnr')}{' '}
                                <span style={{ color: palette.faint }}>· {tAll('checkout.flight.receipt.pnrHint')}</span>
                            </div>
                            {referenceBox(pnr, 'pnr', 'cg-pnr-caption', { letterSpacing: '0.06em' })}
                        </>}
                    </div>

                    {/* Right: the summary, under the steps, as through the checkout */}
                    <aside className="lg:col-start-2 lg:row-start-2 lg:row-span-2 mt-10 lg:mt-0 lg:pt-[28px]">
                        <div style={{ position: 'sticky', top: 24 }}>
                            <div className="receipt-card" style={{ background: palette.surface, borderRadius: 12, padding: '18px 30px 26px' }}>
                                <div style={{ fontWeight: 700, fontSize: 17, color: palette.title }}>{origin} → {destination}</div>
                                {cabinName && <div style={{ fontSize: 13, color: palette.muted, marginTop: 4, textTransform: 'capitalize' }}>{cabinName}</div>}

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
                                <div style={row}>
                                    <span>{tAll('checkout.flight.receipt.fareLine', { count: totalPax })}</span>
                                    <span style={{ fontFamily: MONO }}>{formatMoney(total, currency)}</span>
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
                            </div>
                        </div>
                    </aside>

                    {/* Where to go next */}
                    <div className="no-print lg:col-start-1 lg:row-start-3 min-w-0" style={{ marginTop: 32 }}>
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

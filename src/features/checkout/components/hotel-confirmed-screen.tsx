'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, MapPin } from 'lucide-react';
import { ACCENT_FILL, type Palette } from '@/features/checkout/lib/palette';
import { BRAND } from '@/shared/lib/palette';
import { formatMoney } from '@/features/checkout/lib/format-money';
import { useUserCurrency } from '@/shared/stores/search.store';
import { convertForDisplay } from '@/shared/lib/currency';
import { useLiveRates } from '@/shared/lib/use-live-rates';
import { CheckoutToolbar } from './checkout-toolbar';
import { DoneSteps, Fact, MONO, ReceiptPrintStyles, ReferenceBox, textBtn, useCopy } from './receipt-parts';

interface HotelConfirmedScreenProps {
    palette:      Palette;
    /** Ours. There is none to show until the booking has one — never a made-up one. */
    bookingId:    string | null;
    hotelName:    string;
    hotelAddress: string;
    hotelCity:    string;
    hotelCountry: string;
    hotelImage:   string;
    /** `YYYY-MM-DD`, as the link carried them. */
    checkIn:      string;
    checkOut:     string;
    guestName:    string;
    guestEmail:   string;
    adults:       number;
    roomName:     string;
    currency:     string;
    nightlyPrice: number;
    nights:       number | null;
    fee:          number;
    total:        number;
    /** The toolbar's back button — to wherever the traveller came from. */
    backLabel:    string;
    onBack:       () => void;
    onHome:       () => void;
    onTrips:      () => void;
}

// ─── The screen ───────────────────────────────────────────────────────────────
//
// The flight receipt's design (`flight-confirmed-screen.tsx`), for a stay: the checkout's last
// step on the form's own grid. Heading and the facts on the left; the finished steps top right,
// and under them the stay's summary card as it was through the checkout, now with what was paid.
//
// The left column answers what a guest is asked at the desk: who is staying, which room, the two
// dates, and our reference in a box with its own Copy. On a phone the order is heading, steps,
// the card, the facts, then the way out — the same as the flight's.
export function HotelConfirmedScreen({
    palette, bookingId, hotelName, hotelAddress, hotelCity, hotelCountry, hotelImage,
    checkIn, checkOut, guestName, guestEmail, adults, roomName,
    currency, nightlyPrice, nights, fee, total,
    backLabel, onBack, onHome, onTrips,
}: HotelConfirmedScreenProps) {
    const tAll = useTranslations();
    const t = useTranslations('checkout');
    const locale = useLocale();
    const { copied, copy } = useCopy<'reference'>();

    // As on the flight receipt: the charge is a fact in the currency charged; the selector's
    // currency is a second, approximate line, only once rates are live and only when it differs.
    const userCurrency = useUserCurrency();
    useLiveRates();
    const approx = convertForDisplay(total, currency, userCurrency);
    const approxShown = approx.currency !== currency;

    // A day, in the reader's language. Noon, so no timezone can move it to the day before.
    const day = (d: string) => d
        ? new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
    const addressLine = [hotelAddress, hotelCity, hotelCountry].filter(Boolean).join(', ');
    const room = roomName || t('roomFallback');

    const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, color: palette.text };
    const rule = (margin: string) => <div aria-hidden style={{ height: 1, background: palette.cardLine, margin }} />;
    const caption: React.CSSProperties = { fontSize: 'var(--cg-label-fs)', color: palette.muted };
    const sub: React.CSSProperties = { fontSize: 13, fontWeight: 400, color: palette.muted, marginTop: 2 };

    return (
        <div className="cg-receipt" style={{ minHeight: '100vh', background: palette.bg, color: palette.text }}>
            <ReceiptPrintStyles />

            <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,44px) 80px' }}>
                <CheckoutToolbar palette={palette} backLabel={backLabel} onBack={onBack} />

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,645px)_minmax(300px,370px)] lg:justify-between gap-x-[clamp(40px,8vw,130px)]">
                    <div className="no-print lg:col-start-2 lg:row-start-1 flex justify-center max-lg:order-2 max-lg:mt-6 mb-8 lg:mb-0 lg:pt-1.5">
                        <DoneSteps palette={palette} />
                    </div>

                    <div className="lg:col-start-1 lg:row-start-1 max-lg:order-1">
                        <h1 className="font-bold tracking-[-0.01em]" style={{ fontSize: 'clamp(32px,4.4vw,60px)', lineHeight: 1.05, color: palette.title, margin: 0 }}>
                            {tAll('checkout.flight.receipt.allSet')}
                        </h1>
                        <p style={{ fontSize: 'clamp(19px,2.2vw,32px)', fontWeight: 400, lineHeight: 1.25, color: palette.text, margin: '8px 0 0' }}>
                            {t('stayConfirmed', { hotel: hotelName })}
                        </p>
                        {guestEmail && (
                            <p style={{ fontSize: 'var(--cg-note-fs)', lineHeight: 1.45, color: palette.muted, margin: '10px 0 0', overflowWrap: 'anywhere' }}>
                                {tAll('checkout.flight.receipt.receiptSentTo', { email: guestEmail })}
                            </p>
                        )}
                    </div>

                    {/* What the guest is asked at the desk */}
                    <div className="lg:col-start-1 lg:row-start-2 max-lg:order-4 min-w-0" style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${palette.hairline}` }}>
                        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px 24px', margin: 0 }}>
                            <Fact label={t('guestLabel')} palette={palette}>
                                <div>{guestName || '—'}</div>
                                <div style={sub}>{t('guestsCount', { count: adults })}</div>
                            </Fact>
                            <Fact label={tAll('checkout.success.room')} palette={palette}>
                                <div>{room}</div>
                                {nights ? <div style={sub}>{t('nightsCount', { count: nights })}</div> : null}
                            </Fact>
                            <Fact label={t('checkIn')} palette={palette}>{day(checkIn)}</Fact>
                            <Fact label={t('checkOut')} palette={palette}>{day(checkOut)}</Fact>
                        </dl>

                        {bookingId && <>
                            <div id="cg-ref-caption" style={{ ...caption, marginTop: 28 }}>{tAll('checkout.bookingPage.reference')}</div>
                            <ReferenceBox
                                value={bookingId}
                                copied={copied === 'reference'}
                                onCopy={() => copy(bookingId, 'reference')}
                                captionId="cg-ref-caption"
                                palette={palette}
                                valueStyle={{ letterSpacing: '0.06em' }}
                            />
                        </>}
                    </div>

                    {/* Right: the stay's summary, under the steps, as through the checkout */}
                    <aside className="lg:col-start-2 lg:row-start-2 lg:row-span-2 max-lg:order-3 lg:pt-[28px]">
                        <div style={{ position: 'sticky', top: 24 }}>
                            <div className="receipt-card" style={{ background: palette.surface, borderRadius: 12, overflow: 'hidden' }}>
                                {hotelImage && (
                                    // eslint-disable-next-line @next/next/no-img-element -- supplier photos from any host
                                    <img
                                        src={hotelImage}
                                        alt=""
                                        className="no-print"
                                        style={{ display: 'block', width: '100%', height: 150, objectFit: 'cover' }}
                                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                    />
                                )}
                                <div style={{ padding: '18px 30px 26px' }}>
                                    <div style={{ fontWeight: 700, fontSize: 17, color: palette.title }}>{hotelName}</div>
                                    <div style={{ fontSize: 13, color: palette.muted, marginTop: 4 }}>{room}</div>
                                    {addressLine && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 12, color: palette.muted, marginTop: 6 }}>
                                            <MapPin aria-hidden size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                                            <span>{addressLine}</span>
                                        </div>
                                    )}

                                    {/* The stay itself: in, out */}
                                    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                                        <div>
                                            <div style={{ fontSize: 12, color: palette.muted }}>{t('checkIn')}</div>
                                            <div style={{ fontSize: 13, color: palette.title, marginTop: 2, fontFamily: MONO }}>{day(checkIn)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, color: palette.muted }}>{t('checkOut')}</div>
                                            <div style={{ fontSize: 13, color: palette.title, marginTop: 2, fontFamily: MONO }}>{day(checkOut)}</div>
                                        </div>
                                    </div>

                                    {rule('16px 0 12px')}

                                    {/* What was paid */}
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {nights && nightlyPrice > 0 ? (
                                            <div style={row}>
                                                <span>{formatMoney(nightlyPrice, currency)} × {t('nightsCount', { count: nights })}</span>
                                                <span style={{ fontFamily: MONO }}>{formatMoney(nightlyPrice * nights, currency)}</span>
                                            </div>
                                        ) : null}
                                        {fee > 0 && (
                                            <div style={row}>
                                                <span>{t('serviceFee')}</span>
                                                <span style={{ fontFamily: MONO }}>{formatMoney(fee, currency)}</span>
                                            </div>
                                        )}
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
                        </div>
                    </aside>

                    {/* Where to go next */}
                    <div className="no-print lg:col-start-1 lg:row-start-3 max-lg:order-5 min-w-0" style={{ marginTop: 32 }}>
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
                    </div>
                </div>
            </div>
        </div>
    );
}

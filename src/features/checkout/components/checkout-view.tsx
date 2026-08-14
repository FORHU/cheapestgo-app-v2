'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Download, Calendar, MapPin, Users, CreditCard, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { http } from '@/shared/lib/http';
import { useAuthStore } from '@/shared/auth/store';
import { env } from '@/shared/lib/env';
import type { GuestInfo, PassengerInfo } from '@/features/checkout/components/guest-form';

// ─── Stripe singleton ─────────────────────────────────────────────────────────

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
    if (!stripePromise) {
        stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
    }
    return stripePromise;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const ACCENT = '#FF6B4B';
const GREEN  = '#2FB67F';
const TEXT   = '#F5EFE4';
const BG     = 'linear-gradient(180deg,#15111E,#1B1526)';
const CARD   = 'rgba(28,23,36,0.97)';
const BORDER = 'rgba(255,255,255,0.1)';

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateGuest(g: GuestInfo): Partial<Record<keyof GuestInfo, string>> {
    const e: Partial<Record<keyof GuestInfo, string>> = {};
    if (!g.firstName.trim()) e.firstName = 'Required';
    if (!g.lastName.trim())  e.lastName  = 'Required';
    if (!g.email.trim())     e.email     = 'Required';
    else if (!validateEmail(g.email)) e.email = 'Invalid email';
    if (!g.phone.trim())     e.phone     = 'Required';
    return e;
}

function validatePassengers(passengers: PassengerInfo[]): Record<string, string> {
    const errors: Record<string, string> = {};
    passengers.forEach((p, i) => {
        if (!p.firstName.trim())      errors[`${i}.firstName`]      = 'Required';
        if (!p.lastName.trim())       errors[`${i}.lastName`]       = 'Required';
        if (!p.email.trim())          errors[`${i}.email`]          = 'Required';
        else if (!validateEmail(p.email)) errors[`${i}.email`]      = 'Invalid email';
        if (!p.phone.trim())          errors[`${i}.phone`]          = 'Required';
        if (!p.dateOfBirth)           errors[`${i}.dateOfBirth`]    = 'Required';
        if (!p.passportNumber.trim()) errors[`${i}.passportNumber`] = 'Required';
    });
    return errors;
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function mkInput(hasError = false): React.CSSProperties {
    return {
        width: '100%', padding: '13px 16px', borderRadius: 12,
        border: `1.5px solid ${hasError ? '#E4685A' : 'rgba(255,255,255,0.14)'}`,
        background: 'rgba(255,255,255,0.05)', color: '#fff',
        fontSize: 14, fontFamily: "var(--font-jakarta)", outline: 'none', boxSizing: 'border-box',
    };
}

function ErrText({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <div style={{ fontSize: 11, color: '#E4685A', marginTop: 5, fontWeight: 600 }}>{msg}</div>;
}

function FieldRow({ children }: { children: React.ReactNode }) {
    return <div style={{ marginBottom: 14 }}>{children}</div>;
}

function Grid2({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {children}
        </div>
    );
}

function Spinner() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
            <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
        </svg>
    );
}

function PrimaryBtn({ onClick, loading, disabled, children }: { onClick?: () => void; loading: boolean; disabled?: boolean; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            disabled={loading || disabled}
            style={{ width: '100%', padding: '15px 0', borderRadius: 100, border: 'none', background: (loading || disabled) ? 'rgba(255,107,75,.6)' : ACCENT, color: '#fff', fontWeight: 700, fontSize: 15, cursor: (loading || disabled) ? 'default' : 'pointer', fontFamily: "var(--font-jakarta)", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
            {loading ? <Spinner /> : children}
        </button>
    );
}

// ─── Step progress bar ────────────────────────────────────────────────────────

const STEPS = [
    { key: 'form',      label: 'Details',   num: 1 },
    { key: 'payment',   label: 'Payment',   num: 2 },
    { key: 'confirmed', label: 'Confirmed', num: 3 },
] as const;

type Step = 'form' | 'payment' | 'confirmed';

function ProgressBar({ step }: { step: Step }) {
    const idx = { form: 0, payment: 1, confirmed: 2 }[step];
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 36, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
            {STEPS.map((s, i) => {
                const done   = i < idx || step === 'confirmed';
                const active = i === idx;
                return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: i <= idx ? ACCENT : 'rgba(255,255,255,.08)', color: i <= idx ? '#fff' : 'rgba(245,239,228,.4)', border: active && step !== 'confirmed' ? '2px solid #fff' : 'none' }}>
                                {done && step !== 'confirmed' ? <Check size={13} strokeWidth={3} /> : s.num}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: i <= idx ? TEXT : 'rgba(245,239,228,.4)' }}>{s.label}</div>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: i < idx ? ACCENT : 'rgba(255,255,255,.12)', marginBottom: 18, marginLeft: 4, marginRight: 4 }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Stripe payment form ──────────────────────────────────────────────────────

function StripePaymentForm({
    onSuccess, onError, total, currency, submitting, setSubmitting,
}: {
    onSuccess: (paymentIntentId: string) => void;
    onError:   (msg: string) => void;
    total:     number;
    currency:  string;
    submitting: boolean;
    setSubmitting: (v: boolean) => void;
}) {
    const stripe   = useStripe();
    const elements = useElements();

    const handlePay = useCallback(async () => {
        if (!stripe || !elements) return;
        setSubmitting(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: `${window.location.origin}/trips?payment=success` },
            redirect: 'if_required',
        });

        if (error) {
            onError(error.message || 'Payment failed. Please try again.');
            setSubmitting(false);
        } else if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture')) {
            onSuccess(paymentIntent.id);
        } else {
            onError('Payment is processing. Check your trips shortly.');
            setSubmitting(false);
        }
    }, [stripe, elements, onSuccess, onError, setSubmitting]);

    return (
        <>
            <div style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`, borderRadius: 18, padding: 22, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CreditCard size={16} color={ACCENT} /> Payment details
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(245,239,228,.5)', fontWeight: 600 }}>
                        <Lock size={10} /> Secured by Stripe
                    </div>
                </div>
                <PaymentElement
                    options={{ layout: 'accordion' }}
                />
            </div>
            <PrimaryBtn onClick={handlePay} loading={submitting} disabled={!stripe || !elements}>
                Pay {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </PrimaryBtn>
        </>
    );
}

// ─── Confirmation receipt screen ──────────────────────────────────────────────

function ConfirmedScreen({
    bookingId, hotelName, hotelAddress, hotelCity, hotelCountry, hotelImage,
    checkIn, checkOut, guestName, guestEmail, adults, roomName,
    currency, nightlyPrice, nights, fee, total,
    onHome, onTrips,
}: {
    bookingId:    string | null;
    hotelName:    string;
    hotelAddress: string;
    hotelCity:    string;
    hotelCountry: string;
    hotelImage:   string;
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
    onHome:       () => void;
    onTrips:      () => void;
}) {
    const fmtDate = (d: string) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
        : '';
    const shortDate = (d: string) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

    const addressLine = [hotelAddress, hotelCity, hotelCountry].filter(Boolean).join(', ');
    const ref = bookingId || ('CG-' + Math.random().toString(36).slice(2, 8).toUpperCase());

    return (
        <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
            <style>{`
                @keyframes fsStamp{0%{transform:scale(.4) rotate(-20deg);opacity:0}60%{transform:scale(1.12) rotate(-8deg);opacity:1}100%{transform:scale(1) rotate(-6deg);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                @media print {
                    .no-print { display: none !important; }
                    body { background: #fff !important; color: #000 !important; }
                    .receipt-card { background: #fff !important; border: 1px solid #ddd !important; color: #000 !important; box-shadow: none !important; }
                    .receipt-card * { color: #000 !important; }
                }
            `}</style>

            <div style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(20px,4vw,48px)', paddingBottom: 80 }}>
                <button
                    className="no-print"
                    onClick={onHome}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: 'rgba(245,239,228,.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8, padding: 0 }}
                >
                    <ArrowLeft size={15} /> Home
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 0 24px' }}>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', background: GREEN, border: '3px dashed rgba(255,255,255,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', animation: 'fsStamp .6s ease', flexShrink: 0 }}>
                        <Check size={24} strokeWidth={3} />
                        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', marginTop: 2 }}>BOOKED</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 28, color: '#fff', marginTop: 20 }}>
                        You&rsquo;re all set!
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(245,239,228,.55)', marginTop: 6 }}>
                        Your booking is confirmed. A receipt has been sent to {guestEmail}.
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>Booking Reference</div>
                    <div style={{ fontFamily: "var(--font-mono), 'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, letterSpacing: '.08em', color: ACCENT }}>{ref}</div>
                </div>

                <div className="receipt-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.4)' }}>
                    {hotelImage && (
                        <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
                            <img src={hotelImage} alt={hotelName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,23,36,.8) 0%, transparent 60%)' }} />
                        </div>
                    )}

                    <div style={{ padding: 28 }}>
                        <div style={{ fontWeight: 800, fontSize: 20, color: '#fff', marginBottom: 4 }}>{hotelName}</div>
                        {addressLine && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 12, color: 'rgba(245,239,228,.5)', marginBottom: 20 }}>
                                <MapPin size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                                <span>{addressLine}</span>
                            </div>
                        )}

                        <div style={{ height: 1, background: BORDER, margin: '0 0 20px' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginBottom: 24 }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>Check-in</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={13} color={ACCENT} />
                                    {shortDate(checkIn)}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)', marginTop: 2 }}>{fmtDate(checkIn)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>Check-out</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={13} color={ACCENT} />
                                    {shortDate(checkOut)}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)', marginTop: 2 }}>{fmtDate(checkOut)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>Guest</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Users size={13} color={ACCENT} />
                                    {guestName}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)', marginTop: 2 }}>{adults} guest{adults !== 1 ? 's' : ''}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>Room</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{roomName || 'Standard Room'}</div>
                                {nights && <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)', marginTop: 2 }}>{nights} night{nights !== 1 ? 's' : ''}</div>}
                            </div>
                        </div>

                        <div style={{ height: 1, background: BORDER, margin: '0 0 20px' }} />

                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 12 }}>Price breakdown</div>
                            {nights && nightlyPrice > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 8 }}>
                                    <span>{currency} {Math.round(nightlyPrice).toLocaleString()} × {nights} night{nights !== 1 ? 's' : ''}</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {(nightlyPrice * nights).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            )}
                            {fee > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 8 }}>
                                    <span>Service fee</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {fee.toLocaleString()}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#fff', paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                                <span>Total paid</span>
                                <span style={{ color: GREEN }}>{currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28, alignItems: 'center' }}>
                    <button
                        onClick={() => window.print()}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 100, border: `1.5px solid rgba(255,255,255,.2)`, background: 'rgba(255,255,255,.06)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-jakarta)" }}
                    >
                        <Download size={15} /> Download receipt
                    </button>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={onHome}
                            style={{ padding: '12px 24px', borderRadius: 100, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-jakarta)" }}
                        >
                            Plan another trip
                        </button>
                        <button
                            onClick={onTrips}
                            style={{ padding: '12px 24px', borderRadius: 100, border: `1.5px solid rgba(255,255,255,.2)`, background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-jakarta)" }}
                        >
                            View my trips
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Checkout content ─────────────────────────────────────────────────────────

function CheckoutContent() {
    const searchParams = useSearchParams();
    const router       = useRouter();
    const { user }     = useAuthStore();

    const offerId = searchParams.get('offerId');
    const hotelId = searchParams.get('hotelId');
    const mode: 'hotel' | 'flight' = offerId && !hotelId ? 'flight' : 'hotel';

    const checkIn      = searchParams.get('checkIn')      ?? '';
    const checkOut     = searchParams.get('checkOut')     ?? '';
    const adults       = parseInt(searchParams.get('adults') ?? '1', 10);
    const children     = parseInt(searchParams.get('children') ?? '0', 10);
    const totalPrice   = parseFloat(searchParams.get('totalPrice') ?? '0');
    const currency     = searchParams.get('currency')     ?? 'USD';
    const roomId       = searchParams.get('roomId')       ?? '';
    const rateKey      = searchParams.get('rateKey')      ?? searchParams.get('offerId') ?? '';
    const roomName     = searchParams.get('roomName')     ?? '';
    const hotelName    = searchParams.get('hotelName')    ?? 'Hotel';
    const hotelAddress = searchParams.get('hotelAddress') ?? '';
    const hotelCity    = searchParams.get('hotelCity')    ?? '';
    const hotelCountry = searchParams.get('hotelCountry') ?? '';
    const hotelImage   = searchParams.get('hotelImage')   ?? '';

    const totalAmount    = parseFloat(searchParams.get('totalAmount') ?? '0');
    const flightCurrency = searchParams.get('currency') ?? 'USD';
    const origin         = searchParams.get('origin')         ?? '';
    const destination    = searchParams.get('destination')    ?? '';
    const departureDate  = searchParams.get('departureDate')  ?? checkIn;
    const cabin          = searchParams.get('cabin')          ?? undefined;

    const nights = (checkIn && checkOut)
        ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))
        : null;
    const fmtDate = (d: string) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
    const datesLabel = (checkIn && checkOut)
        ? `${fmtDate(checkIn)} – ${fmtDate(checkOut)}`
        : nights ? `${nights} nights` : '';

    const [step, setStep]           = useState<Step>('form');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg]   = useState<string | null>(null);

    const [prebookId, setPrebookId]         = useState<string | null>(null);
    const [clientSecret, setClientSecret]   = useState<string | null>(null);
    const [bookingId, setBookingId]         = useState<string | null>(null);

    const [guest, setGuest]             = useState<GuestInfo>({ firstName: '', lastName: '', email: '', phone: '' });
    const [guestErrors, setGuestErrors] = useState<Partial<Record<keyof GuestInfo, string>>>({});

    const [passengers, setPassengers]         = useState<PassengerInfo[]>(() =>
        Array.from({ length: Math.max(1, adults) }, () => ({
            firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', passportNumber: '',
        }))
    );
    const [passengerErrors, setPassengerErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (user?.email)      setGuest(g => ({ ...g, email:     g.email     || user.email }));
        if (user?.first_name) setGuest(g => ({ ...g, firstName: g.firstName || (user.first_name ?? '') }));
        if (user?.last_name)  setGuest(g => ({ ...g, lastName:  g.lastName  || (user.last_name  ?? '') }));
    }, [user]);

    const onGuest = useCallback((field: keyof GuestInfo, value: string) => {
        setGuest(g => ({ ...g, [field]: value }));
        setGuestErrors(e => { const n = { ...e }; delete n[field]; return n; });
    }, []);

    const onPassenger = useCallback((index: number, field: keyof PassengerInfo, value: string) => {
        setPassengers(ps => ps.map((p, i) => i === index ? { ...p, [field]: value } : p));
        setPassengerErrors(e => { const n = { ...e }; delete n[`${index}.${field}`]; return n; });
    }, []);

    const handleHotelSubmitForm = useCallback(async () => {
        const gErr = validateGuest(guest);
        if (Object.keys(gErr).length > 0) { setGuestErrors(gErr); return; }

        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        setSubmitting(true); setErrorMsg(null);
        try {
            const pbRes = await http.post<{ success: boolean; data: { prebookId: string; price?: any } }>(
                '/api/hotels/prebook',
                { offerId: rateKey, roomName, adults, children, currency }
            );
            const prebook = pbRes.data;
            setPrebookId(prebook.prebookId);

            const payRes = await http.post<{ success: boolean; data: { clientSecret: string; paymentIntentId: string } }>(
                '/api/hotels/create-payment',
                {
                    prebookId:    prebook.prebookId,
                    amount:       totalPrice,
                    currency,
                    holderEmail:  guest.email,
                    propertyName: hotelName,
                    roomName,
                    checkIn,
                    checkOut,
                }
            );
            setClientSecret(payRes.data.clientSecret);
            setStep('payment');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to set up payment. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }, [guest, user, router, rateKey, roomName, adults, children, currency, totalPrice, hotelName, checkIn, checkOut]);

    const handleStripeSuccess = useCallback(async (stripePaymentIntentId: string) => {
        setSubmitting(true); setErrorMsg(null);
        try {
            const res = await http.post<{ success: boolean; data: { bookingId: string; status: string } }>(
                '/api/hotels/confirm',
                {
                    paymentIntentId: stripePaymentIntentId,
                    prebookId,
                    holder:  { firstName: guest.firstName, lastName: guest.lastName, email: guest.email },
                    guests:  Array.from({ length: adults }, () => ({ firstName: guest.firstName, lastName: guest.lastName })),
                    propertyName: hotelName,
                    roomName,
                    checkIn,
                    checkOut,
                    adults,
                    children,
                    currency,
                    quotedPrice: totalPrice,
                }
            );
            setBookingId(res.data.bookingId);
            setStep('confirmed');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Booking confirmation failed. Contact support with your payment reference.');
        } finally {
            setSubmitting(false);
        }
    }, [prebookId, guest, hotelName, roomName, checkIn, checkOut, adults, children, currency, totalPrice]);

    const handleFlightSubmit = useCallback(async () => {
        const pErr = validatePassengers(passengers);
        if (Object.keys(pErr).length > 0) { setPassengerErrors(pErr); return; }

        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        setSubmitting(true); setErrorMsg(null);
        try {
            await http.post('/flights/book', {
                offerId, currency: flightCurrency,
                passengers: passengers.map(p => ({
                    firstName: p.firstName, lastName: p.lastName, email: p.email,
                    phone: p.phone, dateOfBirth: p.dateOfBirth, passportNumber: p.passportNumber, type: 'adult',
                })),
            });
            setStep('confirmed');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Booking failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }, [passengers, user, router, offerId, flightCurrency]);

    const nightlyPrice = nights && totalPrice ? totalPrice / nights : totalPrice;
    const fee          = Math.round(totalPrice * 0.06);
    const total        = totalPrice + fee;

    function handleBack() {
        if (step === 'payment') setStep('form');
        else router.back();
    }

    const rootStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
    };

    const formCardStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,.04)',
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: 22,
        marginBottom: 16,
    };

    if (step === 'confirmed') {
        return (
            <ConfirmedScreen
                bookingId={bookingId}
                hotelName={hotelName}
                hotelAddress={hotelAddress}
                hotelCity={hotelCity}
                hotelCountry={hotelCountry}
                hotelImage={hotelImage}
                checkIn={checkIn}
                checkOut={checkOut}
                guestName={`${guest.firstName} ${guest.lastName}`.trim()}
                guestEmail={guest.email}
                adults={adults}
                roomName={roomName}
                currency={currency}
                nightlyPrice={nightlyPrice}
                nights={nights}
                fee={fee}
                total={total}
                onHome={() => router.push('/')}
                onTrips={() => router.push('/trips')}
            />
        );
    }

    function AuthBanner() {
        if (user) return null;
        return (
            <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(255,193,7,.3)', background: 'rgba(255,193,7,.08)', fontSize: 13, color: 'rgba(245,239,228,.85)' }}>
                <strong style={{ color: '#FFC107' }}>Sign in</strong> to complete your booking.{' '}
                <button
                    onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                    style={{ color: ACCENT, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: "var(--font-jakarta)" }}
                >
                    Sign in →
                </button>
            </div>
        );
    }

    function SummaryCard() {
        return (
            <div style={{ flex: '0 1 300px', minWidth: 260, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 0, overflow: 'hidden', position: 'sticky', top: 24 }}>
                <div style={{ position: 'absolute', top: -9, left: 26, width: 52, height: 15, background: 'rgba(255,255,255,.14)', borderRadius: 3, transform: 'rotate(-5deg)', zIndex: 1 }} />

                {hotelImage && (
                    <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
                        <img src={hotelImage} alt={hotelName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,23,36,.8) 0%, transparent 50%)' }} />
                    </div>
                )}

                <div style={{ padding: 20 }}>
                    {mode === 'hotel' ? (
                        <>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginTop: hotelImage ? 0 : 8 }}>{hotelName}</div>
                            {roomName && <div style={{ fontSize: 12, color: 'rgba(245,239,228,.55)', marginTop: 2 }}>{roomName}</div>}
                            {hotelAddress && (
                                <div style={{ fontSize: 11, color: 'rgba(245,239,228,.4)', marginTop: 4, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                    <MapPin size={10} style={{ marginTop: 1, flexShrink: 0 }} />
                                    <span>{[hotelAddress, hotelCity].filter(Boolean).join(', ')}</span>
                                </div>
                            )}

                            <div style={{ height: 1, background: BORDER, margin: '14px 0' }} />

                            {[
                                datesLabel && { label: 'Dates', value: datesLabel },
                                { label: 'Guests', value: `${adults} guest${adults !== 1 ? 's' : ''}` },
                                roomName && { label: 'Room', value: roomName },
                            ].filter(Boolean).map((row: any) => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 6 }}>
                                    <span>{row.label}</span><span style={{ fontWeight: 600 }}>{row.value}</span>
                                </div>
                            ))}

                            <div style={{ height: 1, background: BORDER, margin: '14px 0' }} />

                            {nights && nightlyPrice > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 6 }}>
                                    <span>{currency} {Math.round(nightlyPrice).toLocaleString()} × {nights} night{nights !== 1 ? 's' : ''}</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {totalPrice.toLocaleString()}</span>
                                </div>
                            )}
                            {fee > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 10 }}>
                                    <span>Service fee</span><span style={{ fontWeight: 600 }}>{currency} {fee.toLocaleString()}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: '#fff', paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                                <span>Total</span><span>{currency} {total.toLocaleString()}</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginTop: 8 }}>
                                {origin} → {destination}
                            </div>
                            {departureDate && <div style={{ fontSize: 12, color: 'rgba(245,239,228,.55)', marginTop: 2 }}>{fmtDate(departureDate)}</div>}
                            {cabin && <div style={{ fontSize: 12, color: 'rgba(245,239,228,.55)' }}>{cabin}</div>}
                            <div style={{ height: 1, background: BORDER, margin: '14px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: '#fff' }}>
                                <span>Total</span><span>{flightCurrency} {totalAmount.toLocaleString()}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (mode === 'flight') {
        return (
            <div style={rootStyle}>
                <div style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(20px,4vw,48px)', paddingBottom: 60 }}>
                    <button
                        onClick={handleBack}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: 'rgba(245,239,228,.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8, padding: 0 }}
                    >
                        <ArrowLeft size={15} /> Back
                    </button>

                    <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 26, color: '#fff', margin: '18px 0 26px' }}>
                        Complete your booking
                    </div>

                    {errorMsg && (
                        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(228,104,90,.3)', background: 'rgba(228,104,90,.08)', fontSize: 13, color: '#E4685A' }}>
                            {errorMsg}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: '1 1 420px', minWidth: 280 }}>
                            <AuthBanner />
                            {passengers.map((p, i) => (
                                <div key={i} style={formCardStyle}>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 18 }}>
                                        Passenger {passengers.length > 1 ? i + 1 : ''}
                                    </div>
                                    <Grid2>
                                        <div>
                                            <input type="text" value={p.firstName} onChange={e => onPassenger(i, 'firstName', e.target.value)} placeholder="First name" style={mkInput(!!passengerErrors[`${i}.firstName`])} />
                                            <ErrText msg={passengerErrors[`${i}.firstName`]} />
                                        </div>
                                        <div>
                                            <input type="text" value={p.lastName} onChange={e => onPassenger(i, 'lastName', e.target.value)} placeholder="Last name" style={mkInput(!!passengerErrors[`${i}.lastName`])} />
                                            <ErrText msg={passengerErrors[`${i}.lastName`]} />
                                        </div>
                                    </Grid2>
                                    <FieldRow>
                                        <input type="email" value={p.email} onChange={e => onPassenger(i, 'email', e.target.value)} placeholder="Email" style={mkInput(!!passengerErrors[`${i}.email`])} />
                                        <ErrText msg={passengerErrors[`${i}.email`]} />
                                    </FieldRow>
                                    <FieldRow>
                                        <input type="tel" value={p.phone} onChange={e => onPassenger(i, 'phone', e.target.value)} placeholder="Phone" style={mkInput(!!passengerErrors[`${i}.phone`])} />
                                        <ErrText msg={passengerErrors[`${i}.phone`]} />
                                    </FieldRow>
                                    <Grid2>
                                        <div>
                                            <input type="date" value={p.dateOfBirth} onChange={e => onPassenger(i, 'dateOfBirth', e.target.value)} placeholder="Date of birth" style={mkInput(!!passengerErrors[`${i}.dateOfBirth`])} />
                                            <ErrText msg={passengerErrors[`${i}.dateOfBirth`]} />
                                        </div>
                                        <div>
                                            <input type="text" value={p.passportNumber} onChange={e => onPassenger(i, 'passportNumber', e.target.value)} placeholder="Passport number" style={mkInput(!!passengerErrors[`${i}.passportNumber`])} />
                                            <ErrText msg={passengerErrors[`${i}.passportNumber`]} />
                                        </div>
                                    </Grid2>
                                </div>
                            ))}
                            <PrimaryBtn onClick={handleFlightSubmit} loading={submitting}>
                                Confirm booking — {flightCurrency} {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </PrimaryBtn>
                            <p style={{ fontSize: 10, color: 'rgba(245,239,228,.4)', textAlign: 'center', marginTop: 12 }}>
                                By continuing you agree to our <a href="/terms" style={{ color: ACCENT }}>Terms</a> and <a href="/privacy" style={{ color: ACCENT }}>Privacy Policy</a>.
                            </p>
                        </div>
                        <SummaryCard />
                    </div>
                </div>
            </div>
        );
    }

    const backLabel = step === 'payment' ? 'Back to details' : 'Back to property';

    return (
        <div style={rootStyle}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(20px,4vw,48px)', paddingBottom: 60 }}>
                <button
                    onClick={handleBack}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: 'rgba(245,239,228,.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8, padding: 0 }}
                >
                    <ArrowLeft size={15} /> {backLabel}
                </button>

                <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 26, color: '#fff', margin: '18px 0 26px' }}>
                    Complete your booking
                </div>

                <ProgressBar step={step} />

                {errorMsg && (
                    <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(228,104,90,.3)', background: 'rgba(228,104,90,.08)', fontSize: 13, color: '#E4685A' }}>
                        {errorMsg}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: '1 1 420px', minWidth: 280 }}>
                        <AuthBanner />

                        {step === 'form' && (
                            <>
                                <div style={formCardStyle}>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 18 }}>Who&rsquo;s checking in?</div>
                                    <Grid2>
                                        <div>
                                            <input type="text" value={guest.firstName} onChange={e => onGuest('firstName', e.target.value)} placeholder="First name" style={mkInput(!!guestErrors.firstName)} />
                                            <ErrText msg={guestErrors.firstName} />
                                        </div>
                                        <div>
                                            <input type="text" value={guest.lastName} onChange={e => onGuest('lastName', e.target.value)} placeholder="Last name" style={mkInput(!!guestErrors.lastName)} />
                                            <ErrText msg={guestErrors.lastName} />
                                        </div>
                                    </Grid2>
                                    <FieldRow>
                                        <input type="email" value={guest.email} onChange={e => onGuest('email', e.target.value)} placeholder="Email address" style={mkInput(!!guestErrors.email)} />
                                        <ErrText msg={guestErrors.email} />
                                    </FieldRow>
                                    <FieldRow>
                                        <input type="tel" value={guest.phone} onChange={e => onGuest('phone', e.target.value)} placeholder="Phone number" style={mkInput(!!guestErrors.phone)} />
                                        <ErrText msg={guestErrors.phone} />
                                    </FieldRow>
                                </div>
                                <PrimaryBtn onClick={handleHotelSubmitForm} loading={submitting}>
                                    Continue to payment
                                </PrimaryBtn>
                            </>
                        )}

                        {step === 'payment' && clientSecret && (
                            <Elements
                                stripe={getStripe()}
                                options={{
                                    clientSecret,
                                    appearance: { theme: 'night', variables: { colorPrimary: ACCENT, borderRadius: '12px' } },
                                }}
                            >
                                <StripePaymentForm
                                    onSuccess={handleStripeSuccess}
                                    onError={msg => setErrorMsg(msg)}
                                    total={total}
                                    currency={currency}
                                    submitting={submitting}
                                    setSubmitting={setSubmitting}
                                />
                            </Elements>
                        )}

                        <p style={{ fontSize: 10, color: 'rgba(245,239,228,.4)', textAlign: 'center', marginTop: 12 }}>
                            By continuing you agree to our <a href="/terms" style={{ color: ACCENT }}>Terms</a> and <a href="/privacy" style={{ color: ACCENT }}>Privacy Policy</a>.
                        </p>
                    </div>

                    <SummaryCard />
                </div>
            </div>
        </div>
    );
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function CheckoutView() {
    return (
        <Suspense
            fallback={
                <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                        <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
                        <circle cx="12" cy="12" r="9" fill="none" stroke="#FF6B4B" strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
                    </svg>
                </div>
            }
        >
            <CheckoutContent />
        </Suspense>
    );
}

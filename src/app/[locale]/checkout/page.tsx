'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ArrowLeft, Check, Download, Calendar, MapPin, Users, CreditCard, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { http } from '@/shared/lib/http';
import { useAuthStore } from '@/shared/auth/store';
import { useTheme } from '@/shared/components/ThemeContext';
import { env } from '@/shared/lib/env';
import type { GuestInfo, PassengerInfo } from '@/features/checkout/components/guest-form';
import { nightsBetween } from '@/shared/lib/stay';

// ─── Stripe singleton ─────────────────────────────────────────────────────────

let stripePromise: ReturnType<typeof loadStripe> | null = null;

/** The server's figures for a hotel checkout — see api-v2 `preBook`. */
interface HotelDisplay {
    currency:     string;
    subtotal:     number;
    taxes:        number;
    total:        number;
    serviceFee:   number;
    chargedTotal: number;
    converted:    boolean;
}

function getStripe() {
    if (!stripePromise) {
        stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
    }
    return stripePromise;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuestInfo {
    firstName: string;
    lastName:  string;
    email:     string;
    phone:     string;
    phoneCode: string;
}

interface PassengerInfo {
    firstName:      string;
    lastName:       string;
    email:          string;
    phone:          string;
    dateOfBirth:    string;
    passportNumber: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const ACCENT = '#FF6B4B';
const GREEN  = '#2FB67F';
const DANGER = '#E4685A';

/**
 * Every colour the checkout paints with, picked by theme rather than a `dark:`
 * variant — the same shape and reasoning as `propertyPalette` on the property
 * page, so the two screens read as one product: dark is pure black, light is
 * white, and the greys are the app's cream at opacity over black / ink over
 * white.
 */
function checkoutPalette(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    return {
        bg:            dark ? '#000000' : '#FFFFFF',
        title:         dark ? '#FFFFFF' : '#111111',
        text:          dark ? '#F5EFE4' : '#111111',
        soft:          dark ? 'rgba(245,239,228,.7)'  : 'rgba(17,17,17,.65)',
        muted:         dark ? 'rgba(245,239,228,.5)'  : 'rgba(17,17,17,.5)',
        faint:         dark ? 'rgba(245,239,228,.4)'  : 'rgba(17,17,17,.4)',
        hairline:      dark ? 'rgba(255,255,255,.1)'  : 'rgba(0,0,0,.1)',
        fieldBg:       dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.05)',
        summaryBg:     dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
        summaryBorder: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)',
        menuBg:        dark ? '#141018' : '#FFFFFF',
    };
}

type Palette = ReturnType<typeof checkoutPalette>;

/**
 * The dial codes the phone control offers. A short curated list rather than
 * every country on earth — the Philippines first because that is where most of
 * the traffic is, then the markets the rest of it comes from.
 */
const DIAL_CODES: { code: string; dial: string; flag: string; name: string }[] = [
    { code: 'PH', dial: '+63',  flag: '🇵🇭', name: 'Philippines' },
    { code: 'US', dial: '+1',   flag: '🇺🇸', name: 'United States' },
    { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
    { code: 'AU', dial: '+61',  flag: '🇦🇺', name: 'Australia' },
    { code: 'CA', dial: '+1',   flag: '🇨🇦', name: 'Canada' },
    { code: 'SG', dial: '+65',  flag: '🇸🇬', name: 'Singapore' },
    { code: 'MY', dial: '+60',  flag: '🇲🇾', name: 'Malaysia' },
    { code: 'ID', dial: '+62',  flag: '🇮🇩', name: 'Indonesia' },
    { code: 'TH', dial: '+66',  flag: '🇹🇭', name: 'Thailand' },
    { code: 'VN', dial: '+84',  flag: '🇻🇳', name: 'Vietnam' },
    { code: 'JP', dial: '+81',  flag: '🇯🇵', name: 'Japan' },
    { code: 'KR', dial: '+82',  flag: '🇰🇷', name: 'South Korea' },
    { code: 'CN', dial: '+86',  flag: '🇨🇳', name: 'China' },
    { code: 'HK', dial: '+852', flag: '🇭🇰', name: 'Hong Kong' },
    { code: 'TW', dial: '+886', flag: '🇹🇼', name: 'Taiwan' },
    { code: 'IN', dial: '+91',  flag: '🇮🇳', name: 'India' },
    { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'United Arab Emirates' },
    { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
    { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Germany' },
    { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France' },
    { code: 'ES', dial: '+34',  flag: '🇪🇸', name: 'Spain' },
    { code: 'IT', dial: '+39',  flag: '🇮🇹', name: 'Italy' },
    { code: 'NL', dial: '+31',  flag: '🇳🇱', name: 'Netherlands' },
    { code: 'NZ', dial: '+64',  flag: '🇳🇿', name: 'New Zealand' },
];

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

function validateCoGuests(list: CoGuest[]): Record<string, string> {
    const e: Record<string, string> = {};
    list.forEach((g, i) => {
        if (!g.firstName.trim()) e[`${i}.firstName`] = 'Required';
        if (!g.lastName.trim())  e[`${i}.lastName`]  = 'Required';
    });
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

function mkField(palette: Palette, hasError = false): React.CSSProperties {
    return {
        width: '100%', height: 46, padding: '0 16px', borderRadius: 16,
        border: `1.5px solid ${hasError ? DANGER : 'transparent'}`,
        background: palette.fieldBg, color: palette.text,
        fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    };
}

function Label({ children, palette, icon: Icon }: { children: React.ReactNode; palette: Palette; icon?: LucideIcon }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: palette.muted, marginBottom: 7 }}>
            {Icon && <Icon size={12} style={{ flexShrink: 0, opacity: 0.9 }} />}
            {children}
        </div>
    );
}

function ErrText({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <div style={{ fontSize: 11, color: DANGER, marginTop: 5, fontWeight: 600 }}>{msg}</div>;
}

function FieldRow({ children }: { children: React.ReactNode }) {
    return <div style={{ marginBottom: 14 }}>{children}</div>;
}

function TermsLine({ palette }: { palette: Palette }) {
    return (
        <p style={{ fontSize: 11, color: palette.faint, textAlign: 'center', marginTop: 14 }}>
            By continuing you agree to our{' '}
            <Link href="/terms" style={{ color: ACCENT }}>Terms</Link> and{' '}
            <Link href="/privacy" style={{ color: ACCENT }}>Privacy Policy</Link>.
        </p>
    );
}

function Grid2({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {children}
        </div>
    );
}

function Spinner({ color = '#fff' }: { color?: string }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
            <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="3" />
            <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
        </svg>
    );
}

/**
 * The design's primary action: an inverted pill — the page's own title colour
 * filled, the page ground for the label — so it reads white-on-black in the
 * dark theme and black-on-white in the light one.
 */
function PrimaryBtn({
    onClick, loading, disabled, palette, children,
}: {
    onClick?: () => void; loading: boolean; disabled?: boolean; palette: Palette; children: React.ReactNode;
}) {
    const dead = loading || disabled;
    return (
        <button
            onClick={onClick}
            disabled={dead}
            style={{
                width: '100%', padding: '17px 0', borderRadius: 999, border: 'none',
                background: palette.title, color: palette.bg,
                fontWeight: 700, fontSize: 15, cursor: dead ? 'default' : 'pointer',
                opacity: dead ? 0.55 : 1, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity .15s ease',
            }}
        >
            {loading ? <Spinner color={palette.bg} /> : children}
        </button>
    );
}

// ─── Phone control ────────────────────────────────────────────────────────────

/**
 * A dial-code button and a number input sharing one pill. The code opens a
 * short menu; the number is a plain `tel` input. The two are stored apart on
 * the guest (`phoneCode` + `phone`) and only joined when the booking is sent.
 */
function PhoneField({
    palette, code, number, onCode, onNumber, error,
}: {
    palette: Palette;
    code:    string;
    number:  string;
    onCode:   (dial: string) => void;
    onNumber: (value: string) => void;
    error?:  string;
}) {
    const [open, setOpen] = useState(false);
    const current = DIAL_CODES.find(d => d.dial === code) ?? DIAL_CODES[0];

    return (
        <div style={{ position: 'relative' }}>
            <div
                className="cg-phone"
                style={{
                    display: 'flex', alignItems: 'center', width: '100%', height: 46,
                    borderRadius: 16, background: palette.fieldBg,
                    border: `1.5px solid ${error ? DANGER : 'transparent'}`, boxSizing: 'border-box',
                }}
            >
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: '100%',
                        background: 'none', border: 'none', color: palette.text, fontSize: 14,
                        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    }}
                >
                    <span>{current.dial}</span>
                    <ChevronDown size={14} style={{ opacity: 0.55 }} />
                </button>
                <div style={{ width: 1, height: 22, background: palette.hairline, flexShrink: 0 }} />
                <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={number}
                    onChange={e => onNumber(e.target.value)}
                    className="cg-field"
                    style={{
                        flex: 1, minWidth: 0, height: '100%', background: 'none', border: 'none',
                        outline: 'none', color: palette.text, fontSize: 14, padding: '0 14px', fontFamily: 'inherit',
                    }}
                />
            </div>

            {open && (
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div
                        style={{
                            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 41,
                            width: 268, maxHeight: 244, overflowY: 'auto',
                            background: palette.menuBg, border: `1px solid ${palette.summaryBorder}`,
                            borderRadius: 12, padding: 6, boxShadow: '0 16px 44px rgba(0,0,0,.45)',
                        }}
                    >
                        {DIAL_CODES.map((d, i) => (
                            <button
                                key={`${d.code}-${i}`}
                                type="button"
                                onClick={() => { onCode(d.dial); setOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 10px',
                                    background: d.dial === code ? palette.fieldBg : 'none', border: 'none',
                                    borderRadius: 8, color: palette.text, fontSize: 13, cursor: 'pointer',
                                    textAlign: 'left', fontFamily: 'inherit',
                                }}
                            >
                                <span style={{ fontSize: 15 }}>{d.flag}</span>
                                <span style={{ flex: 1 }}>{d.name}</span>
                                <span style={{ opacity: 0.55 }}>{d.dial}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Step progress bar ────────────────────────────────────────────────────────

// The label is a key rather than a word: this array is module scope, and a hook cannot run
// here. ProgressBar resolves it.
const STEPS = [
    { key: 'form',      labelKey: 'steps.details',   num: 1 },
    { key: 'payment',   labelKey: 'steps.payment',   num: 2 },
    { key: 'confirmed', labelKey: 'steps.confirmed', num: 3 },
] as const;

type Step = 'form' | 'payment' | 'confirmed';

function ProgressBar({ step }: { step: Step }) {
    const t = useTranslations('checkout');
    const idx = { form: 0, payment: 1, confirmed: 2 }[step];
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {STEP_LABELS.map((label, i) => {
                const done   = i < idx;
                const active = i === idx;
                return (
                    <div key={label} style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, width: 80 }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700,
                                background: done ? ACCENT : active ? palette.title : palette.fieldBg,
                                color:      done ? '#fff' : active ? palette.bg    : palette.muted,
                            }}>
                                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: i <= idx ? TEXT : 'rgba(245,239,228,.4)' }}>{t(s.labelKey)}</div>
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
    onSuccess, onError, total, currency, submitting, setSubmitting, palette,
}: {
    onSuccess: (paymentIntentId: string) => void;
    onError:   (msg: string) => void;
    total:     number;
    currency:  string;
    submitting: boolean;
    setSubmitting: (v: boolean) => void;
    palette:   Palette;
}) {
    const t = useTranslations('checkout');
    const stripe = useStripe();
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
            <div style={{ background: palette.fieldBg, border: `1px solid ${palette.summaryBorder}`, borderRadius: 18, padding: 22, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CreditCard size={16} color={ACCENT} /> {t('paymentDetails')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(245,239,228,.5)', fontWeight: 600 }}>
                        <Lock size={10} /> {t('securedByStripe')}
                    </div>
                </div>
                <PaymentElement options={{ layout: 'accordion' }} />
            </div>
            <PrimaryBtn onClick={handlePay} loading={submitting} disabled={!stripe || !elements} palette={palette}>
                Pay {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </PrimaryBtn>
        </>
    );
}

// ─── Confirmation receipt screen ──────────────────────────────────────────────

function ConfirmedScreen({
    palette, bookingId, hotelName, hotelAddress, hotelCity, hotelCountry, hotelImage,
    checkIn, checkOut, guestName, guestEmail, adults, roomName,
    currency, nightlyPrice, nights, fee, total,
    onHome, onTrips,
}: {
    palette:      Palette;
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
    const tAll = useTranslations();
    const t = useTranslations('checkout');
    const fmtDate = (d: string) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
        : '';
    const shortDate = (d: string) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

    const addressLine = [hotelAddress, hotelCity, hotelCountry].filter(Boolean).join(', ');
    const ref = bookingId || ('CG-' + Math.random().toString(36).slice(2, 8).toUpperCase());

    return (
        <div style={{ minHeight: '100vh', background: palette.bg, color: palette.text }}>
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
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: palette.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8, padding: 0 }}
                >
                    <ArrowLeft size={15} /> {tAll('property.breadcrumbHome')}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 0 24px' }}>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', background: GREEN, border: '3px dashed rgba(255,255,255,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', animation: 'fsStamp .6s ease', flexShrink: 0 }}>
                        <Check size={24} strokeWidth={3} />
                        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', marginTop: 2 }}>{t('booked')}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 28, color: '#fff', marginTop: 20 }}>
                        {t('allSet')}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(245,239,228,.55)', marginTop: 6 }}>
                        {t('receiptSent', { email: guestEmail })}
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>{t('bookingReference')}</div>
                    <div style={{ fontFamily: "var(--font-mono), 'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, letterSpacing: '.08em', color: ACCENT }}>{ref}</div>
                </div>

                <div className="receipt-card" style={{ background: palette.summaryBg, border: `1px solid ${palette.summaryBorder}`, borderRadius: 24, overflow: 'hidden' }}>
                    {hotelImage && (
                        <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
                            <img src={hotelImage} alt={hotelName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                    )}

                    <div style={{ padding: 28 }}>
                        <div style={{ fontWeight: 800, fontSize: 20, color: palette.title, marginBottom: 4 }}>{hotelName}</div>
                        {addressLine && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 12, color: palette.muted, marginBottom: 20 }}>
                                <MapPin size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                                <span>{addressLine}</span>
                            </div>
                        )}

                        <div style={{ height: 1, background: palette.hairline, margin: '0 0 20px' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginBottom: 24 }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>{t('checkIn')}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={13} color={ACCENT} />
                                    {shortDate(checkIn)}
                                </div>
                                <div style={{ fontSize: 11, color: palette.faint, marginTop: 2 }}>{fmtDate(checkIn)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>{t('checkOut')}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={13} color={ACCENT} />
                                    {shortDate(checkOut)}
                                </div>
                                <div style={{ fontSize: 11, color: palette.faint, marginTop: 2 }}>{fmtDate(checkOut)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>{t('guestLabel')}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Users size={13} color={ACCENT} />
                                    {guestName}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)', marginTop: 2 }}>{t('guestsCount', { count: adults })}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 4 }}>{tAll('checkout.success.room')}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{roomName || t('roomFallback')}</div>
                                {nights && <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)', marginTop: 2 }}>{t('nightsCount', { count: nights })}</div>}
                            </div>
                        </div>

                        <div style={{ height: 1, background: palette.hairline, margin: '0 0 20px' }} />

                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(245,239,228,.4)', textTransform: 'uppercase', marginBottom: 12 }}>{t('priceBreakdown')}</div>
                            {nights && nightlyPrice > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 8 }}>
                                    <span>{currency} {Math.round(nightlyPrice).toLocaleString()} × {t('nightsCount', { count: nights })}</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {(nightlyPrice * nights).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            )}
                            {fee > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 8 }}>
                                    <span>{t('serviceFee')}</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {fee.toLocaleString()}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#fff', paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                                <span>{t('totalPaid')}</span>
                                <span style={{ color: GREEN }}>{currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28, alignItems: 'center' }}>
                    <button
                        onClick={() => window.print()}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 100, border: `1.5px solid ${palette.summaryBorder}`, background: palette.fieldBg, color: palette.title, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        <Download size={15} /> {tAll('checkout.success.downloadReceipt')}
                    </button>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={onHome}
                            style={{ padding: '12px 24px', borderRadius: 100, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            {t('planAnotherTrip')}
                        </button>
                        <button
                            onClick={onTrips}
                            style={{ padding: '12px 24px', borderRadius: 100, border: `1.5px solid ${palette.summaryBorder}`, background: 'transparent', color: palette.title, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            {t('success.viewMyTrips')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Checkout inner ───────────────────────────────────────────────────────────

function CheckoutContent() {
    const tAll = useTranslations();
    const t            = useTranslations('checkout');
    // The footer's namespace, for the two link labels in the consent line below.
    const tRoot        = useTranslations();
    const searchParams = useSearchParams();
    const router       = useRouter();
    const { user }     = useAuthStore();
    const { theme }    = useTheme();
    const palette      = checkoutPalette(theme);

    // ── Detect mode ──
    const offerId = searchParams.get('offerId');
    const hotelId = searchParams.get('hotelId');
    const mode: 'hotel' | 'flight' = offerId && !hotelId ? 'flight' : 'hotel';

    // ── Hotel params ──
    const checkIn      = searchParams.get('checkIn')      ?? '';
    const checkOut     = searchParams.get('checkOut')     ?? '';
    const adults       = parseInt(searchParams.get('adults') ?? '1', 10);
    const children     = parseInt(searchParams.get('children') ?? '0', 10);
    const totalPrice   = parseFloat(searchParams.get('totalPrice') ?? '0');
    const currency     = searchParams.get('currency')     ?? 'USD';
    const rateKey      = searchParams.get('rateKey')      ?? searchParams.get('offerId') ?? '';
    const roomName     = searchParams.get('roomName')     ?? '';
    const hotelName    = searchParams.get('hotelName')    ?? 'Hotel';
    const hotelAddress = searchParams.get('hotelAddress') ?? '';
    const hotelCity    = searchParams.get('hotelCity')    ?? '';
    const hotelCountry = searchParams.get('hotelCountry') ?? '';
    const hotelImage   = searchParams.get('hotelImage')   ?? '';

    // ── Flight params ──
    const totalAmount    = parseFloat(searchParams.get('totalAmount') ?? '0');
    const flightCurrency = searchParams.get('currency') ?? 'USD';
    const origin         = searchParams.get('origin')         ?? '';
    const destination    = searchParams.get('destination')    ?? '';
    const departureDate  = searchParams.get('departureDate')  ?? checkIn;
    const cabin          = searchParams.get('cabin')          ?? undefined;

    // ── Date helpers ──
    const nights = nightsBetween(checkIn, checkOut);
    const fmtDate = (d: string) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

    // ── State ──
    const [step, setStep]           = useState<Step>('form');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg]   = useState<string | null>(null);

    // Booking state
    const [prebookId, setPrebookId]         = useState<string | null>(null);
    /** The board the rate was quoted with. Snapshotted on the booking so the voucher can
     *  state the meal plan that was bought rather than the property's current one. */
    const [board, setBoard]                 = useState<string | undefined>(undefined);
    /**
     * What the customer is shown, as the server worked it out — room total, service fee and
     * the total they pay, in their own currency. This page used to add a hardcoded 6% itself
     * while the server charged 5.9%, so the figure on the Pay button was never the one
     * billed. Null until prebook answers.
     */
    const [display, setDisplay] = useState<HotelDisplay | null>(null);
    const [clientSecret, setClientSecret]   = useState<string | null>(null);
    /** The booking session `/flights/book` opened, which `/flights/confirm` settles. */
    const [flightSessionId, setFlightSessionId] = useState<string>('');
    const [bookingId, setBookingId]         = useState<string | null>(null);

    // Hotel guest form — passenger 1 is the booking holder
    const [guest, setGuest]             = useState<GuestInfo>({ firstName: '', lastName: '', email: '', phone: '', phoneCode: '+63' });
    const [guestErrors, setGuestErrors] = useState<Partial<Record<keyof GuestInfo, string>>>({});

    // Hotel co-guests — passenger 2..N, name only
    const [coGuests, setCoGuests]           = useState<CoGuest[]>(() =>
        Array.from({ length: Math.max(0, adults - 1) }, () => ({ firstName: '', lastName: '' }))
    );
    const [coGuestErrors, setCoGuestErrors] = useState<Record<string, string>>({});

    // Flight form
    const [passengers, setPassengers]         = useState<PassengerInfo[]>(() =>
        Array.from({ length: Math.max(1, adults) }, () => ({
            firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', passportNumber: '',
        }))
    );
    const [passengerErrors, setPassengerErrors] = useState<Record<string, string>>({});

    // Pre-fill from logged-in user
    useEffect(() => {
        if (user?.email)      setGuest(g => ({ ...g, email:     g.email     || user.email }));
        if (user?.first_name) setGuest(g => ({ ...g, firstName: g.firstName || (user.first_name ?? '') }));
        if (user?.last_name)  setGuest(g => ({ ...g, lastName:  g.lastName  || (user.last_name  ?? '') }));
    }, [user]);

    // ── Guest helpers ──
    const onGuest = useCallback((field: keyof GuestInfo, value: string) => {
        setGuest(g => ({ ...g, [field]: value }));
        setGuestErrors(e => { const n = { ...e }; delete n[field]; return n; });
    }, []);

    const onCoGuest = useCallback((index: number, field: keyof CoGuest, value: string) => {
        setCoGuests(gs => gs.map((g, i) => i === index ? { ...g, [field]: value } : g));
        setCoGuestErrors(e => { const n = { ...e }; delete n[`${index}.${field}`]; return n; });
    }, []);

    const onPassenger = useCallback((index: number, field: keyof PassengerInfo, value: string) => {
        setPassengers(ps => ps.map((p, i) => i === index ? { ...p, [field]: value } : p));
        setPassengerErrors(e => { const n = { ...e }; delete n[`${index}.${field}`]; return n; });
    }, []);

    /**
     * Prebook as soon as the page opens, so the summary shows the server's figures before the
     * customer types anything. A quote is a valuation, not a reservation (ADR-0021), so
     * asking for one on arrival costs nothing at the supplier — and a room that has gone
     * is better learned now than after the form is filled in.
     */
    const runPrebook = useCallback(async () => {
        const pbRes = await http.post<{ success: boolean; data: { prebookId: string; display?: HotelDisplay; boardCode?: string } }>(
            '/api/hotels/prebook',
            { offerId: rateKey, roomName, adults, children, currency },
        );
        setPrebookId(pbRes.data.prebookId);
        if (pbRes.data.boardCode) setBoard(pbRes.data.boardCode);
        setDisplay(pbRes.data.display ?? null);
        return pbRes.data;
    }, [rateKey, roomName, adults, children, currency]);

    useEffect(() => {
        if (mode !== 'hotel' || !rateKey) return;
        runPrebook().catch((err) => {
            setErrorMsg(err instanceof Error ? err.message : 'This room is no longer available.');
        });
    }, [mode, rateKey, runPrebook]);

    // ── Hotel step 1: guest → payment intent ──
    const handleHotelSubmitForm = useCallback(async () => {
        const gErr = validateGuest(guest);
        const cErr = validateCoGuests(coGuests);
        if (Object.keys(gErr).length > 0 || Object.keys(cErr).length > 0) {
            setGuestErrors(gErr);
            setCoGuestErrors(cErr);
            return;
        }

        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        setSubmitting(true); setErrorMsg(null);
        try {
            // The quote may have lapsed while the form was being filled in, or never arrived.
            const quoted = prebookId && display ? { prebookId, display } : await runPrebook();
            const shown = quoted.display;
            if (!shown) {
                setErrorMsg('We could not confirm the price in your currency just now. Please try again in a moment.');
                return;
            }

            const payRes = await http.post<{ success: boolean; data: { clientSecret: string; paymentIntentId: string; chargedTotal?: number; serviceFee?: number; currency?: string } }>(
                '/api/hotels/create-payment',
                {
                    prebookId:      quoted.prebookId,
                    amount:         shown.total,
                    currency:       shown.currency,
                    // What the summary showed, fee included — nothing is billed above it.
                    displayedTotal: shown.chargedTotal,
                    holderEmail:    guest.email,
                    propertyName:   hotelName,
                    roomName,
                    checkIn,
                    checkOut,
                }
            );
            // The payment step shows what this intent is actually for.
            if (typeof payRes.data.chargedTotal === 'number') {
                setDisplay({ ...shown, chargedTotal: payRes.data.chargedTotal, serviceFee: payRes.data.serviceFee ?? shown.serviceFee });
            }
            setClientSecret(payRes.data.clientSecret);
            setStep('payment');
        } catch (err) {
            const body = (err as { body?: { error?: string; serverPrice?: number; currency?: string } })?.body;
            if (body?.error === 'PRICE_CHANGED' && typeof body.serverPrice === 'number') {
                // The total moved beyond what can be absorbed. Show the new one and let the
                // customer decide, rather than billing it or failing without a figure.
                setDisplay(null);
                setPrebookId(null);
                setErrorMsg(`The price has changed to ${body.currency ?? currency} ${body.serverPrice.toLocaleString()}. Please review it before paying.`);
                runPrebook().catch(() => {});
            } else {
                setErrorMsg(err instanceof Error ? err.message : 'Failed to set up payment. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    }, [guest, user, router, prebookId, display, runPrebook, currency, hotelName, roomName, checkIn, checkOut]);

    // ── Hotel step 2: Stripe confirms → then call /confirm ──
    const handleStripeSuccess = useCallback(async (stripePaymentIntentId: string) => {
        setSubmitting(true); setErrorMsg(null);
        try {
            // A paid flight is turned into a booking by its own endpoint — the airline
            // order already exists, so this is the step that records the ticket against it.
            if (mode === 'flight') {
                const flightRes = await http.post<{ bookingId: string; pnr?: string; status: string }>(
                    '/flights/confirm',
                    { paymentIntentId: stripePaymentIntentId, sessionId: flightSessionId },
                );
                setBookingId(flightRes.bookingId);
                setStep('confirmed');
                return;
            }

            const res = await http.post<{ success: boolean; data: { bookingId: string; status: string } }>(
                '/api/hotels/confirm',
                {
                    paymentIntentId: stripePaymentIntentId,
                    prebookId,
                    holder:  { firstName: guest.firstName, lastName: guest.lastName, email: guest.email },
                    holderPhone: `${guest.phoneCode} ${guest.phone}`.trim(),
                    guests:  buildConfirmGuests(
                        { firstName: guest.firstName, lastName: guest.lastName, email: guest.email },
                        coGuests,
                    ),
                    propertyName: hotelName,
                    roomName,
                    checkIn,
                    checkOut,
                    adults,
                    children,
                    currency,
                    quotedPrice: totalPrice,
                    board,
                }
            );
            setBookingId(res.data.bookingId);
            setStep('confirmed');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Booking confirmation failed. Contact support with your payment reference.');
        } finally {
            setSubmitting(false);
        }
    }, [mode, flightSessionId, board, prebookId, guest, hotelName, roomName, checkIn, checkOut, adults, children, currency, totalPrice]);

    // ── Flight submit ──
    const handleFlightSubmit = useCallback(async () => {
        const pErr = validatePassengers(passengers);
        if (Object.keys(pErr).length > 0) { setPassengerErrors(pErr); return; }

        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        setSubmitting(true); setErrorMsg(null);
        try {
            // `/flights/book` places the airline order and opens a PaymentIntent; it does
            // not take the money. This used to jump straight to "confirmed" on its
            // response, so the one step that charges the traveller never ran — the same
            // two-step the hotel path has always done, missing on the flight path.
            const res = await http.post<{ clientSecret: string; sessionId: string; paymentIntentId: string }>(
                '/flights/book',
                {
                    offerId, currency: flightCurrency,
                    contact: { email: passengers[0].email, phone: passengers[0].phone },
                    // Stable per attempt, so a retry after a dropped response cannot buy a
                    // second ticket.
                    idempotencyKey: `flight-${offerId}-${passengers[0].email}`,
                    passengers: passengers.map(p => ({
                        firstName: p.firstName, lastName: p.lastName, email: p.email,
                        phone: p.phone, dateOfBirth: p.dateOfBirth, passportNumber: p.passportNumber, type: 'adult',
                    })),
                },
            );
            setFlightSessionId(res.sessionId);
            setClientSecret(res.clientSecret);
            setStep('payment');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Booking failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }, [passengers, user, router, offerId, flightCurrency]);

    // ── Price helpers ──
    //
    // Rendered from the server's display block, never worked out here. Until prebook answers
    // the page shows the room price it arrived with and no fee — a fee line computed in the
    // browser is exactly what drifted from the charge before.
    const shownCurrency = display?.currency ?? currency;
    const roomTotal     = display?.total ?? totalPrice;
    const nightlyPrice  = nights && roomTotal ? roomTotal / nights : roomTotal;
    const fee           = display?.serviceFee ?? 0;
    const total         = display?.chargedTotal ?? roomTotal;

    // ── Back handler ──
    function handleBack() {
        if (step === 'payment') setStep('form');
        else router.back();
    }

    const rootStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: palette.bg,
        color: palette.text,
    };

    const formCardStyle: React.CSSProperties = {
        background: palette.fieldBg,
        border: `1px solid ${palette.summaryBorder}`,
        borderRadius: 18,
        padding: 22,
        marginBottom: 16,
    };

    const sectionLabelStyle: React.CSSProperties = {
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: palette.title,
        marginBottom: 14,
    };

    const fieldCss = (
        <style>{`
            @keyframes spin{to{transform:rotate(360deg)}}
            .cg-field::placeholder{color:${palette.muted};opacity:1}
            .cg-field:focus{border-color:${ACCENT} !important}
            .cg-phone:focus-within{border-color:${ACCENT}}
            .cg-field:-webkit-autofill,
            .cg-field:-webkit-autofill:hover,
            .cg-field:-webkit-autofill:focus,
            .cg-field:-webkit-autofill:active{
                -webkit-text-fill-color:${palette.text};
                caret-color:${palette.text};
                transition:background-color 600000s 0s, color 600000s 0s;
            }
            .cg-field:autofill{-webkit-text-fill-color:${palette.text}}
        `}</style>
    );

    // ── Confirmed ─────────────────────────────────────────────────────────────
    if (step === 'confirmed') {
        return (
            <ConfirmedScreen
                palette={palette}
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
                currency={shownCurrency}
                nightlyPrice={nightlyPrice}
                nights={nights}
                fee={fee}
                total={total}
                onHome={() => router.push('/')}
                onTrips={() => router.push('/trips')}
            />
        );
    }

    // ── Not logged in helper ──
    function AuthBanner() {
    const tAll = useTranslations();
        if (user) return null;
        return (
            <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(255,193,7,.3)', background: 'rgba(255,193,7,.08)', fontSize: 13, color: 'rgba(245,239,228,.85)' }}>
                <strong style={{ color: '#FFC107' }}>{tAll('nav.signIn')}</strong> to complete your booking.{' '}
                <button
                    onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                    style={{ color: ACCENT, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
                >
                    {tAll('checkout.signInArrow')}
                </button>
            </div>
        );
    }

    // ── Summary card (right sidebar) ──────────────────────────────────────────
    function SummaryCard() {
        return (
            <div style={{ flex: '0 1 340px', minWidth: 280, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
                <div style={{ background: palette.summaryBg, border: `1px solid ${palette.summaryBorder}`, borderRadius: 16, overflow: 'hidden' }}>
                    {hotelImage && (
                        <div style={{ height: 200, overflow: 'hidden' }}>
                            <img src={hotelImage} alt={hotelName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                    )}

                    <div style={{ padding: 18 }}>
                        {mode === 'hotel' ? (
                            <>
                                <div style={{ fontWeight: 700, fontSize: 17, color: palette.title }}>{hotelName}</div>
                                {roomName && <div style={{ fontSize: 13, color: palette.muted, marginTop: 3 }}>{roomName}</div>}
                                {hotelAddress && (
                                    <div style={{ fontSize: 12, color: palette.muted, marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                        <MapPin size={11} style={{ marginTop: 1, flexShrink: 0 }} />
                                        <span>{[hotelAddress, hotelCity].filter(Boolean).join(', ')}</span>
                                    </div>
                                )}

                                <div style={{ height: 1, background: palette.hairline, margin: '14px 0' }} />

                                {[
                                    { label: 'Dates',  value: formatStayDates(checkIn, checkOut) },
                                    { label: 'Guests', value: `${adults} guest${adults !== 1 ? 's' : ''}` },
                                    roomName && { label: 'Room', value: roomName },
                                ].filter((row): row is { label: string; value: string } => Boolean(row && row.value)).map((row) => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, marginBottom: 8 }}>
                                        <span style={{ color: palette.muted, flexShrink: 0 }}>{row.label}</span>
                                        <span style={{ fontWeight: 600, color: palette.soft, textAlign: 'right' }}>{row.value}</span>
                                    </div>
                                ))}

                                <div style={{ height: 1, background: palette.hairline, margin: '14px 0' }} />

                            {nights && nightlyPrice > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 6 }}>
                                    <span>{shownCurrency} {Math.round(nightlyPrice).toLocaleString()} × {t('nightsCount', { count: nights })}</span>
                                    <span style={{ fontWeight: 600 }}>{shownCurrency} {roomTotal.toLocaleString()}</span>
                                </div>
                            )}
                            {display ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(245,239,228,.7)', marginBottom: 10 }}>
                                    <span>{t('serviceFee')}</span><span style={{ fontWeight: 600 }}>{shownCurrency} {fee.toLocaleString()}</span>
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: 'rgba(245,239,228,.55)', marginBottom: 10 }}>
                                    {t('confirmingFinalPrice')}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: '#fff', paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                                <span>{t('summary.total')}</span><span>{shownCurrency} {total.toLocaleString()}</span>
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
                                <span>{tAll('checkout.success.total')}</span><span>{flightCurrency} {totalAmount.toLocaleString()}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Flight form (single step) ─────────────────────────────────────────────
    if (mode === 'flight') {
        return (
            <div style={rootStyle}>
                {fieldCss}
                <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(20px,4vw,48px)', paddingBottom: 60 }}>
                    <button
                        onClick={handleBack}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: palette.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8, padding: 0, fontFamily: 'inherit' }}
                    >
                        <ArrowLeft size={15} /> {tAll('checkout.back')}
                    </button>

                    <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 26, color: '#fff', margin: '18px 0 26px' }}>
                        {t('completeYourBooking')}
                    </div>

                    {errorMsg && (
                        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 14, border: `1px solid ${DANGER}55`, background: `${DANGER}14`, fontSize: 13, color: DANGER }}>
                            {errorMsg}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: '1 1 420px', minWidth: 280 }}>
                            <AuthBanner />
                            {passengers.map((p, i) => (
                                <div key={i} style={formCardStyle}>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: palette.title, marginBottom: 18 }}>
                                        Passenger {passengers.length > 1 ? i + 1 : ''}
                                    </div>
                                    <Grid2>
                                        <div>
                                            <input type="text" value={p.firstName} onChange={e => onPassenger(i, 'firstName', e.target.value)} placeholder={tAll('checkout.userDetails.firstNamePlaceholder')} style={mkInput(!!passengerErrors[`${i}.firstName`])} />
                                            <ErrText msg={passengerErrors[`${i}.firstName`]} />
                                        </div>
                                        <div>
                                            <input type="text" value={p.lastName} onChange={e => onPassenger(i, 'lastName', e.target.value)} placeholder={tAll('checkout.userDetails.lastNamePlaceholder')} style={mkInput(!!passengerErrors[`${i}.lastName`])} />
                                            <ErrText msg={passengerErrors[`${i}.lastName`]} />
                                        </div>
                                    </Grid2>
                                    <FieldRow>
                                        <input type="email" value={p.email} onChange={e => onPassenger(i, 'email', e.target.value)} placeholder={tAll('checkout.userDetails.emailPlaceholder')} style={mkInput(!!passengerErrors[`${i}.email`])} />
                                        <ErrText msg={passengerErrors[`${i}.email`]} />
                                    </FieldRow>
                                    <FieldRow>
                                        <input type="tel" value={p.phone} onChange={e => onPassenger(i, 'phone', e.target.value)} placeholder={tAll('checkout.userDetails.phone')} style={mkInput(!!passengerErrors[`${i}.phone`])} />
                                        <ErrText msg={passengerErrors[`${i}.phone`]} />
                                    </FieldRow>
                                    <Grid2>
                                        <div>
                                            <input type="date" value={p.dateOfBirth} onChange={e => onPassenger(i, 'dateOfBirth', e.target.value)} placeholder={tAll('checkout.userDetails.dateOfBirth')} style={mkInput(!!passengerErrors[`${i}.dateOfBirth`])} />
                                            <ErrText msg={passengerErrors[`${i}.dateOfBirth`]} />
                                        </div>
                                        <div>
                                            <input type="text" value={p.passportNumber} onChange={e => onPassenger(i, 'passportNumber', e.target.value)} placeholder={tAll('checkout.userDetails.passportNumber')} style={mkInput(!!passengerErrors[`${i}.passportNumber`])} />
                                            <ErrText msg={passengerErrors[`${i}.passportNumber`]} />
                                        </div>
                                    </Grid2>
                                </div>
                            ))}
                            <PrimaryBtn onClick={handleFlightSubmit} loading={submitting} palette={palette}>
                                Confirm booking — {flightCurrency} {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </PrimaryBtn>
                            <p style={{ fontSize: 10, color: 'rgba(245,239,228,.4)', textAlign: 'center', marginTop: 12 }}>
                                {t('agreePrefix')} <Link href="/terms" style={{ color: ACCENT }}>{tRoot('footer.terms')}</Link> {tRoot('legal.termsGate.checkboxConnector')} <Link href="/privacy" style={{ color: ACCENT }}>{tRoot('footer.privacyMinimal')}</Link>.
                            </p>
                        </div>
                        <SummaryCard />
                    </div>
                </div>
            </div>
        );
    }

    // ── Hotel checkout ────────────────────────────────────────────────────────
    const backLabel = step === 'payment' ? 'Back to details' : 'Back to Property';

    return (
        <div style={rootStyle}>
            {fieldCss}
            <div style={{ maxWidth: 1240, margin: '0 auto', padding: 'clamp(20px,4vw,44px)', paddingBottom: 64 }}>
                <button
                    onClick={handleBack}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', color: palette.text, fontSize: 15, fontWeight: 500, cursor: 'pointer', marginBottom: 10, padding: 0, fontFamily: 'inherit' }}
                >
                    <ArrowLeft size={17} /> {backLabel}
                </button>

                <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 26, color: '#fff', margin: '18px 0 26px' }}>
                    {t('completeYourBooking')}
                </div>

                {step === 'form' && (
                    <div style={{ fontWeight: 500, fontSize: 'clamp(17px,2.1vw,25px)', color: palette.text, marginTop: 6, marginBottom: 38 }}>
                        Who&rsquo;s checking in? (Your Details)
                    </div>
                )}

                {errorMsg && (
                    <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, border: `1px solid ${DANGER}55`, background: `${DANGER}14`, fontSize: 13, color: DANGER }}>
                        {errorMsg}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* ── Left: form ── */}
                    <div style={{ flex: '1 1 460px', minWidth: 280 }}>
                        <AuthBanner />

                        {/* Step 1: Guest details */}
                        {step === 'form' && (
                            <>
                                <div style={formCardStyle}>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 18 }}>{t('whosCheckingIn')}</div>
                                    <Grid2>
                                        <div>
                                            <input type="text" value={guest.firstName} onChange={e => onGuest('firstName', e.target.value)} placeholder={tAll('checkout.userDetails.firstNamePlaceholder')} style={mkInput(!!guestErrors.firstName)} />
                                            <ErrText msg={guestErrors.firstName} />
                                        </div>
                                        <div>
                                            <input type="text" value={guest.lastName} onChange={e => onGuest('lastName', e.target.value)} placeholder={tAll('checkout.userDetails.lastNamePlaceholder')} style={mkInput(!!guestErrors.lastName)} />
                                            <ErrText msg={guestErrors.lastName} />
                                        </div>
                                    </Grid2>
                                    <FieldRow>
                                        <input type="email" value={guest.email} onChange={e => onGuest('email', e.target.value)} placeholder={tAll('auth.signIn.emailLabel')} style={mkInput(!!guestErrors.email)} />
                                        <ErrText msg={guestErrors.email} />
                                    </FieldRow>
                                    <FieldRow>
                                        <input type="tel" value={guest.phone} onChange={e => onGuest('phone', e.target.value)} placeholder={tAll('checkout.userDetails.phoneNumber')} style={mkInput(!!guestErrors.phone)} />
                                        <ErrText msg={guestErrors.phone} />
                                    </FieldRow>
                                </div>
                                <PrimaryBtn onClick={handleHotelSubmitForm} loading={submitting}>
                                    {t('continueToPayment')}
                                </PrimaryBtn>
                            </>
                        )}

                        {/* Step 2: Stripe Payment */}
                        {step === 'payment' && clientSecret && (
                            <Elements
                                stripe={getStripe()}
                                options={{
                                    clientSecret,
                                    appearance: {
                                        theme: theme === 'dark' ? 'night' : 'stripe',
                                        variables: { colorPrimary: ACCENT, borderRadius: '12px' },
                                    },
                                }}
                            >
                                <StripePaymentForm
                                    onSuccess={handleStripeSuccess}
                                    onError={msg => setErrorMsg(msg)}
                                    total={total}
                                    currency={shownCurrency}
                                    submitting={submitting}
                                    setSubmitting={setSubmitting}
                                    palette={palette}
                                />
                                <TermsLine palette={palette} />
                            </Elements>
                        )}

                        <p style={{ fontSize: 10, color: 'rgba(245,239,228,.4)', textAlign: 'center', marginTop: 12 }}>
                            {t('agreePrefix')} <Link href="/terms" style={{ color: ACCENT }}>{tRoot('footer.terms')}</Link> {tRoot('legal.termsGate.checkboxConnector')} <Link href="/privacy" style={{ color: ACCENT }}>{tRoot('footer.privacyMinimal')}</Link>.
                        </p>
                    </div>

                    {/* ── Right: summary ── */}
                    <SummaryCard />
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
    return (
        <Suspense
            fallback={
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
                        <circle cx="12" cy="12" r="9" fill="none" stroke="#FF6B4B" strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
                    </svg>
                </div>
            }
        >
            <CheckoutContent />
        </Suspense>
    );
}

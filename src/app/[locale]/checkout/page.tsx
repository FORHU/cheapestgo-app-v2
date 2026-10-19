'use client';

import React, { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ArrowLeft, Check, Download, Calendar, MapPin, Users, ChevronDown, ChevronLeft, Sun, Moon, User, Mail, Phone, type LucideIcon } from 'lucide-react';
import { loadStripe, type Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { http } from '@/shared/lib/http';
import { useAuthStore } from '@/shared/auth/store';
import { useTheme } from '@/shared/components/ThemeContext';
import { env } from '@/shared/lib/env';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { formatStayDates, type CoGuest } from '@/features/checkout/lib/checkout.helpers';
import { useHotelCheckout } from '@/features/checkout/hooks/use-hotel-checkout';
import type { HotelDisplay, HotelCheckoutState } from '@/features/checkout/lib/hotel-checkout-machine';
import { buildHotelGuestPayload, validateHotelGuestForm, type HotelGuestForm } from '@/features/checkout/lib/hotel-guest-form';
import { readFlightConfirmError } from '@/features/checkout/lib/flight-confirm-errors';
import { birthDateBounds, passportExpiryBounds } from '@/features/checkout/lib/flight-date-bounds';
import { DateField } from '@/features/checkout/components/date-field';
import {
    BookingFailedPanel, MultiRoomNotice, PriceMovedPanel, RoomUnavailablePanel, SettlingPanel, SupplierDownPanel,
} from '@/features/checkout/components/booking-state-panels';
import { nightsBetween } from '@/shared/lib/stay';
import { ACCENT, ACCENT_FILL, GREEN, DANGER, checkoutPalette, type Palette } from '@/features/checkout/lib/palette';
import { BRAND } from '@/shared/lib/palette';

// ─── Stripe singleton ─────────────────────────────────────────────────────────

let stripePromise: ReturnType<typeof loadStripe> | null = null;


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
    /** Adult, child or infant — in the order the offer lists its passengers. */
    type:           'ADT' | 'CHD' | 'INF';
    firstName:      string;
    lastName:       string;
    /** The lead traveller's only: they are the booking's contact. */
    email:          string;
    /** National number; its dial code is `contactPhoneCode`. Lead traveller only. */
    phone:          string;
    dateOfBirth:    string;
    /** 'M' | 'F', as the API takes it; '' until chosen. */
    gender:         string;
    passportNumber: string;
    passportExpiry: string;
    /** Issuing country, ISO 3166 alpha-2. */
    nationality:    string;
}


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

function validatePassengers(passengers: PassengerInfo[]): Record<string, string> {
    const errors: Record<string, string> = {};
    passengers.forEach((p, i) => {
        if (!p.firstName.trim())      errors[`${i}.firstName`]      = 'Required';
        if (!p.lastName.trim())       errors[`${i}.lastName`]       = 'Required';
        if (i === 0) {
            if (!p.email.trim())          errors[`${i}.email`]      = 'Required';
            else if (!validateEmail(p.email)) errors[`${i}.email`]  = 'Invalid email';
            if (!p.phone.trim())          errors[`${i}.phone`]      = 'Required';
        }
        if (!p.dateOfBirth)           errors[`${i}.dateOfBirth`]    = 'Required';
        // Gender, because the order builder defaults a missing one to female and a ticket
        // whose gender disagrees with the passport is refused at the gate.
        if (!p.gender)                errors[`${i}.gender`]         = 'Required';
        if (!p.passportNumber.trim()) errors[`${i}.passportNumber`] = 'Required';
        // Expiry and issuing country travel with the number or the airline gets none of
        // it: `duffelIdentityDocuments` returns nothing unless all three are present.
        if (!p.passportExpiry)        errors[`${i}.passportExpiry`] = 'Required';
        if (p.nationality.trim().length !== 2) errors[`${i}.nationality`] = '2-letter country code';
    });
    return errors;
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function mkField(palette: Palette, hasError = false): React.CSSProperties {
    return {
        width: '100%', height: 40, padding: '0 16px', borderRadius: 999,
        border: `1.5px solid ${hasError ? DANGER : palette.fieldBorder}`,
        background: palette.fieldBg, color: palette.text,
        fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    };
}

/** A field's caption. With `htmlFor` it is a real `<label>`, so the field is named by it. */
function Label({ children, palette, icon: Icon, htmlFor }: { children: React.ReactNode; palette: Palette; icon?: LucideIcon; htmlFor?: string }) {
    const style: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 400, color: palette.text, marginBottom: 8, paddingLeft: 4 };
    const content = <>{Icon && <Icon size={13} strokeWidth={1.75} color={palette.icon} style={{ flexShrink: 0 }} />}{children}</>;
    return htmlFor
        ? <label htmlFor={htmlFor} style={style}>{content}</label>
        : <div style={style}>{content}</div>;
}

function ErrText({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <div style={{ fontSize: 11, color: DANGER, marginTop: 5, fontWeight: 600 }}>{msg}</div>;
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
 * The page's primary action: a pill in the brand gradient, blue-600 → cyan-500, with
 * white text — the same fill the landing and search pages give the thing to press next.
 * The same in both themes.
 */
function PrimaryBtn({
    onClick, loading, disabled, children,
}: {
    onClick?: () => void; loading: boolean; disabled?: boolean; children: React.ReactNode;
}) {
    const dead = loading || disabled;
    return (
        <button
            onClick={onClick}
            disabled={dead}
            style={{
                width: '100%', padding: '17px 0', borderRadius: 999, border: 'none',
                background: ACCENT_FILL, color: '#fff', boxShadow: dead ? 'none' : BRAND.gradientShadow,
                fontWeight: 700, fontSize: 15, cursor: dead ? 'default' : 'pointer',
                opacity: dead ? 0.55 : 1, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity .15s ease',
            }}
        >
            {loading ? <Spinner /> : children}
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
    palette, code, number, onCode, onNumber, error, inputId, placeholder,
}: {
    palette: Palette;
    code:    string;
    number:  string;
    onCode:   (dial: string) => void;
    onNumber: (value: string) => void;
    error?:  string;
    /** For a `<label htmlFor>` naming the number input. */
    inputId?:     string;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const current = DIAL_CODES.find(d => d.dial === code) ?? DIAL_CODES[0];

    return (
        <div style={{ position: 'relative' }}>
            <div
                className="cg-phone"
                style={{
                    display: 'flex', alignItems: 'center', width: '100%', height: 40,
                    borderRadius: 999, background: palette.fieldBg,
                    border: `1.5px solid ${error ? DANGER : palette.fieldBorder}`, boxSizing: 'border-box',
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
                    id={inputId}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder={placeholder}
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
    { key: 'form',      labelKey: 'steps.details',      num: 1 },
    { key: 'payment',   labelKey: 'steps.payment',      num: 2 },
    { key: 'confirmed', labelKey: 'steps.verification', num: 3 },
] as const;

type Step = 'form' | 'payment' | 'confirmed';

/**
 * Three numbered discs joined by hairlines. As drawn, only the step in hand is
 * marked — white disc, black numeral. Steps already done look exactly like
 * steps still to come: the bar says where you are, not what you have finished.
 */
function ProgressBar({ step, palette }: { step: Step; palette: Palette }) {
    const t = useTranslations('checkout');
    const idx = { form: 0, payment: 1, confirmed: 2 }[step];
    return (
        <ol style={{ display: 'flex', alignItems: 'flex-start', listStyle: 'none', margin: 0, padding: 0 }}>
            {STEPS.map((s, i) => {
                const active = i === idx;
                return (
                    <li key={s.key} aria-current={active ? 'step' : undefined} style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 50 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 700,
                                background: active ? ACCENT_FILL : palette.stepIdle,
                                color:      active ? '#fff'      : palette.title,
                            }}>
                                {s.num}
                            </div>
                            <div style={{ fontSize: 12, color: palette.text, whiteSpace: 'nowrap' }}>{t(s.labelKey)}</div>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div aria-hidden style={{ width: 'clamp(40px,6vw,90px)', height: 1, marginTop: 16, background: palette.stepLine }} />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

/**
 * The row above the heading: back on the left; currency, then theme, on the
 * right — 50px discs on the raised `surface`, as on the property page's banner
 * but solid, since here they sit on the page rather than over a photograph.
 */
function CheckoutToolbar({ palette, backLabel, onBack }: { palette: Palette; backLabel: string; onBack: () => void }) {
    const tAll = useTranslations();
    const { theme, toggleTheme } = useTheme();
    const disc: React.CSSProperties = {
        width: 50, height: 50, borderRadius: '50%', border: 'none',
        background: palette.surface, color: palette.title,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    };
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(24px,3vw,36px)' }}>
            <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} style={disc}>
                <ChevronLeft size={24} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 17 }}>
                <CurrencySelector
                    align="right"
                    iconOnly
                    triggerClassName="h-[50px] w-[50px] md:h-[50px] md:w-[50px]"
                    chrome={{
                        surface: palette.surface,
                        border:  'transparent',
                        text:    palette.title,
                        menu:    palette.menuBg,
                        hover:   palette.fieldBg,
                        shadow:  '0 24px 55px -18px rgba(0,0,0,.5)',
                    }}
                />
                <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? tAll('property.v2.switchToLight') : tAll('property.v2.switchToDark')}
                    title={theme === 'dark' ? tAll('property.v2.lightMode') : tAll('property.v2.darkMode')}
                    style={disc}
                >
                    {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
                </button>
            </div>
        </div>
    );
}

/**
 * The Payment Element dressed as the rest of the form: pill inputs on the
 * field fill, labels in body colour, the accordion flattened onto the panel.
 * Stripe draws it in its own iframe, so its text and placeholders are Stripe's
 * and can only be restyled, not reworded.
 */
function stripeAppearance(palette: Palette, theme: 'light' | 'dark'): Appearance {
    return {
        theme: theme === 'dark' ? 'night' : 'stripe',
        variables: {
            // Neutral, so the "Card" heading and its icon read as the panel's title, as in
            // the design; the accent stays on the focus ring, set on `.Input:focus` below.
            colorPrimary:         palette.text,
            colorBackground:      palette.fieldBg,
            colorText:            palette.text,
            colorTextSecondary:   palette.muted,
            colorTextPlaceholder: palette.faint,
            colorDanger:          DANGER,
            // Stripe's own containers (Link's save-info block, menus) take this; only the
            // inputs are pills, below. At 999px here the save-info block became an oval.
            borderRadius:         '12px',
            fontSizeBase:         '14px',
            spacingUnit:          '4px',
            accordionItemLabelFontSize:           '16px',
            accordionItemLabelFontWeight:         '400',
            accordionItemLabelSelectedFontWeight: '400',
        },
        rules: {
            '.Input':         { border: `1.5px solid ${palette.fieldBorder}`, boxShadow: 'none', padding: '12px 16px', borderRadius: '999px' },
            '.Input:focus':   { boxShadow: `0 0 0 1.5px ${ACCENT}` },
            '.Label':         { color: palette.text, fontSize: '13px', fontWeight: '400', marginBottom: '8px' },
            '.AccordionItem': { backgroundColor: 'transparent', border: 'none', boxShadow: 'none', paddingTop: '0', paddingLeft: '0', paddingRight: '0' },
            '.Tab':           { border: 'none', boxShadow: 'none' },
            // The optional save-info fields sit straight on the panel, as in the design.
            '.Block':         { backgroundColor: 'transparent', border: 'none', boxShadow: 'none', padding: '0' },
        },
    };
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
            <div style={{ background: palette.surface, borderRadius: 12, padding: 'clamp(20px,3vw,36px)', paddingBottom: 'clamp(18px,2.4vw,28px)', marginBottom: 25 }}>
                <PaymentElement options={{ layout: 'accordion' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 'clamp(20px,3vw,32px)', fontSize: 12, color: palette.muted }}>
                    <span>{t.rich('securedPoweredBy', { brand: 'Stripe', b: (chunks) => <b style={{ color: palette.soft, fontWeight: 700 }}>{chunks}</b> })}</span>
                </div>
            </div>
            <PrimaryBtn onClick={handlePay} loading={submitting} disabled={!stripe || !elements}>
                {t('payNow', { amount: `${currency} ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` })}
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
    // The reference is the booking's, or there is none to show. This used to mint a random one
    // when it had none — a receipt for a booking that does not exist.
    const ref = bookingId;

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
                    <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 28, color: palette.title, marginTop: 20 }}>
                        {t('allSet')}
                    </div>
                    <div style={{ fontSize: 13, color: palette.muted, marginTop: 6 }}>
                        {t('receiptSent', { email: guestEmail })}
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>{t('bookingReference')}</div>
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
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>{t('checkIn')}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: palette.title, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={13} color={ACCENT} />
                                    {shortDate(checkIn)}
                                </div>
                                <div style={{ fontSize: 11, color: palette.faint, marginTop: 2 }}>{fmtDate(checkIn)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>{t('checkOut')}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: palette.title, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={13} color={ACCENT} />
                                    {shortDate(checkOut)}
                                </div>
                                <div style={{ fontSize: 11, color: palette.faint, marginTop: 2 }}>{fmtDate(checkOut)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>{t('guestLabel')}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: palette.title, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Users size={13} color={ACCENT} />
                                    {guestName}
                                </div>
                                <div style={{ fontSize: 11, color: palette.muted, marginTop: 2 }}>{t('guestsCount', { count: adults })}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: palette.faint, textTransform: 'uppercase', marginBottom: 4 }}>{tAll('checkout.success.room')}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: palette.title, lineHeight: 1.3 }}>{roomName || t('roomFallback')}</div>
                                {nights && <div style={{ fontSize: 11, color: palette.muted, marginTop: 2 }}>{t('nightsCount', { count: nights })}</div>}
                            </div>
                        </div>

                        <div style={{ height: 1, background: palette.hairline, margin: '0 0 20px' }} />

                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: palette.faint, textTransform: 'uppercase', marginBottom: 12 }}>{t('priceBreakdown')}</div>
                            {nights && nightlyPrice > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: palette.soft, marginBottom: 8 }}>
                                    <span>{currency} {Math.round(nightlyPrice).toLocaleString()} × {t('nightsCount', { count: nights })}</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {(nightlyPrice * nights).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            )}
                            {fee > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: palette.soft, marginBottom: 8 }}>
                                    <span>{t('serviceFee')}</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {fee.toLocaleString()}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: palette.title, paddingTop: 12, borderTop: `1px solid ${palette.hairline}` }}>
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
                            style={{ padding: '12px 24px', borderRadius: 100, border: 'none', background: ACCENT_FILL, boxShadow: BRAND.gradientShadow, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
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
    // Flights only: hotels admit children by age, and have no infant seat to price.
    const infants      = parseInt(searchParams.get('infants') ?? '0', 10);
    const totalPrice   = parseFloat(searchParams.get('totalPrice') ?? '0');
    const currency     = searchParams.get('currency')     ?? 'USD';
    const rateKey      = searchParams.get('rateKey')      ?? searchParams.get('offerId') ?? '';
    const roomName     = searchParams.get('roomName')     ?? '';
    const hotelName    = searchParams.get('hotelName')    ?? 'Hotel';
    const hotelAddress = searchParams.get('hotelAddress') ?? '';
    const hotelCity    = searchParams.get('hotelCity')    ?? '';
    const hotelCountry = searchParams.get('hotelCountry') ?? '';
    const hotelImage   = searchParams.get('hotelImage')   ?? '';
    // A total the browser did not convert, to compare the server's quote with; absent otherwise.
    const expectedTotalParam = parseFloat(searchParams.get('expectedTotal') ?? '');
    // The search may have asked for several rooms. Checkout books one, and says so.
    const roomsRequested = Math.max(1, parseInt(searchParams.get('rooms') ?? '1', 10) || 1);

    // ── Flight params ──
    const totalAmount    = parseFloat(searchParams.get('totalAmount') ?? '0');
    const flightCurrency = searchParams.get('currency') ?? 'USD';
    const origin         = searchParams.get('origin')         ?? '';
    const destination    = searchParams.get('destination')    ?? '';
    const departureDate  = searchParams.get('departureDate')  ?? checkIn;
    /** Local `YYYY-MM-DD`: the date fields' limits are counted from it. */
    const todayIso = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, []);
    const cabin          = searchParams.get('cabin')          ?? undefined;

    // ── Date helpers ──
    const nights = nightsBetween(checkIn, checkOut);
    const fmtDate = (d: string) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

    // ── State ──
    // The flight checkout's step. The hotel's comes from its state machine (`step` below).
    const [flightStep, setStep]     = useState<Step>('form');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg]   = useState<string | null>(null);

    // Flight booking state. The hotel's lives in `useHotelCheckout`.
    const [clientSecret, setClientSecret]   = useState<string | null>(null);
    /** The booking session `/flights/book` opened, which `/flights/confirm` settles. */
    const [flightSessionId, setFlightSessionId] = useState<string>('');
    const [bookingId, setBookingId]         = useState<string | null>(null);
    /** Paid for, but the airline has not settled it yet: the API answered BOOKING_PROCESSING. */
    const [flightSettling, setFlightSettling] = useState<'pending' | 'needs_review' | null>(null);

    // Hotel guest form — passenger 1 is the booking holder
    const [guest, setGuest]             = useState<GuestInfo>({ firstName: '', lastName: '', email: '', phone: '', phoneCode: '+63' });

    // Hotel co-guests — passenger 2..N, name only
    const [coGuests, setCoGuests]           = useState<CoGuest[]>(() =>
        Array.from({ length: Math.max(0, adults - 1) }, () => ({ firstName: '', lastName: '' }))
    );
    // Each child: their age is what a supplier admits and prices them by. A name is optional.
    const [kids, setKids] = useState<HotelGuestForm['children']>(() =>
        Array.from({ length: Math.max(0, children) }, () => ({ firstName: '', lastName: '', age: '' }))
    );
    const [specialRequests, setSpecialRequests] = useState('');
    /** Keyed by field path (`holder.email`, `coGuests.1.lastName`); the values are message keys. */
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const fieldError = (path: string) => (fieldErrors[path] ? t(fieldErrors[path] as never) : undefined);

    // Flight form
    // One form per traveller the fare was priced for — adults, then children, then infants,
    // the order the offer lists them in and the order the airline matches them by.
    const [passengers, setPassengers]         = useState<PassengerInfo[]>(() => {
        const blank = (type: PassengerInfo['type']): PassengerInfo => ({
            type, firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
            gender: '', passportNumber: '', passportExpiry: '', nationality: '',
        });
        return [
            ...Array.from({ length: Math.max(1, adults) }, () => blank('ADT')),
            ...Array.from({ length: Math.max(0, children) }, () => blank('CHD')),
            ...Array.from({ length: Math.max(0, infants) }, () => blank('INF')),
        ];
    });
    /** The lead traveller's dial code. Without it the API reads a national number as Korean. */
    const [contactPhoneCode, setContactPhoneCode] = useState('+63');
    const [passengerErrors, setPassengerErrors] = useState<Record<string, string>>({});

    // Pre-fill from logged-in user
    useEffect(() => {
        if (user?.email)      setGuest(g => ({ ...g, email:     g.email     || user.email }));
        if (user?.first_name) setGuest(g => ({ ...g, firstName: g.firstName || (user.first_name ?? '') }));
        if (user?.last_name)  setGuest(g => ({ ...g, lastName:  g.lastName  || (user.last_name  ?? '') }));
    }, [user]);

    // ── Guest helpers ──
    const clearError = useCallback((path: string) => {
        setFieldErrors(e => { if (!(path in e)) return e; const n = { ...e }; delete n[path]; return n; });
    }, []);

    const onGuest = useCallback((field: keyof GuestInfo, value: string) => {
        setGuest(g => ({ ...g, [field]: value }));
        clearError(`holder.${field}`);
    }, [clearError]);

    const onCoGuest = useCallback((index: number, field: keyof CoGuest, value: string) => {
        setCoGuests(gs => gs.map((g, i) => i === index ? { ...g, [field]: value } : g));
        clearError(`coGuests.${index}.${field}`);
    }, [clearError]);

    const onKid = useCallback((index: number, field: 'firstName' | 'lastName' | 'age', value: string) => {
        setKids(ks => ks.map((k, i) => i === index ? { ...k, [field]: value } : k));
        clearError(`children.${index}.${field}`);
    }, [clearError]);

    const onPassenger = useCallback((index: number, field: keyof PassengerInfo, value: string) => {
        setPassengers(ps => ps.map((p, i) => i === index ? { ...p, [field]: value } : p));
        setPassengerErrors(e => { const n = { ...e }; delete n[`${index}.${field}`]; return n; });
    }, []);

    // ── Hotel checkout ──
    //
    // The whole hotel conversation — quote on arrival, the payment, the confirm, and finding
    // out what became of a confirm whose answer was lost — is `useHotelCheckout`. The page
    // keeps the form and what is drawn.
    const stay = useMemo(
        () => ({ hotelName, roomName, hotelImage, checkIn, checkOut, adults, children, currency }),
        [hotelName, roomName, hotelImage, checkIn, checkOut, adults, children, currency],
    );
    const hotel = useHotelCheckout({
        enabled: mode === 'hotel' && !!rateKey,
        rateKey,
        stay,
        placeholderTotal: totalPrice,
        initialExpectedTotal: Number.isFinite(expectedTotalParam) && expectedTotalParam > 0 ? expectedTotalParam : undefined,
    });
    const hotelState: HotelCheckoutState = hotel.state;
    const display: HotelDisplay | null = hotelState.quote?.display ?? null;

    /** Which of the three steps the traveller is on. */
    const hotelStep: Step =
        hotelState.phase === 'awaiting_payment' || hotelState.phase === 'confirming' ? 'payment'
        : hotelState.phase === 'confirmed' ? 'confirmed'
        : 'form';
    const step: Step = mode === 'hotel' ? hotelStep : flightStep;

    // A refresh, a back-button or an email link must not drop the traveller back into a checkout
    // whose payment has been taken. Once there is a booking, its address is the page.
    useEffect(() => {
        if (mode !== 'hotel' || !hotelState.reference) return;
        if (!['confirmed', 'pending', 'needs_review'].includes(hotelState.phase)) return;
        const path = window.location.pathname.replace(/\/checkout\/?$/, `/booking/${encodeURIComponent(hotelState.reference)}`);
        if (path !== window.location.pathname) window.history.replaceState(null, '', path);
    }, [mode, hotelState.phase, hotelState.reference]);

    /** Who is staying, in the shape the validator and the payload builder share. */
    const guestForm: HotelGuestForm = {
        holder: {
            firstName: guest.firstName, lastName: guest.lastName, email: guest.email,
            phoneCode: guest.phoneCode, phone: guest.phone,
        },
        coGuests,
        children: kids,
        specialRequests,
    };

    // ── Hotel step 1: details → payment ──
    const handleHotelSubmitForm = async () => {
        const result = validateHotelGuestForm(guestForm);
        if (!result.ok) {
            setFieldErrors(result.errors);
            return;
        }
        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }
        setFieldErrors({});
        await hotel.submitDetails(buildHotelGuestPayload(guestForm));
    };

    // ── Flight: Stripe authorised the card → ask the airline ──
    // The card is held, not charged. `/flights/confirm` places the airline order and takes
    // the money only once the airline has said yes; when it says no, the hold is released
    // and the payment form behind this step has nothing left to pay with.
    const handleFlightPaid = useCallback(async (stripePaymentIntentId: string) => {
        setSubmitting(true); setErrorMsg(null);
        const backToDetails = () => { setClientSecret(null); setFlightSessionId(''); setStep('form'); };
        try {
            const flightRes = await http.post<{ bookingId: string; pnr?: string; status: string }>(
                '/flights/confirm',
                { paymentIntentId: stripePaymentIntentId, sessionId: flightSessionId },
            );
            setBookingId(flightRes.bookingId);
            setStep('confirmed');
        } catch (err) {
            const failure = readFlightConfirmError(err);
            switch (failure.kind) {
                case 'processing':
                    setFlightSettling(failure.needsReview ? 'needs_review' : 'pending');
                    break;
                case 'price_changed':
                    setErrorMsg(t('flight.priceChanged', {
                        was: `${failure.currency} ${failure.was.toLocaleString()}`,
                        now: `${failure.currency} ${failure.now.toLocaleString()}`,
                    }));
                    backToDetails();
                    break;
                case 'offer_expired':
                    setErrorMsg(t('flight.offerExpired'));
                    backToDetails();
                    break;
                case 'refused':
                    setErrorMsg(failure.message || t('failed.released'));
                    backToDetails();
                    break;
                default:
                    setErrorMsg(failure.message || 'Booking confirmation failed. Contact support with your payment reference.');
            }
        } finally {
            setSubmitting(false);
        }
    }, [flightSessionId, t]);

    // The same Stripe form serves both; what happens after a card is authorised does not.
    const handleStripeSuccess = mode === 'flight' ? handleFlightPaid : hotel.onCardAuthorised;
    const handleStripeError = (msg: string) => (mode === 'flight' ? setErrorMsg(msg) : hotel.onCardError(msg));
    const hotelSubmitting = submitting || hotel.busy;

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
            // `/flights/book` opens a PaymentIntent that holds the card; it orders nothing
            // and takes nothing. The airline is asked once the card is authorised, by
            // `/flights/confirm`. This used to jump straight to "confirmed" on its response,
            // so the step that pays never ran.
            const res = await http.post<{ clientSecret: string; sessionId: string; paymentIntentId: string }>(
                '/flights/book',
                {
                    offerId, currency: flightCurrency,
                    contact: { email: passengers[0].email, phone: passengers[0].phone, countryCode: contactPhoneCode },
                    // Stable per attempt, so a retry after a dropped response cannot buy a
                    // second ticket.
                    idempotencyKey: `flight-${offerId}-${passengers[0].email}`,
                    passengers: passengers.map(p => ({
                        firstName: p.firstName, lastName: p.lastName,
                        // Duffel puts the booking's contact on every passenger.
                        email: passengers[0].email, phone: passengers[0].phone,
                        dateOfBirth: p.dateOfBirth, gender: p.gender,
                        passportNumber: p.passportNumber, passportExpiry: p.passportExpiry,
                        nationality: p.nationality.trim().toUpperCase(), type: p.type,
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
    }, [passengers, contactPhoneCode, user, router, offerId, flightCurrency]);

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
        if (mode === 'hotel' && step === 'payment') hotel.backToDetails();
        else if (step === 'payment') setStep('form');
        else router.back();
    }

    const rootStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: palette.bg,
        color: palette.text,
    };

    const sectionLabelStyle: React.CSSProperties = {
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: palette.title,
        marginBottom: 16,
    };

    const fieldCss = (
        <style>{`
            @keyframes spin{to{transform:rotate(360deg)}}
            .cg-field::placeholder{color:${palette.muted};opacity:1}
            .cg-field:focus,.cg-phone:focus-within{border-color:transparent !important;background:linear-gradient(${palette.fieldBg},${palette.fieldBg}) padding-box,${ACCENT_FILL} border-box !important;box-shadow:0 0 0 4px ${BRAND.primaryWash}}
            .cg-phone .cg-field:focus{background:none !important;box-shadow:none}
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
                bookingId={mode === 'hotel' ? (hotelState.reference ?? null) : bookingId}
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

    // ── Booked, but not settled ──
    if (mode === 'flight' && flightSettling) {
        return (
            <div style={rootStyle}>
                {fieldCss}
                <div style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(24px,5vw,64px) 16px' }}>
                    <SettlingPanel
                        kind="flight"
                        phase={flightSettling}
                        palette={palette}
                        onViewTrips={() => router.push('/trips')}
                    />
                </div>
            </div>
        );
    }
    if (mode === 'hotel' && (hotelState.phase === 'pending' || hotelState.phase === 'needs_review')) {
        return (
            <div style={rootStyle}>
                {fieldCss}
                <div style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(24px,5vw,64px) 16px' }}>
                    <SettlingPanel
                        phase={hotelState.phase}
                        reference={hotelState.reference}
                        palette={palette}
                        onViewTrips={() => router.push('/trips')}
                    />
                </div>
            </div>
        );
    }

    // ── Not logged in helper ──
    // Tinted with the checkout's accent, as its other notices are, and in the page's language.
    function AuthBanner() {
        if (user) return null;
        return (
            <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, border: `1px solid ${ACCENT}55`, background: `${ACCENT}14`, fontSize: 13, color: palette.soft }}>
                <strong style={{ color: palette.title }}>{tAll('checkout.signInToComplete')}</strong>
                <div style={{ marginTop: 2 }}>{tAll('checkout.signInBannerDesc')}</div>
                <button
                    onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                    style={{ color: ACCENT, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0, marginTop: 8 }}
                >
                    {tAll('checkout.signInArrow')}
                </button>
            </div>
        );
    }

    // ── Summary card (right column) ───────────────────────────────────────────
    function SummaryCard() {
        const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, color: palette.text };
        const rule = <div aria-hidden style={{ height: 1, background: palette.cardLine, margin: '12px 0' }} />;
        return (
            <div style={{ position: 'sticky', top: 24 }}>
                <div style={{ background: palette.surface, borderRadius: 12, overflow: 'hidden' }}>
                    {hotelImage && (
                        <div style={{ height: 204, overflow: 'hidden' }}>
                            <img src={hotelImage} alt={hotelName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                    )}

                    <div style={{ padding: '18px 30px 26px' }}>
                        {mode === 'hotel' ? (
                            <>
                                <div style={{ fontWeight: 700, fontSize: 17, color: palette.title }}>{hotelName}</div>
                                {roomName && <div style={{ fontSize: 13, color: palette.text, marginTop: 4 }}>{roomName}</div>}
                                {hotelAddress && (
                                    <div style={{ fontSize: 13, color: palette.text, marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                                        <MapPin size={13} strokeWidth={1.75} style={{ marginTop: 1, flexShrink: 0 }} />
                                        <span>{[hotelAddress, hotelCity].filter(Boolean).join(', ')}</span>
                                    </div>
                                )}

                                {rule}

                                <div style={{ display: 'grid', gap: 8 }}>
                                    {[
                                        { label: t('summary.dates'),  value: formatStayDates(checkIn, checkOut) },
                                        { label: t('summary.guests'), value: t('guestsCount', { count: adults + children }) },
                                        { label: t('summary.room'),   value: roomName },
                                    ].filter(r => r.value).map(r => (
                                        <div key={r.label} style={row}>
                                            <span style={{ flexShrink: 0 }}>{r.label}</span>
                                            <span style={{ textAlign: 'right' }}>{r.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {rule}

                                <div style={{ display: 'grid', gap: 8 }}>
                                    {nights && nightlyPrice > 0 && (
                                        <div style={row}>
                                            <span>{shownCurrency} {Math.round(nightlyPrice).toLocaleString()} × {t('nightsCount', { count: nights })}</span>
                                            <span>{shownCurrency} {roomTotal.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {/* No service fee line: it is folded into the total below
                                        (the server's charged figure), not itemised here. */}
                                    {!display && (
                                        <div style={{ fontSize: 12, color: palette.muted }}>{t('confirmingFinalPrice')}</div>
                                    )}
                                </div>

                                {rule}

                                <div style={{ ...row, fontWeight: 700, color: palette.title }}>
                                    <span>{t('summary.total')}</span>
                                    <span>{shownCurrency} {total.toLocaleString()}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontWeight: 700, fontSize: 17, color: palette.title }}>
                                    {origin} → {destination}
                                </div>
                                {departureDate && <div style={{ fontSize: 13, color: palette.text, marginTop: 4 }}>{fmtDate(departureDate)}</div>}
                                {cabin && <div style={{ fontSize: 13, color: palette.soft }}>{cabin}</div>}
                                {rule}
                                <div style={{ ...row, fontWeight: 700, color: palette.title }}>
                                    <span>{tAll('checkout.success.total')}</span>
                                    <span>{flightCurrency} {totalAmount.toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Flight checkout: passengers, then payment ────────────────────────────
    // Drawn with the same parts as the hotel checkout below — toolbar, steps, heading, labelled
    // sections over a two-column field grid, the summary beside it — so the two read as one
    // checkout rather than a page and its older cousin.
    if (mode === 'flight') {
        const flightBackLabel = step === 'payment' ? t('backToBookingDetails') : tAll('property.v2.goBack');
        const fieldGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 18 };
        // A contact detail or a single answer takes the left column, as on the hotel form;
        // on a phone the half is too narrow, so it takes the row.
        const half = 'col-span-2 sm:col-span-1';

        return (
            <div style={rootStyle}>
                {fieldCss}
                <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,44px) 72px' }}>
                    <CheckoutToolbar palette={palette} backLabel={flightBackLabel} onBack={handleBack} />

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,645px)_minmax(300px,370px)] lg:justify-between gap-x-[clamp(40px,8vw,130px)]">
                        <div className="lg:col-start-2 lg:row-start-1 flex lg:justify-center mb-8 lg:mb-0 lg:pt-1.5">
                            <ProgressBar step={step} palette={palette} />
                        </div>

                        <div className="lg:col-start-1 lg:row-start-1">
                            <h1 className="font-bold tracking-[-0.01em] lg:whitespace-nowrap" style={{ fontSize: 'clamp(36px,4.4vw,60px)', lineHeight: 1.05, color: palette.title, margin: 0 }}>
                                {step === 'payment' ? t('paymentDetailsTitle') : t('completeYourBooking')}
                            </h1>
                            {step === 'form' && (
                                <p style={{ fontSize: 'clamp(19px,2.2vw,32px)', fontWeight: 400, lineHeight: 1.25, color: palette.text, margin: '10px 0 0' }}>
                                    {t('flight.whosFlying')}
                                </p>
                            )}
                        </div>

                        <div className="lg:col-start-1 lg:row-start-2 min-w-0" style={{ marginTop: step === 'form' ? 30 : 26 }}>
                            {errorMsg && (
                                <div role="alert" style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, border: `1px solid ${DANGER}55`, background: `${DANGER}14`, fontSize: 13, color: DANGER }}>
                                    {errorMsg}
                                </div>
                            )}

                            <AuthBanner />

                            {step === 'form' && <>
                                {passengers.map((p, i) => {
                                    const id = (field: string) => `pax-${i}-${field}`;
                                    const err = (field: string) => passengerErrors[`${i}.${field}`];
                                    // Numbered within its own type, as the airline lists them.
                                    const nth = passengers.slice(0, i + 1).filter(q => q.type === p.type).length;
                                    const heading = p.type === 'CHD' ? tAll('checkout.userDetails.childN', { n: nth })
                                        : p.type === 'INF' ? t('flight.infantN', { n: nth })
                                            : t('flight.adultN', { n: nth });
                                    return (
                                        <section key={i} style={{ marginBottom: 28 }}>
                                            <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>{heading}</div>
                                            <p style={{ fontSize: 12, color: palette.muted, margin: '0 0 16px' }}>{t('flight.nameHint')}</p>
                                            <div style={fieldGrid}>
                                                <div>
                                                    <Label palette={palette} icon={User} htmlFor={id('firstName')}>{tAll('checkout.userDetails.firstName')}</Label>
                                                    <input id={id('firstName')} type="text" autoComplete={i === 0 ? 'given-name' : 'off'} value={p.firstName} onChange={e => onPassenger(i, 'firstName', e.target.value)} placeholder={tAll('checkout.userDetails.firstNamePlaceholder')} className="cg-field" style={mkField(palette, !!err('firstName'))} />
                                                    <ErrText msg={err('firstName')} />
                                                </div>
                                                <div>
                                                    <Label palette={palette} icon={User} htmlFor={id('lastName')}>{tAll('checkout.userDetails.lastName')}</Label>
                                                    <input id={id('lastName')} type="text" autoComplete={i === 0 ? 'family-name' : 'off'} value={p.lastName} onChange={e => onPassenger(i, 'lastName', e.target.value)} placeholder={tAll('checkout.userDetails.lastNamePlaceholder')} className="cg-field" style={mkField(palette, !!err('lastName'))} />
                                                    <ErrText msg={err('lastName')} />
                                                </div>

                                                {/* Contact details once, on the lead traveller: they are the booking's
                                                    contact, where the e-ticket goes and what the airline calls. */}
                                                {i === 0 && <>
                                                    <div className={`${half} sm:col-start-1`}>
                                                        <Label palette={palette} icon={Mail} htmlFor={id('email')}>{tAll('checkout.userDetails.email')}</Label>
                                                        <input id={id('email')} type="email" autoComplete="email" value={p.email} onChange={e => onPassenger(i, 'email', e.target.value)} placeholder={tAll('checkout.userDetails.emailPlaceholder')} className="cg-field" style={mkField(palette, !!err('email'))} />
                                                        <ErrText msg={err('email')} />
                                                    </div>
                                                    <div className={`${half} sm:col-start-1`}>
                                                        <Label palette={palette} icon={Phone} htmlFor={id('phone')}>{tAll('checkout.userDetails.phoneNumber')}</Label>
                                                        <PhoneField
                                                            palette={palette}
                                                            inputId={id('phone')}
                                                            placeholder={tAll('checkout.userDetails.phonePlaceholder')}
                                                            code={contactPhoneCode}
                                                            number={p.phone}
                                                            onCode={setContactPhoneCode}
                                                            onNumber={v => onPassenger(i, 'phone', v)}
                                                            error={err('phone')}
                                                        />
                                                        <ErrText msg={err('phone')} />
                                                    </div>
                                                    <p className="col-span-2" style={{ fontSize: 12, color: palette.muted, margin: '-8px 4px 0' }}>{t('flight.contactHint')}</p>
                                                </>}

                                                <div className={half}>
                                                    <Label palette={palette} icon={Calendar} htmlFor={id('dateOfBirth')}>{tAll('checkout.userDetails.dateOfBirth')}</Label>
                                                    {/* Only the birthdays the airline accepts for this passenger's type, on the day they fly. */}
                                                    <DateField id={id('dateOfBirth')} value={p.dateOfBirth} onChange={v => onPassenger(i, 'dateOfBirth', v)}
                                                        {...birthDateBounds(p.type, departureDate, todayIso)} openTo="year"
                                                        palette={palette} className="cg-field" style={mkField(palette, !!err('dateOfBirth'))} />
                                                    <ErrText msg={err('dateOfBirth')} />
                                                </div>
                                                <div className={half}>
                                                    <Label palette={palette} icon={User} htmlFor={id('gender')}>{tAll('checkout.userDetails.gender')}</Label>
                                                    {/* Required by the check above and sent with the booking, but the
                                                        control was missing, so the form could never be submitted. */}
                                                    <select id={id('gender')} value={p.gender} onChange={e => onPassenger(i, 'gender', e.target.value)} className="cg-field" style={{ ...mkField(palette, !!err('gender')), color: p.gender ? palette.text : palette.muted }}>
                                                        <option value="" disabled>{tAll('checkout.userDetails.gender')}</option>
                                                        <option value="M">{tAll('checkout.userDetails.genderMale')}</option>
                                                        <option value="F">{tAll('checkout.userDetails.genderFemale')}</option>
                                                    </select>
                                                    <ErrText msg={err('gender')} />
                                                </div>
                                                <div className={half}>
                                                    <Label palette={palette} htmlFor={id('passportNumber')}>{tAll('checkout.userDetails.passportNumber')}</Label>
                                                    <input id={id('passportNumber')} type="text" autoComplete="off" value={p.passportNumber} onChange={e => onPassenger(i, 'passportNumber', e.target.value)} placeholder={t('flight.passportPlaceholder')} className="cg-field" style={mkField(palette, !!err('passportNumber'))} />
                                                    <ErrText msg={err('passportNumber')} />
                                                </div>
                                                <div className={half}>
                                                    <Label palette={palette} icon={Calendar} htmlFor={id('passportExpiry')}>{tAll('checkout.userDetails.passportExpiry')}</Label>
                                                    <DateField id={id('passportExpiry')} value={p.passportExpiry} onChange={v => onPassenger(i, 'passportExpiry', v)}
                                                        {...passportExpiryBounds(departureDate, todayIso)} openTo="day"
                                                        palette={palette} className="cg-field" style={mkField(palette, !!err('passportExpiry'))} />
                                                    <ErrText msg={err('passportExpiry')} />
                                                </div>
                                                <div className={half}>
                                                    <Label palette={palette} htmlFor={id('nationality')}>{tAll('checkout.userDetails.nationality')}</Label>
                                                    <input id={id('nationality')} type="text" value={p.nationality} maxLength={2} autoCapitalize="characters" onChange={e => onPassenger(i, 'nationality', e.target.value.toUpperCase())} placeholder="PH" className="cg-field" style={mkField(palette, !!err('nationality'))} />
                                                    <ErrText msg={err('nationality')} />
                                                </div>
                                            </div>
                                        </section>
                                    );
                                })}

                                <div style={{ marginTop: 40 }}>
                                    <PrimaryBtn onClick={handleFlightSubmit} loading={submitting}>
                                        {t('continueToPayment')}
                                    </PrimaryBtn>
                                </div>
                            </>}

                            {step === 'payment' && clientSecret && (
                                <>
                                    <p style={{ fontSize: 13, lineHeight: 1.5, color: palette.soft, margin: '0 0 18px' }}>{t('flight.cardHeld')}</p>
                                    <Elements stripe={getStripe()} options={{ clientSecret, appearance: stripeAppearance(palette, theme) }}>
                                        <StripePaymentForm
                                            onSuccess={handleStripeSuccess}
                                            onError={handleStripeError}
                                            total={totalAmount}
                                            currency={flightCurrency}
                                            submitting={submitting}
                                            setSubmitting={setSubmitting}
                                            palette={palette}
                                        />
                                    </Elements>
                                </>
                            )}

                            <p style={{ fontSize: 11, color: palette.faint, textAlign: 'center', marginTop: 14 }}>
                                {t('agreePrefix')} <Link href="/terms" style={{ color: palette.soft, textDecoration: 'underline' }}>{tRoot('footer.terms')}</Link> {tRoot('legal.termsGate.checkboxConnector')} <Link href="/privacy" style={{ color: palette.soft, textDecoration: 'underline' }}>{tRoot('footer.privacyMinimal')}</Link>.
                            </p>
                        </div>

                        {/* Right: summary, under the steps */}
                        <aside className="lg:col-start-2 lg:row-start-2 mt-10 lg:mt-0" style={{ paddingTop: step === 'form' ? 50 : 80 }}>
                            <SummaryCard />
                        </aside>
                    </div>
                </div>
            </div>
        );
    }

    // ── Hotel checkout ────────────────────────────────────────────────────────
    const backLabel = step === 'payment' ? t('backToBookingDetails') : tAll('property.v2.goBack');
    const fieldGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 18 };

    return (
        <div style={rootStyle}>
            {fieldCss}
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,44px) 72px' }}>
                <CheckoutToolbar palette={palette} backLabel={backLabel} onBack={handleBack} />

                {/* Two columns on a wide screen — heading and form on the left, the
                    steps over the summary on the right, as drawn. Stacked, the steps
                    lead: they say where you are before the heading says what to do. */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,645px)_minmax(300px,370px)] lg:justify-between gap-x-[clamp(40px,8vw,130px)]">
                    <div className="lg:col-start-2 lg:row-start-1 flex lg:justify-center mb-8 lg:mb-0 lg:pt-1.5">
                        <ProgressBar step={step} palette={palette} />
                    </div>

                    <div className="lg:col-start-1 lg:row-start-1">
                        {/* One line from `lg` up, as drawn — it may run past the form column into
                            the gutter, which the steps never reach. Sized so it always fits there. */}
                        <h1 className="font-bold tracking-[-0.01em] lg:whitespace-nowrap" style={{ fontSize: 'clamp(36px,4.4vw,60px)', lineHeight: 1.05, color: palette.title, margin: 0 }}>
                            {step === 'payment' ? t('paymentDetailsTitle') : t('completeYourBooking')}
                        </h1>
                        {step === 'form' && (
                            <p style={{ fontSize: 'clamp(19px,2.2vw,32px)', fontWeight: 400, lineHeight: 1.25, color: palette.text, margin: '10px 0 0' }}>
                                {t('whosCheckingInYou')}
                            </p>
                        )}
                    </div>

                    <div className="lg:col-start-1 lg:row-start-2 min-w-0" style={{ marginTop: step === 'form' ? 30 : 26 }}>
                        {errorMsg && (
                            <div role="alert" style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, border: `1px solid ${DANGER}55`, background: `${DANGER}14`, fontSize: 13, color: DANGER }}>
                                {errorMsg}
                            </div>
                        )}

                        {roomsRequested > 1 && <MultiRoomNotice palette={palette} />}

                        {hotelState.phase === 'price_changed' && (
                            <PriceMovedPanel
                                change={hotelState.quote?.priceChange}
                                refreshing={hotel.busy}
                                palette={palette}
                                onAccept={hotel.acceptPrice}
                                onChooseAnother={() => router.back()}
                            />
                        )}
                        {hotelState.phase === 'unavailable' && (
                            <RoomUnavailablePanel
                                kind={hotelState.failure?.kind === 'not_payable_online' ? 'not_payable_online' : 'unavailable'}
                                palette={palette}
                                onChooseAnother={() => router.back()}
                            />
                        )}
                        {hotelState.phase === 'supplier_down' && (
                            <SupplierDownPanel palette={palette} busy={hotel.busy} onRetry={() => void hotel.refreshQuote()} />
                        )}
                        {hotelState.phase === 'failed' && hotelState.failure?.kind === 'duplicate' && (
                            <div role="alert" style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, border: `1px solid ${DANGER}55`, background: `${DANGER}14`, fontSize: 13, color: DANGER }}>
                                <div>{t('duplicateBookingTitle', { hotel: hotelName })}</div>
                                <div style={{ marginTop: 4, color: palette.soft }}>{t('duplicateBookingDesc')}</div>
                                {hotelState.failure.existingBookingId && (
                                    <Link href={`/trips/${hotelState.failure.existingBookingId}`} style={{ color: ACCENT, fontWeight: 700 }}>
                                        {t('viewExistingBooking')}
                                    </Link>
                                )}
                            </div>
                        )}
                        {hotelState.phase === 'failed' && hotelState.failure?.kind !== 'duplicate' && (
                            <BookingFailedPanel
                                released={hotelState.outcome?.kind === 'failed' ? hotelState.outcome.released : false}
                                message={hotelState.outcome?.kind === 'failed' ? hotelState.outcome.message : (hotelState.failure?.message ?? '')}
                                palette={palette}
                                onTryAgain={hotel.restart}
                            />
                        )}
                        {/* A refusal the traveller can act on in place: the form stays, with the reason. */}
                        {hotelState.phase === 'quoted' && hotelState.failure && (
                            <div role="alert" style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, border: `1px solid ${DANGER}55`, background: `${DANGER}14`, fontSize: 13, color: DANGER }}>
                                {hotelState.failure.message}
                            </div>
                        )}
                        {/* A declined card is retried on the same payment. */}
                        {hotelState.phase === 'awaiting_payment' && hotelState.message && (
                            <div role="alert" style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, border: `1px solid ${DANGER}55`, background: `${DANGER}14`, fontSize: 13, color: DANGER }}>
                                {hotelState.message}
                            </div>
                        )}

                        <AuthBanner />

                        {/* Step 1: guest details */}
                        {step === 'form' && hotelState.phase !== 'unavailable' && hotelState.phase !== 'failed' && (
                            <>
                                {/* Guest 1 — the booking holder */}
                                <section style={{ marginBottom: 28 }}>
                                    <div style={sectionLabelStyle}>{t('userDetails.guest1')}</div>
                                    <div style={fieldGrid}>
                                        <div>
                                            <Label palette={palette} icon={User}>{t('userDetails.firstNamePlaceholder')}</Label>
                                            <input type="text" autoComplete="given-name" value={guest.firstName} onChange={e => onGuest('firstName', e.target.value)} placeholder="John" className="cg-field" style={mkField(palette, !!fieldError('holder.firstName'))} />
                                            <ErrText msg={fieldError('holder.firstName')} />
                                        </div>
                                        <div>
                                            <Label palette={palette} icon={User}>{t('userDetails.lastNamePlaceholder')}</Label>
                                            <input type="text" autoComplete="family-name" value={guest.lastName} onChange={e => onGuest('lastName', e.target.value)} placeholder="Doe" className="cg-field" style={mkField(palette, !!fieldError('holder.lastName'))} />
                                            <ErrText msg={fieldError('holder.lastName')} />
                                        </div>
                                        {/* Email and phone keep to the left column, as drawn — a
                                            name splits in two, a contact detail does not. On a
                                            phone the half is too narrow for an address, so both
                                            take the full row. */}
                                        <div className="col-span-2 sm:col-span-1 sm:col-start-1">
                                            <Label palette={palette} icon={Mail}>{t('userDetails.emailPlaceholder')}</Label>
                                            <input type="email" autoComplete="email" value={guest.email} onChange={e => onGuest('email', e.target.value)} placeholder="eg.johndoe@gmail.com" className="cg-field" style={mkField(palette, !!fieldError('holder.email'))} />
                                            <ErrText msg={fieldError('holder.email')} />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 sm:col-start-1">
                                            <Label palette={palette} icon={Phone}>{t('userDetails.phoneNumber')}</Label>
                                            <PhoneField
                                                palette={palette}
                                                code={guest.phoneCode}
                                                number={guest.phone}
                                                onCode={v => onGuest('phoneCode', v)}
                                                onNumber={v => onGuest('phone', v)}
                                                error={fieldError('holder.phone')}
                                            />
                                            <ErrText msg={fieldError('holder.phone')} />
                                        </div>
                                    </div>
                                </section>

                                {/* Guests 2..N — name only */}
                                {coGuests.map((g, i) => (
                                    <section key={i} style={{ marginBottom: 28 }}>
                                        <div style={sectionLabelStyle}>{t('userDetails.guestN', { n: i + 2 })}</div>
                                        <div style={fieldGrid}>
                                            <div>
                                                <Label palette={palette} icon={User}>{t('userDetails.firstNamePlaceholder')}</Label>
                                                <input type="text" value={g.firstName} onChange={e => onCoGuest(i, 'firstName', e.target.value)} placeholder="Mike" className="cg-field" style={mkField(palette, !!fieldError(`coGuests.${i}.firstName`))} />
                                                <ErrText msg={fieldError(`coGuests.${i}.firstName`)} />
                                            </div>
                                            <div>
                                                <Label palette={palette} icon={User}>{t('userDetails.lastNamePlaceholder')}</Label>
                                                <input type="text" value={g.lastName} onChange={e => onCoGuest(i, 'lastName', e.target.value)} placeholder="Hunt" className="cg-field" style={mkField(palette, !!fieldError(`coGuests.${i}.lastName`))} />
                                                <ErrText msg={fieldError(`coGuests.${i}.lastName`)} />
                                            </div>
                                        </div>
                                    </section>
                                ))}

                                {/* Children — an age is what a supplier admits and prices them by */}
                                {kids.map((k, i) => (
                                    <section key={`kid-${i}`} style={{ marginBottom: 28 }}>
                                        <div style={sectionLabelStyle}>{t('userDetails.childN', { n: i + 1 })}</div>
                                        <div style={fieldGrid}>
                                            <div>
                                                <Label palette={palette}>{t('userDetails.age')}</Label>
                                                <input
                                                    type="number" inputMode="numeric" min={0} max={17} step={1}
                                                    value={k.age} onChange={e => onKid(i, 'age', e.target.value)}
                                                    placeholder={t('userDetails.agePlaceholder')}
                                                    className="cg-field"
                                                    style={mkField(palette, !!fieldError(`children.${i}.age`))}
                                                />
                                                <ErrText msg={fieldError(`children.${i}.age`)} />
                                            </div>
                                        </div>
                                    </section>
                                ))}

                                {/* Special requests: passed to the property, not guaranteed by it */}
                                <section style={{ marginBottom: 28 }}>
                                    <div style={sectionLabelStyle}>{t('specialRequests.title')}</div>
                                    <textarea
                                        value={specialRequests}
                                        onChange={e => { setSpecialRequests(e.target.value); clearError('specialRequests'); }}
                                        placeholder={t('specialRequests.placeholder')}
                                        rows={3}
                                        className="cg-field"
                                        style={{ ...mkField(palette, !!fieldError('specialRequests')), height: 'auto', padding: '12px 16px', borderRadius: 20, resize: 'vertical' }}
                                    />
                                    <ErrText msg={fieldError('specialRequests')} />
                                </section>

                                <div style={{ marginTop: 40 }}>
                                    <PrimaryBtn onClick={handleHotelSubmitForm} loading={hotelSubmitting} disabled={!hotel.canSubmit}>
                                        {t('continueToPayment')}
                                    </PrimaryBtn>
                                </div>
                            </>
                        )}

                        {/* Step 2: Stripe payment */}
                        {step === 'payment' && hotelState.clientSecret && (
                            <Elements stripe={getStripe()} options={{ clientSecret: hotelState.clientSecret, appearance: stripeAppearance(palette, theme) }}>
                                <StripePaymentForm
                                    onSuccess={handleStripeSuccess}
                                    onError={handleStripeError}
                                    total={total}
                                    currency={shownCurrency}
                                    submitting={hotelSubmitting}
                                    setSubmitting={setSubmitting}
                                    palette={palette}
                                />
                            </Elements>
                        )}

                        <p style={{ fontSize: 11, color: palette.faint, textAlign: 'center', marginTop: 14 }}>
                            {t('agreePrefix')} <Link href="/terms" style={{ color: palette.soft, textDecoration: 'underline' }}>{tRoot('footer.terms')}</Link> {tRoot('legal.termsGate.checkboxConnector')} <Link href="/privacy" style={{ color: palette.soft, textDecoration: 'underline' }}>{tRoot('footer.privacyMinimal')}</Link>.
                        </p>
                    </div>

                    {/* Right: summary, under the steps */}
                    <aside className="lg:col-start-2 lg:row-start-2 mt-10 lg:mt-0" style={{ paddingTop: step === 'form' ? 50 : 80 }}>
                        <SummaryCard />
                    </aside>
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

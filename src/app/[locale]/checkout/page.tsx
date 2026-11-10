'use client';

import React, { useState, useCallback, useEffect, useId, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ArrowLeft, Check, Download, Calendar, MapPin, Users, ChevronDown } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { http } from '@/shared/lib/http';
import { useAuthStore } from '@/shared/auth/store';
import { useTheme } from '@/shared/components/ThemeContext';
import { env } from '@/shared/lib/env';
import { formatStayDates } from '@/features/checkout/lib/checkout.helpers';
import { useHotelCheckout } from '@/features/checkout/hooks/use-hotel-checkout';
import type { HotelDisplay, HotelCheckoutState } from '@/features/checkout/lib/hotel-checkout-machine';
import { buildHotelGuestPayload, validateHotelGuestForm, type HotelGuestForm } from '@/features/checkout/lib/hotel-guest-form';
import { readFlightConfirmError } from '@/features/checkout/lib/flight-confirm-errors';
import { FlightConfirmedScreen } from '@/features/checkout/components/flight-confirmed-screen';
import { DuplicateFlightModal, type DuplicateFlight } from '@/features/checkout/components/duplicate-flight-modal';
import { CheckoutAlertDialog, type CheckoutAlert } from '@/features/checkout/components/checkout-alert-dialog';
import { CheckoutToolbar } from '@/features/checkout/components/checkout-toolbar';
import { SkeletonBar } from '@/features/checkout/components/skeleton-bar';
import { CheckoutSkeleton } from '@/features/checkout/components/checkout-skeleton';
import { useFlightOffer } from '@/features/checkout/hooks/use-flight-offer';
import { formatMoney } from '@/features/checkout/lib/format-money';
import { airportLabel, formatDateTime, groupSegmentsIntoSlices } from '@/features/flights/lib/flight-utils';
import { fareGoneSearchHref } from '@/features/flights/lib/flight-checkout-query';
import { birthDateBounds, passportExpiryBounds } from '@/features/checkout/lib/flight-date-bounds';
import { DateField } from '@/features/checkout/components/date-field';
import { AutocompleteSelectField } from '@/features/checkout/components/autocomplete-select-field';
import { OptionList, SelectField } from '@/features/checkout/components/select-field';
import { getCountryOptions } from '@/features/checkout/lib/country-options';
import {
    BookingFailedPanel, MultiRoomNotice, PriceMovedPanel, RoomUnavailablePanel, SettlingPanel, SupplierDownPanel,
} from '@/features/checkout/components/booking-state-panels';
import { nightsBetween } from '@/shared/lib/stay';
import { ACCENT, ACCENT_FILL, GREEN, DANGER, checkoutPalette, type Palette } from '@/features/checkout/lib/palette';
import { FIELD_RADIUS, TOUCH_SIZING_QUERY, stripeAppearance } from '@/features/checkout/lib/stripe-appearance';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
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
    /** Passport issuing country, ISO 3166 alpha-2. */
    country:        string;
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

/**
 * The example person in every name field on the booking forms — flight passengers, the lead
 * guest and every other guest alike, in every language. Split across the two fields, so the
 * first-name box reads as asking for a first name and not a whole one. Shown through
 * `checkout.example` ("e.g. John"): bare, "John" and "Doe" read as answers already filled in.
 */
const EXAMPLE_FIRST_NAME = 'John';
const EXAMPLE_LAST_NAME  = 'Doe';
/** The same person's contact details, so email and phone read as examples too, like the names. */
const EXAMPLE_EMAIL = 'johndoe@gmail.com';
const EXAMPLE_PHONE = '912 345 6789';

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
        if (p.country.trim().length !== 2) errors[`${i}.country`] = '2-letter country code';
    });
    return errors;
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

/**
 * A field's fill and edge. At rest, a hairline in the slate the cards use (`--cg-edge`, which
 * `fieldCss` darkens under the pointer). The brand gradient, blue-600 → cyan-500, rings only the
 * field being typed in — `.cg-field:focus` in `fieldCss` paints it as two background layers, the
 * fill to the padding box and the gradient to the border box — so the accent marks where you
 * are, not every box on the page. A field that is wrong keeps a red edge, focused or not.
 */
function fieldEdge(palette: Palette, hasError = false): React.CSSProperties {
    // `--cg-ring` is the solid colour the focused edge becomes when the browser autofills the
    // field and strips the gradient — see the autofill rules in `fieldCss`. `--cg-focus` is what
    // the focus rule paints the edge with: the gradient, or for a wrong field its red.
    return hasError
        ? { border: `1px solid ${DANGER}`, background: palette.fieldBg, '--cg-ring': DANGER, '--cg-focus': DANGER } as React.CSSProperties
        : { border: `1px solid var(--cg-edge, ${palette.fieldLine})`, background: palette.fieldBg, '--cg-ring': BRAND.primary } as React.CSSProperties;
}

function mkField(palette: Palette, hasError = false): React.CSSProperties {
    return {
        // Sizes from `--cg-field-*` in globals.css: 40px and 14px with a mouse, 48px and 16px on a
        // phone or a touch screen.
        width: '100%', height: 'var(--cg-field-h)', padding: '0 16px', borderRadius: FIELD_RADIUS,
        ...fieldEdge(palette, hasError),
        color: palette.text,
        fontSize: 'var(--cg-field-fs)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    };
}

/**
 * A field's caption. With `htmlFor` it is a real `<label>`, so the field is named by it.
 * `required` appends a quiet " *" — the one way a caption is marked, so the mark looks the same
 * on every field rather than living in some captions' text and not others'. No icon: one beside
 * every caption was ten more marks in the accent, and the same person icon stood for a name and
 * a gender alike.
 */
function Label({ children, palette, htmlFor, required }: { children: React.ReactNode; palette: Palette; htmlFor?: string; required?: boolean }) {
    const style: React.CSSProperties = { display: 'block', fontSize: 'var(--cg-label-fs)', fontWeight: 500, color: palette.text, marginBottom: 8, paddingLeft: 2 };
    const content = <>{children}{required && <span aria-hidden style={{ color: palette.muted }}> *</span>}</>;
    return htmlFor
        ? <label htmlFor={htmlFor} style={style}>{content}</label>
        : <div style={style}>{content}</div>;
}

function ErrText({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <div style={{ fontSize: 'var(--cg-small-fs)', color: DANGER, marginTop: 5, fontWeight: 600 }}>{msg}</div>;
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
    onClick, loading, disabled, children, buttonRef,
}: {
    onClick?: () => void; loading: boolean; disabled?: boolean; children: React.ReactNode;
    /** For handing focus back to it, as the same-day flight dialog does once it closes. */
    buttonRef?: React.Ref<HTMLButtonElement>;
}) {
    const dead = loading || disabled;
    return (
        <button
            ref={buttonRef}
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
    palette, code, number, onCode, onNumber, error, inputId, placeholder, required,
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
    required?:    boolean;
}) {
    const [open, setOpen] = useState(false);
    const current = DIAL_CODES.find(d => d.dial === code) ?? DIAL_CODES[0];
    const codeRef = React.useRef<HTMLButtonElement>(null);
    const codeId = `${inputId ?? 'phone'}-code`;
    const close = () => { setOpen(false); codeRef.current?.focus(); };

    return (
        <div style={{ position: 'relative' }}>
            <div
                className="cg-phone"
                style={{
                    display: 'flex', alignItems: 'center', width: '100%', height: 'var(--cg-field-h)',
                    borderRadius: FIELD_RADIUS, ...fieldEdge(palette, !!error), boxSizing: 'border-box',
                }}
            >
                <button
                    ref={codeRef}
                    id={codeId}
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    onClick={() => (open ? close() : setOpen(true))}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: '100%',
                        background: 'none', border: 'none', color: palette.text, fontSize: 'var(--cg-field-fs)',
                        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    }}
                >
                    <span>{current.dial}</span>
                    <ChevronDown size={14} color={palette.icon} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }} />
                </button>
                <div style={{ width: 1, height: 22, background: palette.hairline, flexShrink: 0 }} />
                <input
                    id={inputId}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder={placeholder}
                    aria-required={required || undefined}
                    value={number}
                    onChange={e => onNumber(e.target.value)}
                    className="cg-field"
                    style={{
                        flex: 1, minWidth: 0, height: '100%', background: 'none', border: 'none',
                        outline: 'none', color: palette.text, fontSize: 'var(--cg-field-fs)', padding: '0 14px', fontFamily: 'inherit',
                    }}
                />
            </div>

            {/* The checkout's one picker panel, as the date picker and the dropdowns use. */}
            {open && (
                <OptionList
                    labelledBy={codeId}
                    options={DIAL_CODES.map(d => ({
                        value: d.code,
                        label: `${d.name} ${d.dial}`,
                        content: <>
                            <span style={{ fontSize: 15 }}>{d.flag}</span>
                            <span style={{ flex: 1 }}>{d.name}</span>
                            <span style={{ opacity: 0.6 }}>{d.dial}</span>
                        </>,
                    }))}
                    value={current.code}
                    onPick={(c) => { onCode(DIAL_CODES.find(d => d.code === c)?.dial ?? code); close(); }}
                    onClose={close}
                    palette={palette}
                    width={280}
                />
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

const STEP_ORDER: Record<Step, number> = { form: 0, payment: 1, confirmed: 2 };

/**
 * Which way the traveller just moved, for the content to slide in from: `forward` to a later
 * step, `back` to an earlier one, nothing before the first move so the page does not animate on
 * arrival. Held as state derived from the step rather than in a ref, so it is right on the very
 * render the new step first draws.
 */
function useStepSlide(step: Step): 'forward' | 'back' | undefined {
    const [seen, setSeen] = useState<{ step: Step; dir?: 'forward' | 'back' }>({ step });
    if (seen.step !== step) setSeen({ step, dir: STEP_ORDER[step] > STEP_ORDER[seen.step] ? 'forward' : 'back' });
    return seen.dir;
}

/**
 * Three numbered discs joined by hairlines. As drawn, only the step in hand is
 * marked — the brand gradient, white numeral. Steps already done look exactly like
 * steps still to come: the bar says where you are, not what you have finished.
 *
 * The marked disc is one thumb that slides to the next step rather than a fill that swaps
 * between discs; the numerals sit above it and turn white as it reaches them. The discs are a
 * fixed width and the connectors a shared `--step-gap`, so the thumb's travel is a sum, not a
 * measurement.
 */
function ProgressBar({ step, palette }: { step: Step; palette: Palette }) {
    const t = useTranslations('checkout');
    const idx = STEP_ORDER[step];
    return (
        <ol
            style={{
                '--step-gap': 'clamp(40px,6vw,90px)', '--step-idx': idx,
                position: 'relative', display: 'flex', alignItems: 'flex-start', listStyle: 'none', margin: 0, padding: 0,
            } as React.CSSProperties}
        >
            <span aria-hidden className="cg-steps-thumb" style={{ background: ACCENT_FILL }} />
            {STEPS.map((s, i) => {
                const active = i === idx;
                return (
                    <li key={s.key} aria-current={active ? 'step' : undefined} style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 32, flexShrink: 0 }}>
                            <div style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: palette.stepIdle }}>
                                <span className="cg-steps-num" style={{ color: active ? '#fff' : palette.title }}>{s.num}</span>
                            </div>
                            <div style={{ fontSize: 12, color: palette.text, whiteSpace: 'nowrap' }}>{t(s.labelKey)}</div>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div aria-hidden style={{ width: 'var(--step-gap)', height: 1, marginTop: 16, background: palette.stepLine }} />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

// ─── Stripe payment form ──────────────────────────────────────────────────────

function StripePaymentForm({
    onSuccess, onError, total, currency, amountLabel, country, submitting, palette,
}: {
    onSuccess: (paymentIntentId: string) => void;
    onError:   (msg: string) => void;
    total:     number;
    currency:  string;
    /** The amount as the button should say it, when the caller has one to the cent. */
    amountLabel?: string;
    country?:  string;
    submitting: boolean;
    palette:   Palette;
}) {
    const t = useTranslations('checkout');
    const stripe = useStripe();
    const elements = useElements();
    // Local to this click, not the page's `submitting`: that flag is only ever reset by the
    // flight path's own confirm handler (`handleFlightPaid`'s `finally`). Sharing it left the
    // hotel path's Pay button permanently disabled after any booking failure that brought the
    // traveller back to the form, because nothing in the hotel path ever flipped it back off.
    const [clicking, setClicking] = useState(false);

    const handlePay = useCallback(async () => {
        if (!stripe || !elements) return;
        setClicking(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: `${window.location.origin}/trips?payment=success` },
            redirect: 'if_required',
        });

        if (error) {
            onError(error.message || 'Payment failed. Please try again.');
            setClicking(false);
        } else if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture')) {
            onSuccess(paymentIntent.id);
            setClicking(false);
        } else {
            onError('Payment is processing. Check your trips shortly.');
            setClicking(false);
        }
    }, [stripe, elements, onSuccess, onError]);

    return (
        <>
            <div style={{ background: palette.surface, borderRadius: 12, padding: 'clamp(20px,3vw,36px)', paddingBottom: 'clamp(18px,2.4vw,28px)', marginBottom: 25 }}>
                <PaymentElement options={{
                    layout: 'accordion',
                    ...(country ? { defaultValues: { billingDetails: { address: { country } } } } : {}),
                }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 'clamp(20px,3vw,32px)', fontSize: 12, color: palette.muted }}>
                    <span>{t.rich('securedPoweredBy', { brand: 'Stripe', b: (chunks) => <b style={{ color: palette.soft, fontWeight: 700 }}>{chunks}</b> })}</span>
                </div>
            </div>
            {/* As the details step's button: below the two-column layout the card form is long, so
                the button rides at the bottom of the screen rather than at the foot of the scroll. */}
            <div className="cg-cta">
                <PrimaryBtn onClick={handlePay} loading={submitting || clicking} disabled={!stripe || !elements}>
                    {t('payNow', { amount: amountLabel ?? `${currency} ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` })}
                </PrimaryBtn>
            </div>
        </>
    );
}

// ─── Confirmation receipt screen (hotel) ───────────────────────────────────────
// The flight equivalent is `FlightConfirmedScreen`, a separate component: the two no longer
// share one layout — see its file for why.

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
                        <div style={{ fontWeight: 800, fontSize: 20, color: palette.title, marginBottom: 4 }}>
                            {hotelName}
                        </div>
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
    const locale       = useLocale();
    // The footer's namespace, for the two link labels in the consent line below.
    const tRoot        = useTranslations();
    const searchParams = useSearchParams();
    const router       = useRouter();
    const { user }     = useAuthStore();
    const { theme }    = useTheme();
    const palette      = checkoutPalette(theme);
    // The card form's sizes follow the details step's: touch sizes on a phone or a touch screen.
    const touchSizing  = useMediaQuery(TOUCH_SIZING_QUERY);
    const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);

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
    /**
     * What `totalAmount` is written in: the airline's currency. A link from the results page names
     * it (`fareCurrency`) because it opens in the traveller's own; an older link has only
     * `currency`, which was the airline's. The selector later rewrites `?currency=` alone, so
     * `flightCurrency` can move on from the figure beside it — this is what that figure is in.
     */
    const [linkCurrency] = useState(searchParams.get('fareCurrency') ?? flightCurrency);
    const origin         = searchParams.get('origin')         ?? '';
    const destination    = searchParams.get('destination')    ?? '';
    const departureDate  = searchParams.get('departureDate')  ?? checkIn;
    /** Local `YYYY-MM-DD`: the date fields' limits are counted from it. */
    const todayIso = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, []);
    const cabin          = searchParams.get('cabin')          ?? undefined;

    // The offer, read once and quoted in the currency on show — again when the selector changes
    // it. Its quote is what the traveller is shown before committing to anything, and the receipt
    // draws its itinerary from it afterwards.
    const { offer: flightOffer, loading: flightOfferLoading, gone: flightOfferGone } = useFlightOffer(mode === 'flight' ? offerId : null, flightCurrency);
    const quote = flightOffer?.quote ?? null;
    /** The search this flight was picked from, run again: where a fare that has gone sends the
     *  traveller — wherever the browser happened to be before (a sign-in, another tab) aside. */
    const fareGoneHref = fareGoneSearchHref(searchParams);

    // ── Date helpers ──
    const nights = nightsBetween(checkIn, checkOut);
    const fmtDate = (d: string) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

    // ── State ──
    // The flight checkout's step. The hotel's comes from its state machine (`step` below).
    const [flightStep, setStep]     = useState<Step>('form');
    const [submitting, setSubmitting] = useState(false);
    /** A warning that stops the flight checkout — shown as a dialog, gone once closed. */
    const [flightAlert, setFlightAlert] = useState<CheckoutAlert | null>(null);
    /** On a phone the trip summary is folded into a bar above the form; this is whether it is open. */
    const [tripOpen, setTripOpen] = useState(false);
    const summaryId = useId();
    const closeFlightAlert = useCallback(() => setFlightAlert(null), []);
    /** A flight from the same airport on the same day is already booked: shown as a dialog the
     *  traveller closes, not in the error box. */
    const [duplicateFlight, setDuplicateFlight] = useState<DuplicateFlight | null>(null);
    /** Where focus goes when that dialog closes. The button disables itself while the request
     *  runs, so it has already lost focus by the time the dialog opens and could notice it. */
    const flightSubmitRef = useRef<HTMLButtonElement>(null);

    // Flight booking state. The hotel's lives in `useHotelCheckout`.
    const [clientSecret, setClientSecret]   = useState<string | null>(null);
    /** The booking session `/flights/book` opened, which `/flights/confirm` settles. */
    const [flightSessionId, setFlightSessionId] = useState<string>('');
    const [bookingId, setBookingId]         = useState<string | null>(null);
    /** The airline's record locator, for the receipt. */
    const [pnr, setPnr]                     = useState<string | null>(null);
    /** Paid for, but the airline has not settled it yet: the API answered BOOKING_PROCESSING. */
    const [flightSettling, setFlightSettling] = useState<'pending' | 'needs_review' | null>(null);
    /** What `/flights/book` says the card is held for: the figure the Pay button and the receipt
     *  show, in place of the fare the link carried. */
    const [held, setHeld] = useState<{ amount: number; currency: string; fare: number; serviceFee: number } | null>(null);

    // Hotel guest form — passenger 1 is the booking holder
    const [guest, setGuest]             = useState<GuestInfo>({ firstName: '', lastName: '', email: '', phone: '', phoneCode: '+63' });

    // Hotel co-guests — passenger 2..N, name only
    const [coGuests, setCoGuests]           = useState<HotelGuestForm['coGuests']>(() =>
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
            gender: '', passportNumber: '', passportExpiry: '', country: '',
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

    const onCoGuest = useCallback((index: number, field: keyof HotelGuestForm['coGuests'][number], value: string) => {
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
    /** The class that slides the step in hand into view, from the side it was reached from. */
    const slide = useStepSlide(step);
    const slideClass = slide ? ` cg-slide-${slide}` : '';

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
        setSubmitting(true); setFlightAlert(null);
        const backToDetails = () => { setClientSecret(null); setFlightSessionId(''); setHeld(null); setStep('form'); };
        try {
            const flightRes = await http.post<{ bookingId: string; pnr?: string; status: string }>(
                '/flights/confirm',
                { paymentIntentId: stripePaymentIntentId, sessionId: flightSessionId },
            );
            setBookingId(flightRes.bookingId);
            setPnr(flightRes.pnr ?? null);
            setStep('confirmed');
        } catch (err) {
            const failure = readFlightConfirmError(err);
            switch (failure.kind) {
                case 'processing':
                    setFlightSettling(failure.needsReview ? 'needs_review' : 'pending');
                    break;
                case 'price_changed':
                    setFlightAlert({
                        title: t('alert.fareChangedTitle'),
                        message: t('flight.priceChanged', {
                            was: `${failure.currency} ${failure.was.toLocaleString()}`,
                            now: `${failure.currency} ${failure.now.toLocaleString()}`,
                        }),
                    });
                    backToDetails();
                    break;
                case 'offer_expired':
                    // Nothing on this page can book it now: the hold is released, and the way on
                    // is the traveller's search, run again for the fares there are now.
                    backToDetails();
                    router.replace(fareGoneHref);
                    break;
                case 'refused':
                    setFlightAlert({ title: t('failed.title'), message: failure.message || t('failed.released') });
                    backToDetails();
                    break;
                default:
                    setFlightAlert({
                        title: t('failed.title'),
                        message: failure.message || 'Booking confirmation failed. Contact support with your payment reference.',
                    });
            }
        } finally {
            setSubmitting(false);
        }
    }, [flightSessionId, t, router, fareGoneHref]);

    // Opened on a fare the airline no longer has: nothing here can book it. On the details step
    // only — the offer is read again whenever the currency changes, and once the flight is paid
    // for, an ordered offer is gone too: that is the receipt, or a confirm still on its way.
    useEffect(() => {
        if (flightOfferGone && flightStep === 'form') router.replace(fareGoneHref);
    }, [flightOfferGone, flightStep, fareGoneHref, router]);

    // The same Stripe form serves both; what happens after a card is authorised does not.
    const handleStripeSuccess = mode === 'flight' ? handleFlightPaid : hotel.onCardAuthorised;
    const handleStripeError = (msg: string) => (mode === 'flight'
        ? setFlightAlert({ title: t('alert.paymentTitle'), message: msg })
        : hotel.onCardError(msg));
    const hotelSubmitting = submitting || hotel.busy;

    // ── Flight submit ──
    const handleFlightSubmit = useCallback(async () => {
        const pErr = validatePassengers(passengers);
        if (Object.keys(pErr).length > 0) { setPassengerErrors(pErr); return; }

        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        setSubmitting(true); setFlightAlert(null);
        try {
            // `/flights/book` opens a PaymentIntent that holds the card; it orders nothing
            // and takes nothing. The airline is asked once the card is authorised, by
            // `/flights/confirm`. This used to jump straight to "confirmed" on its response,
            // so the step that pays never ran.
            // The fare the traveller was shown goes with the request: `book` refuses, before any
            // card is held, a fare that has risen since. Without it the web checkout compared
            // against nothing and a risen fare was only refused after the card.
            // In the airline's currency, which is what the server compares it with: the quote's own
            // fare is in whatever currency is on show, and 14,500 pesos against a 250-dollar fare
            // would be refused as a rise that never happened.
            const shownFare = flightOffer?.price?.total ?? totalAmount;
            const res = await http.post<{
                clientSecret: string; sessionId: string; paymentIntentId: string;
                amount?: number; currency?: string; fare?: number; serviceFee?: number;
            }>(
                '/flights/book',
                {
                    offerId, displayCurrency: flightCurrency,
                    ...(Number.isFinite(shownFare) && shownFare > 0 ? { confirmedPrice: shownFare } : {}),
                    contact: { email: passengers[0].email, phone: passengers[0].phone, countryCode: contactPhoneCode },
                    // Stable per attempt, so a retry after a dropped response cannot buy a
                    // second ticket.
                    // A different currency is a different hold; the same key would hand back the
                    // first one, in the first currency.
                    idempotencyKey: `flight-${offerId}-${passengers[0].email}-${flightCurrency}`,
                    passengers: passengers.map(p => ({
                        firstName: p.firstName, lastName: p.lastName,
                        // Duffel puts the booking's contact on every passenger.
                        email: passengers[0].email, phone: passengers[0].phone,
                        dateOfBirth: p.dateOfBirth, gender: p.gender,
                        passportNumber: p.passportNumber, passportExpiry: p.passportExpiry,
                        nationality: p.country.trim().toUpperCase(), type: p.type,
                    })),
                },
            );
            setFlightSessionId(res.sessionId);
            setClientSecret(res.clientSecret);
            setHeld(typeof res.amount === 'number' && res.currency
                ? { amount: res.amount, currency: res.currency, fare: res.fare ?? res.amount, serviceFee: res.serviceFee ?? 0 }
                : null);
            setStep('payment');
        } catch (err) {
            // The same-day warning (ADR-0011) gets a dialog rather than the error box: nothing
            // the traveller typed is wrong, and the box kept saying so until the next submit.
            const e = err as { code?: string; body?: Record<string, unknown> };
            if (e?.code === 'DUPLICATE_BOOKING') {
                const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
                setDuplicateFlight({
                    route:             text(e.body?.route) ?? origin,
                    departureDate:     text(e.body?.departureDate) ?? departureDate,
                    existingBookingId: text(e.body?.existingBookingId),
                });
                return;
            }
            // The airline no longer sells it. Nothing is held yet; the traveller's search, run
            // again, has the fares there are now.
            if (e?.code === 'OFFER_EXPIRED' || e?.code === 'FARE_UNAVAILABLE') {
                router.replace(fareGoneHref);
                return;
            }
            setFlightAlert({
                title: t('failed.title'),
                message: err instanceof Error && err.message ? err.message : 'Booking failed. Please try again.',
            });
        } finally {
            setSubmitting(false);
        }
    }, [passengers, contactPhoneCode, user, router, offerId, flightCurrency, flightOffer, totalAmount, origin, departureDate, t, fareGoneHref]);
    const closeDuplicateFlight = useCallback(() => setDuplicateFlight(null), []);

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
    /** What a flight costs, from the server: what the card is held for once it is, the quote
     *  until then. Null when neither is known, and the page falls back to the link's fare. */
    const flightPrice = held
        ? { currency: held.currency, fare: held.fare, serviceFee: held.serviceFee, total: held.amount }
        : quote;

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
        // The sliding step starts a little off to the side; clip, unlike hidden, leaves the
        // sticky summary alone.
        overflowX: 'clip',
    };

    const sectionLabelStyle: React.CSSProperties = {
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: palette.title,
        marginBottom: 16,
    };

    /** A group inside a section (a passenger's contact details, their passport): a hairline
     *  above and a heading in sentence case, a step below the section's spaced capitals. */
    const groupTitleStyle: React.CSSProperties = {
        marginTop: 28,
        paddingTop: 24,
        borderTop: `1px solid ${palette.hairline}`,
        fontSize: 15,
        fontWeight: 600,
        color: palette.title,
        marginBottom: 16,
    };

    const fieldCss = (
        <style>{`
            @keyframes spin{to{transform:rotate(360deg)}}
            .cg-field::placeholder{color:${palette.muted};opacity:1}
            .cg-field,.cg-phone{transition:border-color .15s ease,box-shadow .15s ease}
            /* A field's resting hairline (see fieldEdge) darkens under the pointer. A wrong field
               sets its own red edge, which this does not reach. */
            .cg-field:hover,.cg-phone:hover{--cg-edge:${palette.fieldLineHover}}
            /* The field being typed in, and only that one, is ringed in the brand gradient: the
               fill painted to the padding box over the gradient to the border box, showing through
               the border made transparent. '!important' to outrank the field's inline edge. */
            .cg-field:focus,.cg-phone:focus-within{
                border-color:transparent !important;
                background:linear-gradient(${palette.fieldBg},${palette.fieldBg}) padding-box,var(--cg-focus,${ACCENT_FILL}) border-box !important;
                box-shadow:0 0 0 4px ${BRAND.primaryWash};
            }
            /* The phone number sits inside the ring already drawn around both halves. */
            .cg-phone .cg-field:focus{background:none !important;box-shadow:none}
            /* Chrome's autofill style sets 'background-image: none !important', which nothing here
               can outrank, so an autofilled field loses the gradient and its fill. A border colour
               and an inset shadow it leaves alone, so those put the fill back and, while it is
               typed in, the ring — a solid colour, the gradient being the thing stripped. At rest
               its hairline is a plain border colour already. */
            .cg-field:-webkit-autofill,
            .cg-field:-webkit-autofill:hover,
            .cg-field:-webkit-autofill:focus,
            .cg-field:-webkit-autofill:active{
                -webkit-text-fill-color:${palette.text};
                caret-color:${palette.text};
                transition:background-color 600000s 0s, color 600000s 0s;
                -webkit-box-shadow:0 0 0 1000px ${palette.fieldBg} inset;
                box-shadow:0 0 0 1000px ${palette.fieldBg} inset;
            }
            .cg-field:-webkit-autofill:focus{
                border-color:var(--cg-ring,${BRAND.primary}) !important;
                -webkit-box-shadow:0 0 0 1000px ${palette.fieldBg} inset, 0 0 0 4px ${BRAND.primaryWash};
                box-shadow:0 0 0 1000px ${palette.fieldBg} inset, 0 0 0 4px ${BRAND.primaryWash};
            }
            .cg-field:autofill{
                -webkit-text-fill-color:${palette.text};
                box-shadow:0 0 0 1000px ${palette.fieldBg} inset;
            }
            .cg-field:autofill:focus{border-color:var(--cg-ring,${BRAND.primary}) !important}
            /* Below the two-column layout the summary sits under the form, and the button that moves
               on sat at the foot of a long scroll. There it rides at the bottom of the screen while
               the form scrolls under it, over a fade into the page's ground. */
            @media (max-width:1023px){
                .cg-cta{
                    position:sticky;bottom:0;z-index:5;
                    margin-left:calc(-1 * clamp(16px,4vw,44px));margin-right:calc(-1 * clamp(16px,4vw,44px));
                    padding:20px clamp(16px,4vw,44px) calc(12px + env(safe-area-inset-bottom,0px));
                    background:linear-gradient(to top,${palette.bg} 72%,transparent);
                }
            }
            /* On a phone the trip summary sits above the form, folded into the bar that names the
               trip and its total; it opens under the bar. A wide screen keeps it open beside the form. */
            @media (max-width:1023px){
                .cg-trip{margin-top:8px}
                .cg-trip[data-open="false"]{display:none}
            }
            /* The phone number sits inside the field already drawn around it; a fill of its own
               would square off that field's rounded corners. */
            .cg-phone .cg-field:-webkit-autofill,
            .cg-phone .cg-field:-webkit-autofill:focus,
            .cg-phone .cg-field:autofill{
                -webkit-box-shadow:none;
                box-shadow:none;
            }
        `}</style>
    );

    // ── Confirmed ─────────────────────────────────────────────────────────────
    if (step === 'confirmed') {
        if (mode === 'flight') {
            return (
                <div className={slideClass.trim() || undefined} style={{ overflowX: 'clip' }}>
                <FlightConfirmedScreen
                    palette={palette}
                    offer={flightOffer}
                    loadingOffer={flightOfferLoading}
                    bookingId={bookingId}
                    pnr={pnr}
                    origin={origin}
                    destination={destination}
                    departureDate={departureDate}
                    cabin={cabin}
                    currency={held?.currency ?? flightCurrency}
                    total={held?.amount ?? totalAmount}
                    adults={adults}
                    childPassengers={children}
                    infants={infants}
                    passengers={passengers}
                    // The lead passenger's contact address, which need not be the signed-in
                    // account's — the e-ticket goes where they said to send it.
                    contactEmail={passengers[0].email}
                    backLabel={tAll('property.v2.goBack')}
                    onBack={() => router.back()}
                    onHome={() => router.push('/')}
                    onTrips={() => router.push('/trips')}
                />
                </div>
            );
        }
        return (
            <div className={slideClass.trim() || undefined} style={{ overflowX: 'clip' }}>
            <ConfirmedScreen
                palette={palette}
                bookingId={hotelState.reference ?? null}
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
            </div>
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
    // A quiet plate in the summary card's tones, with the sign-in as a secondary button beside the
    // words (under them on a phone): an accent-tinted box between the heading and the first field
    // read as a warning, and pulled the eye off the form.
    function AuthBanner() {
        if (user) return null;
        return (
            <div style={{
                marginBottom: 32, padding: '14px 16px', borderRadius: 16,
                border: `1px solid ${palette.summaryBorder}`, background: palette.summaryBg,
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: palette.title }}>{tAll('checkout.signInToComplete')}</div>
                    {/* The first thing a phone gives up: the screen is for the form. */}
                    <div className="max-sm:hidden" style={{ fontSize: 13, lineHeight: 1.45, color: palette.muted, marginTop: 2 }}>{tAll('checkout.signInBannerDesc')}</div>
                </div>
                <button
                    onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                    style={{
                        minHeight: 44, padding: '0 18px', borderRadius: 999, border: `1px solid ${palette.fieldLine}`,
                        background: 'transparent', color: palette.title, fontWeight: 600, fontSize: 14,
                        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    }}
                >
                    {tAll('checkout.signInArrow')}
                </button>
            </div>
        );
    }

    // ── Trip bar (a phone's summary, folded) ──────────────────────────────────
    // The trip, who is flying and what it comes to, above the form where a phone used to show them
    // only after every field. The total is the summary's own: the card's hold, else the quote, else
    // the link's fare — and skeleton while a quote in the currency on show is still coming.
    function TripBar() {
        const quoting = flightOfferLoading && !held && (!flightPrice || flightPrice.currency !== flightCurrency);
        const total = flightPrice ? formatMoney(flightPrice.total, flightPrice.currency) : `${linkCurrency} ${totalAmount.toLocaleString()}`;
        const details = [departureDate ? fmtDate(departureDate) : '', tAll('checkout.flight.receipt.passengersCount', { count: passengers.length })]
            .filter(Boolean).join(' · ');
        return (
            <button
                type="button"
                // `flex` as a class, not an inline display: an inline one would outrank `lg:hidden`,
                // and a wide screen, which shows the summary itself, would show the bar as well.
                className="flex lg:hidden"
                aria-expanded={tripOpen}
                aria-controls={summaryId}
                onClick={() => setTripOpen(o => !o)}
                style={{
                    width: '100%', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12,
                    border: 'none', background: palette.surface, color: palette.title, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                }}
            >
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{origin} → {destination}</span>
                    <span style={{ display: 'block', fontSize: 13, color: palette.muted, marginTop: 2 }}>{details}</span>
                </span>
                {quoting
                    ? <SkeletonBar palette={palette} width={84} height={16} />
                    : <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{total}</span>}
                <ChevronDown size={18} aria-hidden style={{ flexShrink: 0, color: palette.muted, transform: tripOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
        );
    }

    // ── Summary card (right column) ───────────────────────────────────────────
    function SummaryCard() {
        const slices = flightOffer ? groupSegmentsIntoSlices(flightOffer.segments) : [];
        // Still being read: the itinerary until the offer arrives, and the amounts until a quote
        // in the currency on show does. A quote in another currency is not shown meanwhile — after
        // the selector changes, it would read as the new currency not having taken.
        const loadingItinerary = flightOfferLoading && slices.length === 0;
        const quoting = flightOfferLoading && !held && (!flightPrice || flightPrice.currency !== flightCurrency);
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
                                {/* The offer's own itinerary once it is read: each end by the airport's full
                                    name and code, with the day and the clock it leaves or lands. Until then
                                    (or when it could not be read) the date the link carried. */}
                                {slices.length === 0 && departureDate && <div style={{ fontSize: 13, color: palette.text, marginTop: 4 }}>{fmtDate(departureDate)}</div>}
                                {cabin && <div style={{ fontSize: 13, color: palette.soft, marginTop: slices.length === 0 ? 0 : 4 }}>{cabin}</div>}
                                {slices.map((segs, idx) => {
                                    const first = segs[0];
                                    const last  = segs[segs.length - 1];
                                    const end = (caption: string, e: typeof first.departure, code: string) => (
                                        <div>
                                            <div style={{ fontSize: 12, color: palette.muted }}>{caption}</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: palette.title, marginTop: 2 }}>{airportLabel(e, code)}</div>
                                            <div style={{ fontSize: 13, color: palette.text, marginTop: 1 }}>{formatDateTime(e.time, locale)}</div>
                                        </div>
                                    );
                                    return (
                                        <div key={idx} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
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
                                    <div aria-busy="true" style={{ display: 'grid', gap: 10, marginTop: 14 }}>
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
                                {rule}
                                {quoting ? (
                                    <div aria-busy="true">
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            <div style={row}>
                                                <span>{tAll('checkout.flight.receipt.fareLine', { count: passengers.length })}</span>
                                                <SkeletonBar palette={palette} width={84} height={14} />
                                            </div>
                                        </div>
                                        {rule}
                                        <div style={{ ...row, fontWeight: 700, color: palette.title }}>
                                            <span>{tAll('checkout.success.total')}</span>
                                            <SkeletonBar palette={palette} width={96} height={16} />
                                        </div>
                                        <span className="sr-only">{t('confirmingFinalPrice')}</span>
                                    </div>
                                ) : flightPrice ? (
                                    <>
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {/* One fare line: our fee is part of what the ticket costs here, not an
                                                extra the traveller is shown being added. */}
                                            <div style={row}>
                                                <span>{tAll('checkout.flight.receipt.fareLine', { count: passengers.length })}</span>
                                                <span>{formatMoney(Math.round((flightPrice.fare + flightPrice.serviceFee) * 100) / 100, flightPrice.currency)}</span>
                                            </div>
                                        </div>
                                        {rule}
                                        <div style={{ ...row, fontWeight: 700, color: palette.title }}>
                                            <span>{tAll('checkout.success.total')}</span>
                                            <span>{formatMoney(flightPrice.total, flightPrice.currency)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ ...row, fontWeight: 700, color: palette.title }}>
                                        <span>{tAll('checkout.success.total')}</span>
                                        <span>{linkCurrency} {totalAmount.toLocaleString()}</span>
                                    </div>
                                )}
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
        const fieldGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 16 };
        // A contact detail or a single answer takes the left column, as on the hotel form;
        // on a phone the half is too narrow, so it takes the row.
        const half = 'col-span-2 sm:col-span-1';
        // Two short answers that belong together — a birthday and a gender, a passport's number and
        // its expiry — share a row on a phone too, from 360px, where each still has room for a
        // date. Below that each takes its own.
        const pair = 'col-span-2 min-[360px]:col-span-1';

        return (
            <div style={rootStyle}>
                {fieldCss}
                <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,44px) 72px' }}>
                    <CheckoutToolbar palette={palette} backLabel={flightBackLabel} onBack={handleBack} />

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,645px)_minmax(300px,370px)] lg:justify-between gap-x-[clamp(40px,8vw,130px)]">
                        <div className="lg:col-start-2 lg:row-start-1 flex lg:justify-center mb-8 lg:mb-0 lg:pt-1.5">
                            <ProgressBar step={step} palette={palette} />
                        </div>

                        <div key={`heading-${step}`} className={`lg:col-start-1 lg:row-start-1${slideClass}`}>
                            <h1 className="font-bold tracking-[-0.01em] lg:whitespace-nowrap" style={{ fontSize: 'clamp(28px,4.4vw,60px)', lineHeight: 1.05, color: palette.title, margin: 0 }}>
                                {step === 'payment' ? t('paymentDetailsTitle') : t('completeYourBooking')}
                            </h1>
                            {step === 'form' && (
                                <p style={{ fontSize: 'clamp(19px,2.2vw,32px)', fontWeight: 400, lineHeight: 1.25, color: palette.text, margin: '10px 0 0' }}>
                                    {t('flight.whosFlying')}
                                </p>
                            )}
                        </div>

                        <div key={`body-${step}`} className={`lg:col-start-1 lg:row-start-2 max-lg:order-2 min-w-0${slideClass}`} style={{ marginTop: step === 'form' ? 30 : 26 }}>
                            {flightAlert && (
                                <CheckoutAlertDialog
                                    alert={flightAlert}
                                    palette={palette}
                                    onClose={closeFlightAlert}
                                    // Back on the details, focus goes to the button that submits them.
                                    returnFocusRef={step === 'form' ? flightSubmitRef : undefined}
                                />
                            )}

                            {duplicateFlight && (
                                <DuplicateFlightModal duplicate={duplicateFlight} palette={palette} onClose={closeDuplicateFlight} returnFocusRef={flightSubmitRef} />
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
                                    const example = (value: string) => t('example', { value });
                                    // Three short groups rather than one column of nine fields: who the
                                    // traveller is, how to reach them (the lead traveller only), and their
                                    // passport — with more room between the groups than within them.
                                    return (
                                        <section key={i} style={{ marginBottom: 40 }}>
                                            <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>{heading}</div>
                                            <p style={{ fontSize: 'var(--cg-note-fs)', color: palette.muted, margin: '0 0 18px' }}>{t('flight.nameHint')}</p>
                                            <div style={fieldGrid}>
                                                <div>
                                                    <Label palette={palette} htmlFor={id('firstName')} required>{tAll('checkout.userDetails.firstName')}</Label>
                                                    <input id={id('firstName')} type="text" aria-required="true" autoComplete={i === 0 ? 'given-name' : 'off'} value={p.firstName} onChange={e => onPassenger(i, 'firstName', e.target.value)} placeholder={example(EXAMPLE_FIRST_NAME)} className="cg-field" style={mkField(palette, !!err('firstName'))} />
                                                    <ErrText msg={err('firstName')} />
                                                </div>
                                                <div>
                                                    <Label palette={palette} htmlFor={id('lastName')} required>{tAll('checkout.userDetails.lastName')}</Label>
                                                    <input id={id('lastName')} type="text" aria-required="true" autoComplete={i === 0 ? 'family-name' : 'off'} value={p.lastName} onChange={e => onPassenger(i, 'lastName', e.target.value)} placeholder={example(EXAMPLE_LAST_NAME)} className="cg-field" style={mkField(palette, !!err('lastName'))} />
                                                    <ErrText msg={err('lastName')} />
                                                </div>
                                                <div className={pair}>
                                                    <Label palette={palette} htmlFor={id('dateOfBirth')} required>{tAll('checkout.userDetails.dateOfBirth')}</Label>
                                                    {/* Only the birthdays the airline accepts for this passenger's type, on the day they fly. */}
                                                    <DateField id={id('dateOfBirth')} value={p.dateOfBirth} onChange={v => onPassenger(i, 'dateOfBirth', v)}
                                                        {...birthDateBounds(p.type, departureDate, todayIso)} openTo="year"
                                                        palette={palette} className="cg-field" style={mkField(palette, !!err('dateOfBirth'))} />
                                                    <ErrText msg={err('dateOfBirth')} />
                                                </div>
                                                <div className={pair}>
                                                    <Label palette={palette} htmlFor={id('gender')} required>{tAll('checkout.userDetails.gender')}</Label>
                                                    {/* Required by the check above and sent with the booking, but the
                                                        control was missing, so the form could never be submitted. */}
                                                    <SelectField id={id('gender')} value={p.gender} onChange={v => onPassenger(i, 'gender', v)}
                                                        placeholder={t('flight.genderPlaceholder')}
                                                        options={[
                                                            { value: 'M', label: tAll('checkout.userDetails.genderMale') },
                                                            { value: 'F', label: tAll('checkout.userDetails.genderFemale') },
                                                        ]}
                                                        palette={palette} className="cg-field" style={mkField(palette, !!err('gender'))} />
                                                    <ErrText msg={err('gender')} />
                                                </div>
                                            </div>

                                            {/* Contact details once, on the lead traveller: they are the booking's
                                                contact, where the e-ticket goes and what the airline calls. */}
                                            {i === 0 && <>
                                                <div style={groupTitleStyle}>{t('flight.contactTitle')}</div>
                                                <div style={fieldGrid}>
                                                    <div className={`${half} sm:col-start-1`}>
                                                        <Label palette={palette} htmlFor={id('email')} required>{tAll('checkout.userDetails.email')}</Label>
                                                        <input id={id('email')} type="email" aria-required="true" autoComplete="email" value={p.email} onChange={e => onPassenger(i, 'email', e.target.value)} placeholder={example(EXAMPLE_EMAIL)} className="cg-field" style={mkField(palette, !!err('email'))} />
                                                        <ErrText msg={err('email')} />
                                                    </div>
                                                    <div className={`${half} sm:col-start-1`}>
                                                        <Label palette={palette} htmlFor={id('phone')} required>{tAll('checkout.userDetails.phoneNumber')}</Label>
                                                        <PhoneField
                                                            palette={palette}
                                                            inputId={id('phone')}
                                                            required
                                                            placeholder={example(EXAMPLE_PHONE)}
                                                            code={contactPhoneCode}
                                                            number={p.phone}
                                                            onCode={setContactPhoneCode}
                                                            onNumber={v => onPassenger(i, 'phone', v)}
                                                            error={err('phone')}
                                                        />
                                                        <ErrText msg={err('phone')} />
                                                    </div>
                                                    <p className="col-span-2" style={{ fontSize: 'var(--cg-note-fs)', lineHeight: 1.45, color: palette.muted, margin: '-6px 2px 0' }}>{t('flight.contactHint')}</p>
                                                </div>
                                            </>}

                                            <div style={groupTitleStyle}>{t('flight.passportTitle')}</div>
                                            <div style={fieldGrid}>
                                                <div className={pair}>
                                                    <Label palette={palette} htmlFor={id('passportNumber')} required>{tAll('checkout.userDetails.passportNumber')}</Label>
                                                    <input id={id('passportNumber')} type="text" aria-required="true" autoComplete="off" value={p.passportNumber} onChange={e => onPassenger(i, 'passportNumber', e.target.value)} placeholder={t('flight.passportPlaceholder')} className="cg-field" style={mkField(palette, !!err('passportNumber'))} />
                                                    <ErrText msg={err('passportNumber')} />
                                                </div>
                                                <div className={pair}>
                                                    <Label palette={palette} htmlFor={id('passportExpiry')} required>{tAll('checkout.userDetails.passportExpiry')}</Label>
                                                    <DateField id={id('passportExpiry')} value={p.passportExpiry} onChange={v => onPassenger(i, 'passportExpiry', v)}
                                                        {...passportExpiryBounds(departureDate, todayIso)} openTo="day"
                                                        palette={palette} className="cg-field" style={mkField(palette, !!err('passportExpiry'))} />
                                                    <ErrText msg={err('passportExpiry')} />
                                                </div>
                                                <div className={half}>
                                                    <Label palette={palette} htmlFor={id('country')} required>{tAll('checkout.userDetails.country')}</Label>
                                                    <AutocompleteSelectField id={id('country')} value={p.country} onChange={v => onPassenger(i, 'country', v)}
                                                        placeholder={t('flight.countryPlaceholder')} noResults={t('flight.countryNoResults')} options={countryOptions}
                                                        palette={palette} className="cg-field" style={mkField(palette, !!err('country'))} />
                                                    <ErrText msg={err('country')} />
                                                </div>
                                            </div>
                                        </section>
                                    );
                                })}

                                <div className="cg-cta" style={{ marginTop: 16 }}>
                                    <PrimaryBtn onClick={handleFlightSubmit} loading={submitting} buttonRef={flightSubmitRef}>
                                        {t('continueToPayment')}
                                    </PrimaryBtn>
                                </div>
                            </>}

                            {step === 'payment' && clientSecret && (
                                <>
                                    <p style={{ fontSize: 13, lineHeight: 1.5, color: palette.soft, margin: '0 0 18px' }}>{t('flight.cardHeld')}</p>
                                    {/* Keyed on the secret: Stripe cannot change an Elements
                                        instance's intent once it is mounted, so a second checkout
                                        in the same session handed a new secret to an instance
                                        still bound to the old one. Stripe answered 400 on every
                                        payment_intent fetch and the card form never appeared.
                                        Remounting on a new secret is the documented way, and the
                                        golf flow has done it since it shipped. */}
                                    <Elements key={clientSecret} stripe={getStripe()} options={{ clientSecret, appearance: stripeAppearance(palette, theme) }}>
                                        <StripePaymentForm
                                            onSuccess={handleStripeSuccess}
                                            onError={handleStripeError}
                                            total={held?.amount ?? totalAmount}
                                            currency={held?.currency ?? flightCurrency}
                                            amountLabel={held ? formatMoney(held.amount, held.currency) : undefined}
                                            country={passengers[0].country}
                                            submitting={submitting}
                                            palette={palette}
                                        />
                                    </Elements>
                                </>
                            )}

                            <p style={{ fontSize: 'var(--cg-small-fs)', color: palette.faint, textAlign: 'center', marginTop: 14 }}>
                                {t('agreePrefix')} <Link href="/terms" style={{ color: palette.soft, textDecoration: 'underline' }}>{tRoot('footer.terms')}</Link> {tRoot('legal.termsGate.checkboxConnector')} <Link href="/privacy" style={{ color: palette.soft, textDecoration: 'underline' }}>{tRoot('footer.privacyMinimal')}</Link>.
                            </p>
                        </div>

                        {/* The trip summary. On a wide screen, the column beside the form under the steps;
                            on a phone, above the form — it came after every field — folded into a bar that
                            names the trip and its total, and opens to the itinerary. */}
                        <aside className={`lg:col-start-2 lg:row-start-2 max-lg:order-1 mt-6 lg:mt-0 ${step === 'form' ? 'lg:pt-[50px]' : 'lg:pt-[80px]'}`}>
                            <TripBar />
                            <div id={summaryId} role="region" aria-label={t('summary.tripSummary')} data-open={tripOpen} className="cg-trip">
                                <SummaryCard />
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        );
    }

    // ── Hotel checkout ────────────────────────────────────────────────────────
    // The warnings the traveller answers by closing them — shown as a dialog, and gone with
    // `dismissNotice`, leaving the step they carry on from. The bigger turns (a price that
    // moved, a room that went, a booking that failed after payment) stay panels on the page.
    const hotelFailure = hotelState.failure;
    const hotelAlert: CheckoutAlert | null =
        hotelState.phase === 'failed' && hotelFailure?.kind === 'duplicate'
            ? {
                title: t('duplicateBookingTitle', { hotel: hotelName }),
                message: t('duplicateBookingDesc'),
                ...(hotelFailure.existingBookingId && {
                    action: { label: t('viewExistingBooking'), href: `/trips/${hotelFailure.existingBookingId}` },
                }),
            }
        : hotelState.phase === 'quoted' && hotelFailure
            ? { title: t('failed.title'), message: hotelFailure.message }
        : hotelState.phase === 'awaiting_payment' && hotelState.message
            ? { title: t('alert.paymentTitle'), message: hotelState.message }
        : null;

    const backLabel = step === 'payment' ? t('backToBookingDetails') : tAll('property.v2.goBack');
    const fieldGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 16 };

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

                    <div key={`heading-${step}`} className={`lg:col-start-1 lg:row-start-1${slideClass}`}>
                        {/* One line from `lg` up, as drawn — it may run past the form column into
                            the gutter, which the steps never reach. Sized so it always fits there. */}
                        <h1 className="font-bold tracking-[-0.01em] lg:whitespace-nowrap" style={{ fontSize: 'clamp(32px,4.4vw,60px)', lineHeight: 1.05, color: palette.title, margin: 0 }}>
                            {step === 'payment' ? t('paymentDetailsTitle') : t('completeYourBooking')}
                        </h1>
                        {step === 'form' && (
                            <p style={{ fontSize: 'clamp(19px,2.2vw,32px)', fontWeight: 400, lineHeight: 1.25, color: palette.text, margin: '10px 0 0' }}>
                                {t('whosCheckingInYou')}
                            </p>
                        )}
                    </div>

                    <div key={`body-${step}`} className={`lg:col-start-1 lg:row-start-2 min-w-0${slideClass}`} style={{ marginTop: step === 'form' ? 30 : 26 }}>
                        {hotelAlert && (
                            <CheckoutAlertDialog alert={hotelAlert} palette={palette} onClose={hotel.dismissNotice} />
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
                            <SupplierDownPanel
                                palette={palette}
                                busy={hotel.busy}
                                onRetry={() => void hotel.refreshQuote()}
                                onChooseAnother={() => router.back()}
                            />
                        )}
                        {hotelState.phase === 'failed' && hotelState.failure?.kind !== 'duplicate' && (
                            <BookingFailedPanel
                                released={hotelState.outcome?.kind === 'failed' ? hotelState.outcome.released : false}
                                message={hotelState.outcome?.kind === 'failed' ? hotelState.outcome.message : (hotelState.failure?.message ?? '')}
                                palette={palette}
                                onTryAgain={hotel.restart}
                            />
                        )}

                        <AuthBanner />

                        {/* Step 1: guest details */}
                        {step === 'form' && hotelState.phase !== 'unavailable' && hotelState.phase !== 'failed' && (
                            <>
                                {/* Guest 1 — the booking holder */}
                                <section style={{ marginBottom: 36 }}>
                                    <div style={sectionLabelStyle}>{t('userDetails.guest1')}</div>
                                    <div style={fieldGrid}>
                                        <div>
                                            <Label palette={palette} required>{t('userDetails.firstNamePlaceholder')}</Label>
                                            <input type="text" autoComplete="given-name" value={guest.firstName} onChange={e => onGuest('firstName', e.target.value)} placeholder={t('example', { value: EXAMPLE_FIRST_NAME })} className="cg-field" style={mkField(palette, !!fieldError('holder.firstName'))} />
                                            <ErrText msg={fieldError('holder.firstName')} />
                                        </div>
                                        <div>
                                            <Label palette={palette} required>{t('userDetails.lastNamePlaceholder')}</Label>
                                            <input type="text" autoComplete="family-name" value={guest.lastName} onChange={e => onGuest('lastName', e.target.value)} placeholder={t('example', { value: EXAMPLE_LAST_NAME })} className="cg-field" style={mkField(palette, !!fieldError('holder.lastName'))} />
                                            <ErrText msg={fieldError('holder.lastName')} />
                                        </div>
                                        {/* Email and phone keep to the left column, as drawn — a
                                            name splits in two, a contact detail does not. On a
                                            phone the half is too narrow for an address, so both
                                            take the full row. */}
                                        <div className="col-span-2 sm:col-span-1 sm:col-start-1">
                                            <Label palette={palette} required>{t('userDetails.emailPlaceholder')}</Label>
                                            <input type="email" autoComplete="email" value={guest.email} onChange={e => onGuest('email', e.target.value)} placeholder={t('example', { value: EXAMPLE_EMAIL })} className="cg-field" style={mkField(palette, !!fieldError('holder.email'))} />
                                            <ErrText msg={fieldError('holder.email')} />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 sm:col-start-1">
                                            <Label palette={palette}>{t('userDetails.phoneNumber')}</Label>
                                            <PhoneField
                                                palette={palette}
                                                placeholder={t('example', { value: EXAMPLE_PHONE })}
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
                                    <section key={i} style={{ marginBottom: 36 }}>
                                        <div style={sectionLabelStyle}>{t('userDetails.guestN', { n: i + 2 })}</div>
                                        <div style={fieldGrid}>
                                            <div>
                                                <Label palette={palette} required>{t('userDetails.firstNamePlaceholder')}</Label>
                                                <input type="text" value={g.firstName} onChange={e => onCoGuest(i, 'firstName', e.target.value)} placeholder={t('example', { value: EXAMPLE_FIRST_NAME })} className="cg-field" style={mkField(palette, !!fieldError(`coGuests.${i}.firstName`))} />
                                                <ErrText msg={fieldError(`coGuests.${i}.firstName`)} />
                                            </div>
                                            <div>
                                                <Label palette={palette} required>{t('userDetails.lastNamePlaceholder')}</Label>
                                                <input type="text" value={g.lastName} onChange={e => onCoGuest(i, 'lastName', e.target.value)} placeholder={t('example', { value: EXAMPLE_LAST_NAME })} className="cg-field" style={mkField(palette, !!fieldError(`coGuests.${i}.lastName`))} />
                                                <ErrText msg={fieldError(`coGuests.${i}.lastName`)} />
                                            </div>
                                        </div>
                                    </section>
                                ))}

                                {/* Children — an age is what a supplier admits and prices them by */}
                                {kids.map((k, i) => (
                                    <section key={`kid-${i}`} style={{ marginBottom: 36 }}>
                                        <div style={sectionLabelStyle}>{t('userDetails.childN', { n: i + 1 })}</div>
                                        <div style={fieldGrid}>
                                            <div>
                                                <Label palette={palette} required>{t('userDetails.age')}</Label>
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
                                <section style={{ marginBottom: 36 }}>
                                    <div style={sectionLabelStyle}>{t('specialRequests.title')}</div>
                                    <textarea
                                        value={specialRequests}
                                        onChange={e => { setSpecialRequests(e.target.value); clearError('specialRequests'); }}
                                        placeholder={t('specialRequests.placeholder')}
                                        rows={3}
                                        className="cg-field"
                                        style={{ ...mkField(palette, !!fieldError('specialRequests')), height: 'auto', padding: '12px 16px', borderRadius: FIELD_RADIUS, resize: 'vertical' }}
                                    />
                                    <ErrText msg={fieldError('specialRequests')} />
                                </section>

                                <div className="cg-cta" style={{ marginTop: 16 }}>
                                    <PrimaryBtn onClick={handleHotelSubmitForm} loading={hotelSubmitting} disabled={!hotel.canSubmit}>
                                        {t('continueToPayment')}
                                    </PrimaryBtn>
                                </div>
                            </>
                        )}

                        {/* Step 2: Stripe payment */}
                        {/* Keyed on the secret, for the same reason as the flight form above: an
                            Elements instance keeps the intent it mounted with. */}
                        {step === 'payment' && hotelState.clientSecret && (
                            <Elements key={hotelState.clientSecret} stripe={getStripe()} options={{ clientSecret: hotelState.clientSecret, appearance: stripeAppearance(palette, theme) }}>
                                <StripePaymentForm
                                    onSuccess={handleStripeSuccess}
                                    onError={handleStripeError}
                                    total={total}
                                    currency={shownCurrency}
                                    submitting={hotelSubmitting}
                                    palette={palette}
                                />
                            </Elements>
                        )}

                        <p style={{ fontSize: 'var(--cg-small-fs)', color: palette.faint, textAlign: 'center', marginTop: 14 }}>
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
        <Suspense fallback={<CheckoutSkeleton />}>
            <CheckoutContent />
        </Suspense>
    );
}

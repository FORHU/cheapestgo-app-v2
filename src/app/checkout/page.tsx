'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Header } from '@/shared/components/header';
import { Button } from '@/shared/components/ui/button';
import { http } from '@/shared/lib/http';
import { useAuthStore } from '@/shared/auth/store';
import { BookingSummary } from '@/features/checkout/components/booking-summary';
import {
    GuestForm,
    type GuestInfo,
    type PassengerInfo,
} from '@/features/checkout/components/guest-form';
import {
    PaymentSection,
    type CardInfo,
} from '@/features/checkout/components/payment-section';
import type { FlightOffer } from '@/shared/types';

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateGuest(guest: GuestInfo): Partial<Record<keyof GuestInfo, string>> {
    const errors: Partial<Record<keyof GuestInfo, string>> = {};
    if (!guest.firstName.trim()) errors.firstName = 'Required';
    if (!guest.lastName.trim()) errors.lastName = 'Required';
    if (!guest.email.trim()) errors.email = 'Required';
    else if (!validateEmail(guest.email)) errors.email = 'Invalid email';
    if (!guest.phone.trim()) errors.phone = 'Required';
    return errors;
}

function validatePassengers(passengers: PassengerInfo[]): Record<string, string> {
    const errors: Record<string, string> = {};
    passengers.forEach((p, i) => {
        if (!p.firstName.trim()) errors[`${i}.firstName`] = 'Required';
        if (!p.lastName.trim()) errors[`${i}.lastName`] = 'Required';
        if (!p.email.trim()) errors[`${i}.email`] = 'Required';
        else if (!validateEmail(p.email)) errors[`${i}.email`] = 'Invalid email';
        if (!p.phone.trim()) errors[`${i}.phone`] = 'Required';
        if (!p.dateOfBirth) errors[`${i}.dateOfBirth`] = 'Required';
        if (!p.passportNumber.trim()) errors[`${i}.passportNumber`] = 'Required';
    });
    return errors;
}

function validateCard(card: CardInfo): Partial<Record<keyof CardInfo, string>> {
    const errors: Partial<Record<keyof CardInfo, string>> = {};
    if (!card.nameOnCard.trim()) errors.nameOnCard = 'Required';
    const digits = card.cardNumber.replace(/\s/g, '');
    if (!digits) errors.cardNumber = 'Required';
    else if (digits.length < 13) errors.cardNumber = 'Invalid card number';
    if (!card.expiry.trim()) errors.expiry = 'Required';
    else if (!/^\d{2}\/\d{2}$/.test(card.expiry)) errors.expiry = 'Format: MM/YY';
    if (!card.cvv.trim()) errors.cvv = 'Required';
    else if (card.cvv.length < 3) errors.cvv = 'Too short';
    return errors;
}

// ─── Empty state factories ────────────────────────────────────────────────────

function emptyGuest(): GuestInfo {
    return { firstName: '', lastName: '', email: '', phone: '' };
}

function emptyPassenger(): PassengerInfo {
    return { firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', passportNumber: '' };
}

function emptyCard(): CardInfo {
    return { cardNumber: '', expiry: '', cvv: '', nameOnCard: '' };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuthStore();

    // ── Detect mode ──
    const offerId = searchParams.get('offerId');
    const hotelId = searchParams.get('hotelId');
    const mode: 'hotel' | 'flight' = offerId && !hotelId ? 'flight' : 'hotel';

    // ── Hotel params ──
    const checkIn = searchParams.get('checkIn') ?? '';
    const checkOut = searchParams.get('checkOut') ?? '';
    const adults = parseInt(searchParams.get('adults') ?? '1', 10);
    const totalPrice = parseFloat(searchParams.get('totalPrice') ?? '0');
    const currency = searchParams.get('currency') ?? 'USD';
    const roomId = searchParams.get('roomId') ?? '';
    const rateKey = searchParams.get('rateKey') ?? '';
    const roomName = searchParams.get('roomName') ?? undefined;
    const hotelName = searchParams.get('hotelName') ?? 'Hotel';

    // ── Flight params ──
    const totalAmount = parseFloat(searchParams.get('totalAmount') ?? '0');
    const flightCurrency = searchParams.get('currency') ?? 'USD';
    const origin = searchParams.get('origin') ?? '';
    const destination = searchParams.get('destination') ?? '';
    const departureDate = searchParams.get('departureDate') ?? checkIn;
    const cabin = searchParams.get('cabin') ?? undefined;

    // ── State ──
    const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Hotel state
    const [guest, setGuest] = useState<GuestInfo>(emptyGuest());
    const [guestErrors, setGuestErrors] = useState<Partial<Record<keyof GuestInfo, string>>>({});
    const [card, setCard] = useState<CardInfo>(emptyCard());
    const [cardErrors, setCardErrors] = useState<Partial<Record<keyof CardInfo, string>>>({});

    // Flight state
    const [passengers, setPassengers] = useState<PassengerInfo[]>(() =>
        Array.from({ length: Math.max(1, adults) }, emptyPassenger)
    );
    const [passengerErrors, setPassengerErrors] = useState<Record<string, string>>({});

    // Full flight offer from sessionStorage (written by search results page)
    const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
    const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

    // Pre-fill email from logged-in user
    useEffect(() => {
        if (user?.email) {
            setGuest((g) => ({ ...g, email: g.email || user.email }));
            if (user.firstName) setGuest((g) => ({ ...g, firstName: g.firstName || (user.firstName ?? '') }));
            if (user.lastName) setGuest((g) => ({ ...g, lastName: g.lastName || (user.lastName ?? '') }));
        }
    }, [user]);

    // Read selected flight from sessionStorage (written by search results page)
    useEffect(() => {
        if (mode !== 'flight') return;
        try {
            const raw = sessionStorage.getItem('selectedFlight');
            if (raw) {
                const offer = JSON.parse(raw) as FlightOffer;
                if (offer?.offerId && offer?.provider) {
                    setSelectedFlight(offer);
                }
            }
        } catch {
            // Corrupted data — ignore
        }
    }, [mode]);

    // ── Guest helpers ──
    const handleGuestChange = useCallback((field: keyof GuestInfo, value: string) => {
        setGuest((g) => ({ ...g, [field]: value }));
        setGuestErrors((e) => { const n = { ...e }; delete n[field]; return n; });
    }, []);

    const handleCardChange = useCallback((field: keyof CardInfo, value: string) => {
        setCard((c) => ({ ...c, [field]: value }));
        setCardErrors((e) => { const n = { ...e }; delete n[field]; return n; });
    }, []);

    const handlePassengerChange = useCallback((index: number, field: keyof PassengerInfo, value: string) => {
        setPassengers((ps) => ps.map((p, i) => i === index ? { ...p, [field]: value } : p));
        setPassengerErrors((e) => { const n = { ...e }; delete n[`${index}.${field}`]; return n; });
    }, []);

    // ── Submit: hotel — create payment intent ──
    const handleHotelSubmitForm = useCallback(async () => {
        const gErr = validateGuest(guest);
        if (Object.keys(gErr).length > 0) {
            setGuestErrors(gErr);
            return;
        }

        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            const res = await http.post<{ clientSecret: string }>('/api/hotels/create-payment', {
                hotelId,
                roomId,
                rateKey,
                checkIn,
                checkOut,
                adults,
                currency,
                amount: totalPrice,
                guestFirstName: guest.firstName,
                guestLastName: guest.lastName,
                guestEmail: guest.email,
                guestPhone: guest.phone,
            });
            if (!res.clientSecret) throw new Error('No client secret returned');
            // With a real Stripe integration we'd use the clientSecret here.
            // For now advance to payment step where the card form is shown.
            setStep('payment');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to set up payment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [guest, user, router, hotelId, roomId, rateKey, checkIn, checkOut, adults, currency, totalPrice]);

    // ── Submit: hotel — confirm payment ──
    const handleHotelConfirm = useCallback(async () => {
        const cErr = validateCard(card);
        if (Object.keys(cErr).length > 0) {
            setCardErrors(cErr);
            return;
        }

        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            await http.post('/hotels/confirm', {
                hotelId,
                roomId,
                rateKey,
                checkIn,
                checkOut,
                adults,
                currency,
                amount: totalPrice,
                guestFirstName: guest.firstName,
                guestLastName: guest.lastName,
                guestEmail: guest.email,
                guestPhone: guest.phone,
                // In a real Stripe integration: paymentIntentId from the confirmed intent
            });
            setStep('success');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Payment failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [card, hotelId, roomId, rateKey, checkIn, checkOut, adults, currency, totalPrice, guest]);

    // ── Submit: flight ──
    const handleFlightSubmit = useCallback(async () => {
        const pErr = validatePassengers(passengers);
        if (Object.keys(pErr).length > 0) {
            setPassengerErrors(pErr);
            return;
        }

        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        if (!selectedFlight) {
            setErrorMsg('Flight offer not found. Please go back and select a flight again.');
            return;
        }

        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            const bundleHotelId = searchParams.get('bundleHotelId');

            // Build passengers array matching backend expectations
            const bookingPassengers = passengers.map((p) => ({
                type: 'ADT' as const,
                firstName: p.firstName,
                lastName: p.lastName,
                gender: 'M' as const,
                birthDate: p.dateOfBirth,
                nationality: 'KR',
                passport: p.passportNumber,
                passportExpiry: '',
            }));

            // Build contact from first passenger + user
            const contact = {
                email: passengers[0]?.email || user.email || '',
                phone: passengers[0]?.phone || '',
                countryCode: '82',
            };

            // Build flight payload matching V1's shape
            const flightPayload = {
                traceId: selectedFlight.traceId || selectedFlight.offerId,
                resultIndex: selectedFlight.physicalFlightId || selectedFlight.offerId,
                price: selectedFlight.price.total,
                currency: selectedFlight.price.currency,
                tripType: selectedFlight.tripType ?? 'one-way',
                validatingAirline: (selectedFlight as any).validatingAirline || selectedFlight.segments?.[0]?.airline,
                segments: selectedFlight.segments?.map((seg: any) => ({
                    airline: typeof seg.airline === 'object' ? seg.airline.code : seg.airline,
                    airlineName: typeof seg.airline === 'object' ? seg.airline.name : undefined,
                    flightNumber: seg.flightNumber,
                    origin: seg.origin || seg.departure?.airport,
                    destination: seg.destination || seg.arrival?.airport,
                    departureTime: seg.departureTime || seg.departure?.time,
                    arrivalTime: seg.arrivalTime || seg.arrival?.time,
                    cabinClass: seg.cabinClass,
                    bookingClass: seg.bookingClass,
                    fareBasis: seg.fareBasis,
                    itineraryIndex: seg.itineraryIndex,
                })) ?? [],
                // Duffel requires the raw offer to complete booking
                ...(selectedFlight.provider === 'duffel' ? {
                    _rawOffer: selectedFlight._rawOffer || (selectedFlight as any).raw || selectedFlight,
                } : {}),
            };

            await http.post('/flights/book', {
                provider: selectedFlight.provider,
                flight: flightPayload,
                passengers: bookingPassengers,
                contact,
                idempotencyKey: idempotencyKeyRef.current,
                farePolicy: selectedFlight.farePolicy || {
                    isRefundable: false,
                    isChangeable: false,
                    policyVersion: 'search' as const,
                    policySource: 'duffel' as const,
                },
                displayCurrency: 'USD',
                ...(bundleHotelId ? { bundleHotelId } : {}),
            });

            // Clean up sessionStorage on success
            sessionStorage.removeItem('selectedFlight');
            sessionStorage.removeItem('flightSearchPassengers');
            setStep('success');
        } catch (err: any) {
            if (err?.code === 'unauthenticated') {
                router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Booking failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [passengers, user, router, selectedFlight, searchParams]);

    // ── Success screen ──
    if (step === 'success') {
        const displayOrigin = selectedFlight?.segments?.[0]?.origin || origin || '—';
        const displayDestination = selectedFlight?.segments?.[selectedFlight.segments.length - 1]?.destination || destination || '—';
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <Header />
                <main className="flex flex-col items-center justify-center px-4 py-24 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-6">
                        <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Booking confirmed!
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
                        {mode === 'hotel'
                            ? `Your stay at ${hotelName} is confirmed. A confirmation has been sent to ${guest.email}.`
                            : `Your flight from ${displayOrigin} to ${displayDestination} is confirmed.`}
                    </p>
                    <Button onClick={() => router.push('/trips')}>View my trips</Button>
                </main>
            </div>
        );
    }

    // ── Booking summary data ──
    const summaryData =
        mode === 'hotel'
            ? {
                  mode: 'hotel' as const,
                  hotelName,
                  roomName,
                  checkIn,
                  checkOut,
                  adults,
                  totalPrice,
                  currency,
              }
            : {
                  mode: 'flight' as const,
                  origin: selectedFlight?.segments?.[0]?.origin || origin,
                  destination: selectedFlight?.segments?.[selectedFlight.segments.length - 1]?.destination || destination,
                  departureDate: selectedFlight?.segments?.[0]?.departure?.time?.slice(0, 10) || departureDate,
                  cabin: selectedFlight?.segments?.[0]?.cabinClass || cabin,
                  totalAmount: selectedFlight?.price?.total || totalAmount,
                  currency: selectedFlight?.price?.currency || flightCurrency,
                  passengers: adults,
              };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <Header />

            <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
                {/* Back button */}
                <button
                    onClick={() => (step === 'payment' ? setStep('form') : router.back())}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6 transition-colors"
                >
                    <ArrowLeft size={16} />
                    {step === 'payment' ? 'Back to details' : 'Back'}
                </button>

                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-8">
                    {step === 'payment' ? 'Payment' : 'Complete your booking'}
                </h1>

                {/* Not logged in banner */}
                {!user && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-4">
                        <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Sign in to continue</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                You&apos;ll need to be signed in to complete your booking.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                router.push(
                                    `/login?redirect=${encodeURIComponent(
                                        window.location.pathname + window.location.search
                                    )}`
                                )
                            }
                        >
                            Sign in
                        </Button>
                    </div>
                )}

                {/* Error banner */}
                {errorMsg && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-900/20 p-4">
                        <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-rose-700 dark:text-rose-300">{errorMsg}</p>
                    </div>
                )}

                {/* 2-column layout: form on left, summary on right */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
                    {/* Left column — form */}
                    <div className="space-y-5">
                        {mode === 'hotel' ? (
                            <>
                                {/* Step 1: Guest info */}
                                {step === 'form' && (
                                    <>
                                        <GuestForm
                                            mode="hotel"
                                            guest={guest}
                                            errors={guestErrors}
                                            onChange={handleGuestChange}
                                        />
                                        <Button
                                            fullWidth
                                            size="lg"
                                            isLoading={isSubmitting}
                                            onClick={handleHotelSubmitForm}
                                        >
                                            Continue to payment
                                        </Button>
                                    </>
                                )}

                                {/* Step 2: Payment */}
                                {step === 'payment' && (
                                    <>
                                        <PaymentSection
                                            card={card}
                                            errors={cardErrors}
                                            onChange={handleCardChange}
                                        />
                                        <Button
                                            fullWidth
                                            size="lg"
                                            isLoading={isSubmitting}
                                            onClick={handleHotelConfirm}
                                        >
                                            Pay {currency} {totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </Button>
                                    </>
                                )}
                            </>
                        ) : (
                            /* Flight: single-step form */
                            <>
                                {!selectedFlight && (
                                    <div className="rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-4 mb-4">
                                        <p className="text-sm text-amber-700 dark:text-amber-300">
                                            Loading flight details… If this persists, go back and select a flight again.
                                        </p>
                                    </div>
                                )}
                                <GuestForm
                                    mode="flight"
                                    passengers={passengers}
                                    errors={passengerErrors}
                                    onChange={handlePassengerChange}
                                />
                                <Button
                                    fullWidth
                                    size="lg"
                                    isLoading={isSubmitting}
                                    onClick={handleFlightSubmit}
                                    disabled={!selectedFlight}
                                >
                                    Confirm booking — {selectedFlight?.price?.currency || flightCurrency} {(selectedFlight?.price?.total || totalAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </Button>
                            </>
                        )}

                        {/* Fine print */}
                        <p className="text-[10px] text-slate-400 text-center px-2">
                            By continuing you agree to our{' '}
                            <a href="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">
                                Terms of Service
                            </a>{' '}
                            and{' '}
                            <a href="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">
                                Privacy Policy
                            </a>
                            .
                        </p>
                    </div>

                    {/* Right column — summary (sticky) */}
                    <div className="lg:sticky lg:top-24">
                        <BookingSummary data={summaryData} />
                    </div>
                </div>
            </main>
        </div>
    );
}

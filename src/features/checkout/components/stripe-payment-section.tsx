'use client';

import React, { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Lock, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { getStripe } from '@/shared/lib/stripe';

// ─── Inner form (runs inside <Elements>) ─────────────────────────────────────

function CheckoutForm({ onSuccess }: { onSuccess: (paymentIntentId: string) => void }) {
    const stripe = useStripe();
    const elements = useElements();

    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsLoading(true);
        setSubmitted(true);
        setMessage(null);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/trips?payment=success`,
            },
            redirect: 'if_required',
        });

        if (error) {
            setMessage(error.message || 'Payment failed. Please try again.');
            setIsLoading(false);
            setSubmitted(false);
        } else if (paymentIntent && (
            paymentIntent.status === 'succeeded' ||
            paymentIntent.status === 'requires_capture'
        )) {
            onSuccess(paymentIntent.id);
        } else {
            setMessage('Your payment is processing. This may take a moment.');
            setIsLoading(false);
            setSubmitted(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                        <CreditCard size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="font-bold text-slate-900 dark:text-white text-base">Payment info</h2>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <Lock size={10} />
                    <span>Secured by Stripe</span>
                </div>
            </div>

            {/* Stripe PaymentElement — renders all payment methods in an accordion */}
            <PaymentElement
                options={{ layout: 'accordion' }}
                onLoadError={(event) => {
                    console.error('[stripe] PaymentElement load error:', event.elementType, event.error);
                    setMessage(
                        (event.error as { message?: string })?.message ||
                        'Failed to load payment form. Please refresh the page.'
                    );
                }}
            />

            {/* Pay button */}
            <button
                type="submit"
                disabled={isLoading || submitted || !stripe || !elements}
                className={cn(
                    'w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
                    'bg-blue-600 hover:bg-blue-700 text-white',
                    'disabled:bg-blue-400 disabled:cursor-not-allowed',
                )}
            >
                {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : (
                    'Pay now'
                )}
            </button>

            {/* Error / info message */}
            {message && (
                <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/60 p-3">
                    <AlertCircle size={14} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 dark:text-rose-300">{message}</p>
                </div>
            )}

            {/* Security note */}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Lock size={9} />
                Your payment information is encrypted and never stored on our servers.
            </p>
        </form>
    );
}

// ─── Outer wrapper (provides <Elements> context) ─────────────────────────────

interface StripePaymentSectionProps {
    clientSecret: string;
    onSuccess: (paymentIntentId: string) => void;
}

export function StripePaymentSection({ clientSecret, onSuccess }: StripePaymentSectionProps) {
    // Clean up Stripe's floating iframes on true unmount.
    // Guard with a 300ms timer so React Strict Mode's synthetic first-mount cleanup
    // (which runs synchronously before re-mount) doesn't yank iframes mid-init.
    useEffect(() => {
        let settled = false;
        const timer = setTimeout(() => { settled = true; }, 300);
        return () => {
            clearTimeout(timer);
            if (settled) {
                document.querySelectorAll(
                    'iframe[name*="privateStripe"], iframe[name*="__stripe"], div[class*="__PrivateStripeElement"]'
                ).forEach(el => el.remove());
            }
        };
    }, []);

    if (!clientSecret) return null;

    return (
        <Elements options={{ clientSecret, appearance: { theme: 'stripe' } }} stripe={getStripe()}>
            <CheckoutForm onSuccess={onSuccess} />
        </Elements>
    );
}

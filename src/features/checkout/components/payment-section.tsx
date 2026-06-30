'use client';

import React from 'react';
import { CreditCard, Lock } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardInfo {
    cardNumber: string;
    expiry: string;
    cvv: string;
    nameOnCard: string;
}

interface PaymentSectionProps {
    card: CardInfo;
    errors: Partial<Record<keyof CardInfo, string>>;
    onChange: (field: keyof CardInfo, value: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fieldClass = (hasError: boolean) =>
    cn(
        'flex h-11 w-full rounded-xl border px-3 py-2 text-sm placeholder:text-slate-400 outline-none transition-all font-mono',
        'bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white',
        'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
        hasError
            ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500'
            : 'border-slate-200 dark:border-white/10',
    );

const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="mt-1 text-[10px] font-bold text-rose-500">{message}</p> : null;

const SectionLabel = ({ label }: { label: string }) => (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400/80 mb-1.5">
        {label}
    </label>
);

// Format card number with spaces every 4 digits
function formatCardNumber(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
}

// Format expiry as MM/YY
function formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentSection({ card, errors, onChange }: PaymentSectionProps) {
    const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange('cardNumber', formatCardNumber(e.target.value));
    };

    const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange('expiry', formatExpiry(e.target.value));
    };

    const handleCvv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
        onChange('cvv', digits);
    };

    return (
        <div className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
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

            {/* Accepted cards strip */}
            <div className="flex items-center gap-2">
                {['VISA', 'MC', 'AMEX', 'JCB'].map((card) => (
                    <span
                        key={card}
                        className="inline-flex items-center px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 text-[9px] font-bold tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5"
                    >
                        {card}
                    </span>
                ))}
            </div>

            {/* Fields */}
            <div className="space-y-4">
                {/* Name on card */}
                <div>
                    <SectionLabel label="Name on card" />
                    <input
                        type="text"
                        placeholder="John Doe"
                        value={card.nameOnCard}
                        onChange={(e) => onChange('nameOnCard', e.target.value)}
                        className={cn(fieldClass(!!errors.nameOnCard), 'font-sans')}
                        autoComplete="cc-name"
                    />
                    <FieldError message={errors.nameOnCard} />
                </div>

                {/* Card number */}
                <div>
                    <SectionLabel label="Card number" />
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="1234 5678 9012 3456"
                            value={card.cardNumber}
                            onChange={handleCardNumber}
                            className={cn(fieldClass(!!errors.cardNumber), 'pr-10')}
                            autoComplete="cc-number"
                        />
                        <CreditCard
                            size={16}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none"
                        />
                    </div>
                    <FieldError message={errors.cardNumber} />
                </div>

                {/* Expiry + CVV */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <SectionLabel label="Expiry (MM/YY)" />
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="MM/YY"
                            value={card.expiry}
                            onChange={handleExpiry}
                            className={fieldClass(!!errors.expiry)}
                            autoComplete="cc-exp"
                        />
                        <FieldError message={errors.expiry} />
                    </div>
                    <div>
                        <SectionLabel label="CVV" />
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="123"
                            value={card.cvv}
                            onChange={handleCvv}
                            className={fieldClass(!!errors.cvv)}
                            autoComplete="cc-csc"
                        />
                        <FieldError message={errors.cvv} />
                    </div>
                </div>
            </div>

            {/* Security note */}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Lock size={9} />
                Your payment information is encrypted and never stored on our servers.
            </p>
        </div>
    );
}

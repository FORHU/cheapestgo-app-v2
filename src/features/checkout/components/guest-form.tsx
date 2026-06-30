'use client';

import React from 'react';
import { User, Plane } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuestInfo {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
}

export interface PassengerInfo {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    passportNumber: string;
}

interface HotelGuestFormProps {
    mode: 'hotel';
    guest: GuestInfo;
    errors: Partial<Record<keyof GuestInfo, string>>;
    onChange: (field: keyof GuestInfo, value: string) => void;
}

interface FlightPassengerFormProps {
    mode: 'flight';
    passengers: PassengerInfo[];
    errors: Partial<Record<string, string>>;
    onChange: (index: number, field: keyof PassengerInfo, value: string) => void;
}

type GuestFormProps = HotelGuestFormProps | FlightPassengerFormProps;

// ─── Shared field style ───────────────────────────────────────────────────────

const fieldClass = (hasError: boolean) =>
    cn(
        'flex h-11 w-full rounded-xl border px-3 py-2 text-sm placeholder:text-slate-400 outline-none transition-all',
        'bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white',
        'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
        hasError
            ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500'
            : 'border-slate-200 dark:border-white/10',
    );

const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="mt-1 text-[10px] font-bold text-rose-500">{message}</p> : null;

const SectionLabel = ({ label, required }: { label: string; required?: boolean }) => (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400/80 mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
);

// ─── Hotel guest form ─────────────────────────────────────────────────────────

function HotelGuestFields({
    guest,
    errors,
    onChange,
}: {
    guest: GuestInfo;
    errors: Partial<Record<keyof GuestInfo, string>>;
    onChange: (field: keyof GuestInfo, value: string) => void;
}) {
    return (
        <div className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <User size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white text-base">Guest details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <SectionLabel label="First name" required />
                    <input
                        type="text"
                        placeholder="First name"
                        value={guest.firstName}
                        onChange={(e) => onChange('firstName', e.target.value)}
                        className={fieldClass(!!errors.firstName)}
                        autoComplete="given-name"
                    />
                    <FieldError message={errors.firstName} />
                </div>
                <div>
                    <SectionLabel label="Last name" required />
                    <input
                        type="text"
                        placeholder="Last name"
                        value={guest.lastName}
                        onChange={(e) => onChange('lastName', e.target.value)}
                        className={fieldClass(!!errors.lastName)}
                        autoComplete="family-name"
                    />
                    <FieldError message={errors.lastName} />
                </div>
                <div>
                    <SectionLabel label="Email" required />
                    <input
                        type="email"
                        placeholder="you@example.com"
                        value={guest.email}
                        onChange={(e) => onChange('email', e.target.value)}
                        className={fieldClass(!!errors.email)}
                        autoComplete="email"
                    />
                    <FieldError message={errors.email} />
                </div>
                <div>
                    <SectionLabel label="Phone" required />
                    <input
                        type="tel"
                        placeholder="+1 555 000 0000"
                        value={guest.phone}
                        onChange={(e) => onChange('phone', e.target.value)}
                        className={fieldClass(!!errors.phone)}
                        autoComplete="tel"
                    />
                    <FieldError message={errors.phone} />
                </div>
            </div>
        </div>
    );
}

// ─── Flight passenger form ────────────────────────────────────────────────────

function FlightPassengerFields({
    passengers,
    errors,
    onChange,
}: {
    passengers: PassengerInfo[];
    errors: Partial<Record<string, string>>;
    onChange: (index: number, field: keyof PassengerInfo, value: string) => void;
}) {
    return (
        <div className="space-y-4">
            {passengers.map((p, idx) => (
                <div
                    key={idx}
                    className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                            <Plane size={14} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-white text-base">
                            Passenger {passengers.length > 1 ? idx + 1 : ''}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(
                            [
                                { field: 'firstName', label: 'First name', type: 'text', auto: 'given-name', placeholder: 'First name' },
                                { field: 'lastName', label: 'Last name', type: 'text', auto: 'family-name', placeholder: 'Last name' },
                                { field: 'email', label: 'Email', type: 'email', auto: 'email', placeholder: 'you@example.com' },
                                { field: 'phone', label: 'Phone', type: 'tel', auto: 'tel', placeholder: '+1 555 000 0000' },
                                { field: 'dateOfBirth', label: 'Date of birth', type: 'date', auto: 'bday', placeholder: '' },
                                { field: 'passportNumber', label: 'Passport number', type: 'text', auto: 'off', placeholder: 'A12345678' },
                            ] as const
                        ).map(({ field, label, type, auto, placeholder }) => {
                            const errKey = `${idx}.${field}`;
                            return (
                                <div key={field}>
                                    <SectionLabel label={label} required />
                                    <input
                                        type={type}
                                        placeholder={placeholder}
                                        value={p[field as keyof PassengerInfo]}
                                        onChange={(e) => onChange(idx, field as keyof PassengerInfo, e.target.value)}
                                        className={fieldClass(!!errors[errKey])}
                                        autoComplete={auto}
                                    />
                                    <FieldError message={errors[errKey]} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Exported component ───────────────────────────────────────────────────────

export function GuestForm(props: GuestFormProps) {
    if (props.mode === 'hotel') {
        return (
            <HotelGuestFields
                guest={props.guest}
                errors={props.errors}
                onChange={props.onChange}
            />
        );
    }
    return (
        <FlightPassengerFields
            passengers={props.passengers}
            errors={props.errors}
            onChange={props.onChange}
        />
    );
}

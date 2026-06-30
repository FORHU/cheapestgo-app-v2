'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useRegister } from '../hooks/use-auth';

interface PasswordRule {
    label: string;
    test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'At least one uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'At least one number', test: (p) => /\d/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
    if (!password) return null;
    return (
        <div className="mt-2 space-y-1">
            {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                    <div key={rule.label} className="flex items-center gap-1.5 text-[10px]">
                        {ok
                            ? <Check size={11} className="text-emerald-500" />
                            : <X size={11} className="text-slate-300 dark:text-slate-600" />
                        }
                        <span className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                            {rule.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export function RegisterForm() {
    const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<Partial<typeof form>>({});

    const register = useRegister();

    const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validate = () => {
        const e: typeof errors = {};
        if (!form.email) e.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
        if (!form.firstName) e.firstName = 'First name is required';
        if (!form.password) e.password = 'Password is required';
        else if (!PASSWORD_RULES.every((r) => r.test(form.password))) e.password = 'Password does not meet requirements';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        register.mutate(form);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Input
                    id="firstName"
                    label="First name"
                    value={form.firstName}
                    onChange={set('firstName')}
                    placeholder="First"
                    icon={User}
                    error={errors.firstName}
                    autoComplete="given-name"
                />
                <Input
                    id="lastName"
                    label="Last name"
                    value={form.lastName}
                    onChange={set('lastName')}
                    placeholder="Last"
                    error={errors.lastName}
                    autoComplete="family-name"
                />
            </div>

            <Input
                id="email"
                type="email"
                label="Email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                icon={Mail}
                error={errors.email}
                autoComplete="email"
            />

            <div className="relative">
                <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Create a strong password"
                    icon={Lock}
                    error={errors.password}
                    autoComplete="new-password"
                    className="pr-10"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <PasswordStrength password={form.password} />
            </div>

            <Button
                type="submit"
                fullWidth
                isLoading={register.isPending}
                rightIcon={<ArrowRight size={16} />}
            >
                Create account
            </Button>

            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                By signing up you agree to our{' '}
                <a href="/terms-of-service" className="text-blue-600 hover:underline">Terms</a>
                {' '}and{' '}
                <a href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a>.
            </p>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Sign in
                </Link>
            </p>
        </form>
    );
}

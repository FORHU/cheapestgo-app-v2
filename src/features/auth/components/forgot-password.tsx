'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useResetPassword } from '../hooks/use-auth';

export function ForgotPasswordForm() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    const reset = useResetPassword();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email) { setError('Email is required'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email'); return; }
        try {
            await reset.mutateAsync(email);
            setSent(true);
        } catch {
            // error toast handled in hook
        }
    };

    if (sent) {
        return (
            <div className="text-center space-y-4 py-4">
                <div className="flex justify-center">
                    <CheckCircle className="h-12 w-12 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Check your inbox</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    We sent a password reset link to{' '}
                    <strong className="text-slate-700 dark:text-slate-300">{email}</strong>.
                    Click the link in the email to set a new password.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    Didn&apos;t receive it? Check your spam folder or{' '}
                    <button
                        onClick={() => setSent(false)}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        try again
                    </button>.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Reset your password
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Enter your email and we&apos;ll send you a reset link.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    id="reset-email"
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="your@email.com"
                    icon={Mail}
                    error={error}
                    disabled={reset.isPending}
                    autoComplete="email"
                />
                <Button type="submit" fullWidth isLoading={reset.isPending}>
                    Send reset link
                </Button>
            </form>

            <div className="text-center">
                <Link
                    href="/login"
                    className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    <ArrowLeft size={14} />
                    Back to sign in
                </Link>
            </div>
        </div>
    );
}

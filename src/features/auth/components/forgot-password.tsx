'use client';

import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useResetPassword } from '../hooks/use-auth';

export function ForgotPasswordForm() {
    const tAll = useTranslations();
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
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{tAll('auth.checkInbox')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    We sent a password reset link to{' '}
                    <strong className="text-slate-700 dark:text-slate-300">{email}</strong>{tAll('auth.clickLinkSuffix')}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    Didn&apos;t receive it? Check your spam folder or{' '}
                    <button
                        onClick={() => setSent(false)}
                        className="text-alabaster-accent dark:text-obsidian-accent hover:underline"
                    >
                        {tAll('auth.tryAgain')}
                    </button>.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {tAll('auth.resetYourPassword')}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {tAll('auth.forgotBody')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    id="reset-email"
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder={tAll('auth.emailPlaceholder')}
                    icon={Mail}
                    error={error}
                    disabled={reset.isPending}
                    autoComplete="email"
                />
                <Button type="submit" fullWidth isLoading={reset.isPending}>
                    {tAll('auth.sendResetLink')}
                </Button>
            </form>

            <div className="text-center">
                <Link
                    href="/login"
                    className="flex items-center justify-center gap-1 text-sm text-alabaster-accent dark:text-obsidian-accent hover:underline font-medium"
                >
                    <ArrowLeft size={14} />
                    {tAll('auth.backToSignIn')}
                </Link>
            </div>
        </div>
    );
}

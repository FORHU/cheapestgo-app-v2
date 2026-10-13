'use client';

import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Lock, CheckCircle } from 'lucide-react';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { http } from '@/shared/lib/http';

function ResetPasswordForm() {
    const tAll = useTranslations();
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const validate = () => {
        const errs: { password?: string; confirm?: string } = {};
        if (!password) errs.password = 'Password is required';
        else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
        if (!confirm) errs.confirm = 'Please confirm your password';
        else if (password !== confirm) errs.confirm = 'Passwords do not match';
        return errs;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});

        if (!token) {
            setError('Reset token is missing. Please use the link from your email.');
            return;
        }

        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            return;
        }

        setIsLoading(true);
        try {
            await http.put<{ message: string }>('/auth/reset-password', { token, password });
            setSuccess(true);
            setTimeout(() => router.push('/login?reset=success'), 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center space-y-4 py-4">
                <div className="flex justify-center">
                    <CheckCircle className="h-12 w-12 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{tAll('auth.passwordUpdated')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Your password has been reset. Redirecting you to sign in&hellip;
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {tAll('auth.setNewPassword')}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {tAll('auth.chooseStrong')}
                </p>
            </div>

            {error && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                    {error}
                </div>
            )}

            {!token && !error && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                    {tAll('auth.noResetToken')}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    id="new-password"
                    type="password"
                    label="New password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder={tAll('auth.atLeast8')}
                    icon={Lock}
                    error={fieldErrors.password}
                    disabled={isLoading || !token}
                    autoComplete="new-password"
                />
                <Input
                    id="confirm-password"
                    type="password"
                    label="Confirm password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setFieldErrors((p) => ({ ...p, confirm: undefined })); }}
                    placeholder={tAll('auth.repeatPassword')}
                    icon={Lock}
                    error={fieldErrors.confirm}
                    disabled={isLoading || !token}
                    autoComplete="new-password"
                />
                <Button type="submit" fullWidth isLoading={isLoading} disabled={!token}>
                    {tAll('auth.resetPassword')}
                </Button>
            </form>

            <div className="text-center">
                <Link
                    href="/login"
                    className="text-sm text-alabaster-accent dark:text-obsidian-accent hover:underline font-medium"
                >
                    {tAll('auth.backToSignIn')}
                </Link>
            </div>
        </div>
    );
}

export function ResetPasswordView() {
    const tAll = useTranslations();
    return (
        <AuthLayout
            title={tAll('auth.setNewPassword')}
            subtitle={tAll('auth.notUsedBefore')}
            pitch="A new password, and you are back where you left off."
        >
            <Suspense fallback={
                <div className="space-y-4 animate-pulse">
                    <div className="h-6 w-3/4 rounded-lg bg-slate-100 dark:bg-slate-800" />
                    <div className="h-4 w-1/2 rounded-lg bg-slate-100 dark:bg-slate-800" />
                    <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800" />
                    <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800" />
                    <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800" />
                </div>
            }>
                <ResetPasswordForm />
            </Suspense>
        </AuthLayout>
    );
}

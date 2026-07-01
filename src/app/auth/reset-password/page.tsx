'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, PlaneTakeoff, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { http } from '@/shared/lib/http';

// ─── Inner form — reads searchParams ──────────────────────────────────────────

function ResetPasswordForm() {
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
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Password updated</h2>
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
                    Set a new password
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Choose a strong password for your account.
                </p>
            </div>

            {error && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                    {error}
                </div>
            )}

            {!token && !error && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                    No reset token found. Please use the link sent to your email.
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    id="new-password"
                    type="password"
                    label="New password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder="At least 8 characters"
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
                    placeholder="Repeat your password"
                    icon={Lock}
                    error={fieldErrors.confirm}
                    disabled={isLoading || !token}
                    autoComplete="new-password"
                />
                <Button type="submit" fullWidth isLoading={isLoading} disabled={!token}>
                    Reset password
                </Button>
            </form>

            <div className="text-center">
                <Link
                    href="/login"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    Back to sign in
                </Link>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
            <div className="w-full max-w-sm space-y-8">
                {/* Logo */}
                <div className="text-center space-y-2">
                    <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
                        <PlaneTakeoff size={22} className="text-blue-600" />
                        CheapestGo
                    </Link>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Reset your account password</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-white/10 p-8">
                    <Suspense fallback={
                        <div className="space-y-4 animate-pulse">
                            <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-3/4" />
                            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/2" />
                            <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                            <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                            <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                        </div>
                    }>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * Where an OAuth round trip lands when it fails.
 *
 * v2 has Google sign-in, and `auth/google/callback` can fail the same ways v1's could —
 * an expired code, one already spent — but this page was never ported, so that path
 * ended on a 404. The copy is v1's, already translated in all four languages.
 */
export default function AuthCodeErrorPage() {
    const t = useTranslations('errors.auth');
    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-obsidian">
            <main className="flex flex-1 items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-slate-900">
                        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{t('title')}</h2>
                        <p className="mb-6 text-slate-500 dark:text-slate-400">{t('description')}</p>
                        <div className="space-y-3">
                            <Link href="/login" className="block w-full rounded-full bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700">
                                {t('signInAgain')}
                            </Link>
                            <Link href="/" className="block w-full rounded-full border border-slate-200 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5">
                                {t('goHome')}
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

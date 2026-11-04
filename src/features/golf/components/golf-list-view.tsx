'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Header } from '@/shared/components/header';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { useUserCurrency } from '@/shared/stores/search.store';
import { fetchGolfCatalogue } from '@/features/golf/api/golf.api';
import { GolfCourseCard } from '@/features/golf/components/golf-course-card';
import type { GolfCatalogue } from '@/features/golf/types';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; catalogue: GolfCatalogue };

/**
 * `/golf`: every published course, optionally in one country. Asked in the viewer's Display Currency
 * and asked again when it changes; the browser never converts a fee itself.
 */
export function GolfListView({ country }: { country?: string }) {
    const t = useTranslations('golf');
    const currency = useUserCurrency();
    const [state, setState] = useState<State>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        fetchGolfCatalogue({ country, currency })
            .then((catalogue) => { if (!cancelled) setState({ status: 'ready', catalogue }); })
            .catch(() => { if (!cancelled) setState({ status: 'error' }); });
        return () => { cancelled = true; };
    }, [country, currency, attempt]);

    const countries = state.status === 'ready' ? state.catalogue.countries : [];

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">{t('eyebrow')}</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{t('title')}</h1>
                <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>

                {(countries.length > 1 || country) && (
                    <nav aria-label={t('filterLabel')} className="mt-6 flex flex-wrap gap-2">
                        <CountryChip href="/golf" active={!country}>{t('allCountries')}</CountryChip>
                        {countries.map((c) => (
                            <CountryChip key={c} href={`/golf?country=${encodeURIComponent(c)}`} active={c === country}>{c}</CountryChip>
                        ))}
                    </nav>
                )}

                <div className="mt-8">
                    {state.status === 'loading' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] w-full" />)}
                        </div>
                    )}

                    {state.status === 'error' && (
                        <StateScreen
                            icon={AlertCircle}
                            title={t('errorTitle')}
                            lines={[t('errorBody')]}
                            actions={<button type="button" className={stateActionClass} onClick={() => setAttempt((a) => a + 1)}>{t('retry')}</button>}
                        />
                    )}

                    {state.status === 'ready' && state.catalogue.courses.length === 0 && (
                        <StateScreen
                            icon={Flag}
                            title={country ? t('emptyCountryTitle', { country }) : t('emptyTitle')}
                            lines={[country ? t('emptyCountryBody') : t('emptyBody')]}
                            actions={country ? <Link href="/golf" className={stateActionClass}>{t('seeAll')}</Link> : undefined}
                        />
                    )}

                    {state.status === 'ready' && state.catalogue.courses.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {state.catalogue.courses.map((c) => <GolfCourseCard key={c.id} course={c} />)}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function CountryChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/30',
            )}
        >
            {children}
        </Link>
    );
}

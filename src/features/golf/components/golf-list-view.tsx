'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { FlatGround } from '@/shared/components/common/FlatGround';
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
 *
 * On My Bookings' ground and under its bar: the flat results ground (`FlatGround`), the landing
 * navbar in its themed tone, and a column at that bar's measure, so the grid starts on the logo's
 * line. The title and count line are set as the flight results' "Flights to Seoul". No background
 * of its own: one here would cover the ground `FlatGround` paints.
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
    const count = state.status === 'ready' ? state.catalogue.courses.length : null;

    return (
        <div className="flex min-h-screen flex-col">
            <FlatGround />
            <LandingHeader tone="default" />
            <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pt-2 pb-24 md:pt-4 md:pb-28">
                <div className="mb-5">
                    <h1 className="text-lg font-bold text-slate-900 md:text-2xl dark:text-slate-50">{t('title')}</h1>
                    {/* Held at its height while loading, so the grid does not drop a line when it lands. */}
                    <p className="mt-0.5 min-h-4 text-xs text-slate-500 md:min-h-5 md:text-sm dark:text-white/55">
                        {count != null && count > 0 && (country ? t('countIn', { count, country }) : t('count', { count }))}
                    </p>
                </div>

                {(countries.length > 1 || country) && (
                    <nav aria-label={t('filterLabel')} className="mb-6 flex flex-wrap gap-2">
                        <CountryChip href="/golf" active={!country}>{t('allCountries')}</CountryChip>
                        {countries.map((c) => (
                            <CountryChip key={c} href={`/golf?country=${encodeURIComponent(c)}`} active={c === country}>{c}</CountryChip>
                        ))}
                    </nav>
                )}

                {state.status === 'loading' && (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />)}
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
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {state.catalogue.courses.map((c) => <GolfCourseCard key={c.id} course={c} />)}
                    </div>
                )}
            </main>
        </div>
    );
}

/** A country to narrow to, as a pill: the brand's blue wash when chosen, the card surface otherwise. */
function CountryChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
                active
                    ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:border-blue-400 dark:bg-blue-400/15 dark:text-blue-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-white/25',
            )}
        >
            {children}
        </Link>
    );
}

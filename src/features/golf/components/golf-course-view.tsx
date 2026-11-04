'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Flag, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format';
import { useUserCurrency } from '@/shared/stores/search.store';
import { fetchGolfCourse } from '@/features/golf/api/golf.api';
import { AskTeeTimesButton } from '@/features/golf/components/ask-tee-times-button';
import type { GolfCourse } from '@/features/golf/types';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; course: GolfCourse };

/** Paragraphs are separated by a blank line, as the admin form says. */
const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/**
 * `/golf/[slug]`: one course, its facts and photos, and the way to ask about playing it. Fetched in
 * the viewer's Display Currency and again when that changes. An unknown or draft slug is already a
 * 404 from the server page; `missing` here covers a course unpublished while the page was open.
 */
export function GolfCourseView({ slug }: { slug: string }) {
    const t = useTranslations('golf');
    const tAll = useTranslations();
    const currency = useUserCurrency();
    const [state, setState] = useState<State>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [shown, setShown] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        fetchGolfCourse(slug, currency)
            .then((course) => { if (!cancelled) setState({ status: 'ready', course }); })
            .catch((err: { status?: number }) => {
                if (!cancelled) setState({ status: err?.status === 404 ? 'missing' : 'error' });
            });
        return () => { cancelled = true; };
    }, [slug, currency, attempt]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8">
                {state.status === 'loading' && (
                    <div className="space-y-4">
                        <Skeleton className="aspect-[16/9] w-full" />
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                    </div>
                )}

                {state.status === 'missing' && (
                    <StateScreen
                        icon={Flag}
                        title={t('missingTitle')}
                        lines={[t('missingBody')]}
                        actions={<Link href="/golf" className={stateActionClass}>{t('seeAll')}</Link>}
                    />
                )}

                {state.status === 'error' && (
                    <StateScreen
                        icon={AlertCircle}
                        title={t('errorTitle')}
                        lines={[t('errorBody')]}
                        actions={<button type="button" className={stateActionClass} onClick={() => setAttempt((a) => a + 1)}>{t('retry')}</button>}
                    />
                )}

                {state.status === 'ready' && (() => {
                    const c = state.course;
                    const cover = c.imageUrls[Math.min(shown, c.imageUrls.length - 1)];
                    const text = paragraphs(c.description);
                    return (
                        <>
                            <nav className="mb-6 text-xs text-slate-400 dark:text-slate-500">
                                <Link href="/" className="transition-colors hover:text-blue-500">{tAll('property.breadcrumbHome')}</Link>
                                <span className="mx-1.5">›</span>
                                <Link href="/golf" className="transition-colors hover:text-blue-500">{t('breadcrumb')}</Link>
                                <span className="mx-1.5">›</span>
                                <span className="text-slate-600 dark:text-slate-300">{c.name}</span>
                            </nav>

                            {cover && (
                                <div className="space-y-2">
                                    <div className="aspect-[16/9] overflow-hidden bg-slate-100 dark:bg-white/5">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- admin URLs come from any host */}
                                        <img src={cover} alt={c.name} className="h-full w-full object-cover" />
                                    </div>
                                    {c.imageUrls.length > 1 && (
                                        <div className="flex gap-2 overflow-x-auto">
                                            {c.imageUrls.map((url, i) => (
                                                <button
                                                    key={url}
                                                    type="button"
                                                    aria-label={t('photo', { n: i + 1 })}
                                                    aria-pressed={i === shown}
                                                    onClick={() => setShown(i)}
                                                    className={cn(
                                                        'h-16 w-24 shrink-0 overflow-hidden border-2 transition-opacity',
                                                        i === shown ? 'border-slate-900 dark:border-white' : 'border-transparent opacity-70 hover:opacity-100',
                                                    )}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
                                <div className="space-y-8">
                                    <header>
                                        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{c.name}</h1>
                                        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                                            <MapPin size={14} aria-hidden /> {c.city} · {c.country}
                                        </p>
                                        <ul className="mt-4 flex flex-wrap gap-2 text-xs">
                                            <li className="border border-slate-200 px-2.5 py-1 text-slate-700 dark:border-white/10 dark:text-slate-200">{t('holes', { holes: c.holes })}</li>
                                            {c.par != null && (
                                                <li className="border border-slate-200 px-2.5 py-1 text-slate-700 dark:border-white/10 dark:text-slate-200">{t('par', { par: c.par })}</li>
                                            )}
                                        </ul>
                                    </header>

                                    {c.amenities.length > 0 && (
                                        <section>
                                            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t('amenitiesTitle')}</h2>
                                            <ul className="grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-3 dark:text-slate-300">
                                                {c.amenities.map((a) => <li key={a}>{t(`amenities.${a}`)}</li>)}
                                            </ul>
                                        </section>
                                    )}

                                    {text.length > 0 && (
                                        <section>
                                            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t('aboutTitle')}</h2>
                                            <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                                {text.map((p, i) => <p key={i}>{p}</p>)}
                                            </div>
                                        </section>
                                    )}

                                    {c.address && (
                                        <section>
                                            <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{t('addressTitle')}</h2>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">{c.address}</p>
                                        </section>
                                    )}
                                </div>

                                <aside className="h-fit space-y-4 border border-slate-200 bg-white p-5 lg:sticky lg:top-24 dark:border-white/10 dark:bg-slate-900">
                                    {c.greenFeeFrom != null && (
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('fromLabel')}</p>
                                            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{formatCurrency(c.greenFeeFrom, c.currency)}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('guidePrice')}</p>
                                        </div>
                                    )}
                                    <AskTeeTimesButton />
                                </aside>
                            </div>
                        </>
                    );
                })()}
            </main>
            <Footer />
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Flag, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FlatGround } from '@/shared/components/common/FlatGround';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { formatCurrency } from '@/shared/lib/format';
import { SECTION_HEADING } from '@/shared/lib/layout';
import { useUserCurrency } from '@/shared/stores/search.store';
import { fetchGolfCourse } from '@/features/golf/api/golf.api';
import { AskTeeTimesButton } from '@/features/golf/components/ask-tee-times-button';
import { CourseColumn, CourseHero, Reveal } from '@/features/golf/components/course-hero';
import { TeeTimePicker, type TeeTimeSelection } from '@/features/golf/components/tee-time-picker';
import type { GolfCourse } from '@/features/golf/types';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; course: GolfCourse };

/** Paragraphs are separated by a blank line, as the admin form says. */
const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** A fact about the course, as a pill on the page ground. */
const CHIP = 'rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200';

/**
 * `/golf/[slug]`: one course, its facts and photos, and the way to ask about playing it — in the
 * property page's design: the photographs full-bleed with the name over them, then the page's column
 * on the flat ground, its sections rising in as they are reached, closing on the band that books a tee time.
 *
 * Fetched in the viewer's Display Currency and again when that changes. An unknown or draft slug is
 * already a 404 from the server page; `missing` here covers a course unpublished while the page was open.
 */
export function GolfCourseView({ slug, initial }: { slug: string; initial?: TeeTimeSelection }) {
    const t = useTranslations('golf');
    const currency = useUserCurrency();
    const [state, setState] = useState<State>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);

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

    if (state.status !== 'ready') {
        return (
            <div className="min-h-screen">
                <FlatGround />
                <CourseHero compact={state.status !== 'loading'} />
                <CourseColumn className="pt-8 pb-24">
                    {state.status === 'loading' && (
                        <div className="space-y-4">
                            <Skeleton className="h-8 w-1/2 rounded-full" />
                            <Skeleton className="h-4 w-1/3 rounded-full" />
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
                </CourseColumn>
            </div>
        );
    }

    const c = state.course;
    const text = paragraphs(c.description);

    return (
        <div className="min-h-screen">
            <FlatGround />
            <CourseHero course={{ name: c.name, place: `${c.city} · ${c.country}`, images: c.imageUrls }} />

            <CourseColumn className="pt-[clamp(20px,4vw,40px)] pb-24">
                <div className="space-y-12">
                    <Reveal>
                        <ul className="flex flex-wrap gap-2">
                            <li className={CHIP}>{t('holes', { holes: c.holes })}</li>
                            {c.par != null && <li className={CHIP}>{t('par', { par: c.par })}</li>}
                        </ul>
                    </Reveal>

                    {c.amenities.length > 0 && (
                        <Reveal>
                            <h2 className={`${SECTION_HEADING} mb-5 text-slate-900 dark:text-slate-50`}>{t('amenitiesTitle')}</h2>
                            <ul className="flex flex-wrap gap-2">
                                {c.amenities.map((a) => <li key={a} className={CHIP}>{t(`amenities.${a}`)}</li>)}
                            </ul>
                        </Reveal>
                    )}

                    {text.length > 0 && (
                        <Reveal>
                            <h2 className={`${SECTION_HEADING} mb-5 text-slate-900 dark:text-slate-50`}>{t('aboutTitle')}</h2>
                            <div className="max-w-3xl space-y-4 text-base leading-relaxed text-slate-700 dark:text-slate-300">
                                {text.map((p, i) => <p key={i}>{p}</p>)}
                            </div>
                        </Reveal>
                    )}

                    {c.address && (
                        <Reveal>
                            <h2 className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">{t('addressTitle')}</h2>
                            <p className="flex items-start gap-1.5 text-base text-slate-700 dark:text-slate-300">
                                <MapPin size={16} className="mt-1 shrink-0 text-blue-500" aria-hidden /> {c.address}
                            </p>
                        </Reveal>
                    )}
                </div>

                {/* With tee times the band shows real prices, so the "from" guide would only repeat it. */}
                <div className="mt-12">
                    {c.bookable ? (
                        <TeeTimePicker course={c} initial={initial} />
                    ) : (
                        <aside className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900">
                            {c.greenFeeFrom != null && (
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('fromLabel')}</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{formatCurrency(c.greenFeeFrom, c.currency)}</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('guidePrice')}</p>
                                </div>
                            )}
                            <div className="w-full sm:w-80"><AskTeeTimesButton /></div>
                        </aside>
                    )}
                </div>
            </CourseColumn>
        </div>
    );
}

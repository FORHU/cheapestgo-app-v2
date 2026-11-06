'use client';

import { useLocale, useTranslations } from 'next-intl';
import React, { useMemo, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { SECTION_HEADING } from '@/shared/lib/layout';
import type { ReviewItem } from '@/features/hotels/types/property.types';

/** How many reviews show at first, and how many more each "Load more" adds. */
const PAGE = 6;
/** Past this many characters a review is cut to four lines behind "Show more". */
const LONG = 220;

export type ReviewSort = 'newest' | 'highest' | 'lowest';

const scoreOf = (r: ReviewItem) => Number(r.score ?? 0) || 0;
/** NaN for a date that does not parse — the supplier's field is free text. */
const timeOf = (r: ReviewItem) => (r.review_date ? Date.parse(r.review_date) : NaN);

/**
 * The reviews in the order asked for. Stable, so reviews that tie keep the order api-v2 sent; a
 * review with no readable date sorts after every dated one under "Newest first".
 */
export function sortReviews(items: ReviewItem[], sort: ReviewSort): ReviewItem[] {
    const indexed = items.map((item, i) => ({ item, i }));
    indexed.sort((a, b) => {
        if (sort === 'highest') return scoreOf(b.item) - scoreOf(a.item) || a.i - b.i;
        if (sort === 'lowest')  return scoreOf(a.item) - scoreOf(b.item) || a.i - b.i;
        const ta = timeOf(a.item), tb = timeOf(b.item);
        if (Number.isNaN(ta) && Number.isNaN(tb)) return a.i - b.i;
        if (Number.isNaN(ta)) return 1;
        if (Number.isNaN(tb)) return -1;
        return tb - ta || a.i - b.i;
    });
    return indexed.map(x => x.item);
}

/** v1's bands, onto the labels v2 already has in `hotels.ratings`. */
function ratingKey(score: number): string {
    if (score >= 9) return 'exceptional';
    if (score >= 8) return 'excellent';
    if (score >= 7) return 'veryGood';
    if (score >= 6) return 'good';
    return 'average';
}

/**
 * A score's fill. The brand gradient for "excellent", as the page's other rating marks have it;
 * the rest are a shade dark enough to hold white text at the chip's size (4.5:1 or better).
 */
function scoreFill(score: number): string {
    if (score >= 9) return 'bg-emerald-700';
    if (score >= 8) return 'bg-linear-to-r from-blue-600 to-cyan-500';
    if (score >= 6) return 'bg-sky-700';
    return 'bg-amber-700';
}

/** Painted by theme, as the room cards above are; the cards are the room cards' plate. */
function reviewsPalette(tone: 'light' | 'dark') {
    const dark = tone === 'dark';
    return {
        title: dark ? 'text-white' : 'text-slate-900',
        body:  dark ? 'text-slate-300' : 'text-slate-600',
        muted: dark ? 'text-slate-400' : 'text-slate-500',
        card:  dark
            ? 'bg-slate-900 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.85),0_1px_3px_rgba(0,0,0,0.6)]'
            : 'bg-white shadow-[0_4px_10px_-2px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.08)]',
        /** The sort pills and "Load more": the room filters' pills — the gradient is the one on. */
        pillOn:  'bg-linear-to-r from-blue-600 to-cyan-500 text-white',
        pillOff: dark
            ? 'border border-white/25 bg-transparent text-white/70 hover:bg-white/[0.06]'
            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        link:  dark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700',
        pro:   dark ? 'text-emerald-400' : 'text-emerald-600',
        con:   dark ? 'text-slate-500' : 'text-slate-400',
    };
}

type Palette = ReturnType<typeof reviewsPalette>;

/**
 * The property page's guest reviews: v1's section — the overall score, the reviews with a sort
 * and a "Load more" — drawn in v2's language. A section heading straight on the page ground, the
 * score summary beside the list from `lg`, and each review on the room cards' plate.
 *
 * It replaces four tilted quote cards that showed the first line of four reviews and nothing
 * else: no overall score, no way to reach the rest, and a headline-or-pros guess at what to quote.
 *
 * `rating` and `count` are the hotel's aggregate, `items` the written reviews api-v2 sent with it
 * (20 at most). A hotel with a score and no written reviews still shows its score; one with
 * neither shows nothing.
 */
export function GuestReviews({ tone, rating, count, items, className }: {
    tone: 'light' | 'dark';
    rating: number;
    count: number;
    items: ReviewItem[];
    className?: string;
}) {
    const t = useTranslations('reviewsSection');
    const tRatings = useTranslations('hotels.ratings');
    const locale = useLocale();
    const palette = reviewsPalette(tone);
    const [sort, setSort] = useState<ReviewSort>('newest');
    const [shown, setShown] = useState(PAGE);
    const sorted = useMemo(() => sortReviews(items, sort), [items, sort]);

    if (rating <= 0 && items.length === 0) return null;

    const total = Math.max(count, items.length);
    const visible = sorted.slice(0, shown);
    const sorts: { value: ReviewSort; label: string }[] = [
        { value: 'newest',  label: t('sort.newestFirst') },
        { value: 'highest', label: t('sort.highestRated') },
        { value: 'lowest',  label: t('sort.lowestRated') },
    ];

    return (
        <section id="reviews-section" aria-labelledby="reviews-heading" className={className}>
            <h2 id="reviews-heading" className={cn(SECTION_HEADING, 'mb-4 sm:mb-6', palette.title)}>{t('guestReviews')}</h2>

            <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
                {/* Overall score */}
                {rating > 0 ? (
                    <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3">
                        <div
                            data-testid="reviews-score"
                            className={cn('flex size-[72px] shrink-0 items-center justify-center rounded-2xl text-[30px] font-bold text-white lg:size-24 lg:text-[40px]', scoreFill(rating))}
                        >
                            {rating.toFixed(1)}
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className={cn('text-[22px] leading-tight font-bold', palette.title)}>{tRatings(ratingKey(rating))}</p>
                            {total > 0 && (
                                <p className={cn('text-[15px]', palette.muted)}>
                                    {/* Grouped in the page's locale — the message's plain `{count}` prints 1240. */}
                                    {total === 1
                                        ? t('basedOnReview', { count: total })
                                        : t('basedOnReviews', { count: new Intl.NumberFormat(locale).format(total) })}
                                </p>
                            )}
                        </div>
                    </div>
                ) : <div aria-hidden className="hidden lg:block" />}

                <div className="flex min-w-0 flex-col gap-5">
                    {items.length > 1 && (
                        <div className="flex flex-wrap gap-2">
                            {sorts.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    aria-pressed={sort === s.value}
                                    onClick={() => { setSort(s.value); setShown(PAGE); }}
                                    className={cn(
                                        'h-10 cursor-pointer rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition-colors',
                                        sort === s.value ? palette.pillOn : palette.pillOff,
                                    )}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {items.length === 0 ? (
                        <div className={cn('rounded-xl p-6 text-center', palette.card)}>
                            <p className={cn('text-[15px] font-medium', palette.body)}>{t('noReviews')}</p>
                            <p className={cn('mt-1 text-[13px]', palette.muted)}>{t('aggregatedNote')}</p>
                        </div>
                    ) : (
                        <ul className="grid gap-4 xl:grid-cols-2">
                            {visible.map((review, i) => (
                                <li key={review.id ?? `${review.reviewer_name}-${i}`}>
                                    <ReviewCard review={review} palette={palette} />
                                </li>
                            ))}
                        </ul>
                    )}

                    {items.length > PAGE && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            {shown < sorted.length && (
                                <button
                                    type="button"
                                    onClick={() => setShown(n => n + PAGE)}
                                    className={cn('h-11 cursor-pointer rounded-full px-6 text-[14px] font-semibold transition-colors', palette.pillOff)}
                                >
                                    {t('loadMore')}
                                </button>
                            )}
                            <p aria-live="polite" className={cn('text-[14px]', palette.muted)}>
                                {t('showingCount', { shown: visible.length, total: sorted.length })}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function ReviewCard({ review, palette }: { review: ReviewItem; palette: Palette }) {
    const t = useTranslations('reviewsSection');
    const locale = useLocale();
    const [expanded, setExpanded] = useState(false);

    const score = scoreOf(review);
    const name = review.reviewer_name?.trim() || t('anonymous');
    const time = timeOf(review);
    const date = Number.isNaN(time) ? null : new Date(time).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
    const traveller = review.traveler_type?.trim();
    const meta = [review.country?.trim(), traveller && traveller[0].toUpperCase() + traveller.slice(1), date].filter(Boolean);
    const long = (review.pros?.length ?? 0) + (review.cons?.length ?? 0) > LONG;

    return (
        <article className={cn('flex h-full flex-col gap-3 rounded-xl p-5', palette.card)}>
            <header className="flex items-start gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-cyan-500 text-[15px] font-bold text-white">
                    {name[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[15px] font-semibold', palette.title)}>{name}</p>
                    {meta.length > 0 && <p className={cn('truncate text-[13px]', palette.muted)}>{meta.join(' · ')}</p>}
                </div>
                {score > 0 && (
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[14px] font-bold text-white', scoreFill(score))}>
                        {score.toFixed(1)}
                    </span>
                )}
            </header>

            {review.headline && <p className={cn('text-[16px] leading-snug font-semibold', palette.title)}>{review.headline}</p>}

            {(review.pros || review.cons) && (
                // Cut by height, not `line-clamp`: the pros and cons are flex rows (icon, text),
                // and a line clamp does not count lines inside a flex box. The fade says the text
                // goes on.
                <div className={cn(
                    'flex flex-col gap-2 text-[15px] leading-relaxed', palette.body,
                    long && !expanded && 'max-h-[6.25rem] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]',
                )}>
                    {review.pros && (
                        <p className="flex gap-2">
                            <ThumbsUp size={16} aria-hidden className={cn('mt-1 shrink-0', palette.pro)} />
                            <span>{review.pros}</span>
                        </p>
                    )}
                    {review.cons && (
                        <p className="flex gap-2">
                            <ThumbsDown size={16} aria-hidden className={cn('mt-1 shrink-0', palette.con)} />
                            <span>{review.cons}</span>
                        </p>
                    )}
                </div>
            )}

            {long && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(e => !e)}
                    className={cn('mt-auto self-start cursor-pointer text-[14px] font-semibold', palette.link)}
                >
                    {expanded ? t('showLess') : t('showMore')}
                </button>
            )}
        </article>
    );
}

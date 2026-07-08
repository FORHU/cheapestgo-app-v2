"use client";

import React from 'react';
import { Users, Heart, UserCircle, Briefcase, Users2 } from 'lucide-react';
import {
    HotelReview,
    formatReviewDate,
    getRatingLabel,
    getRatingColor,
    calculateTravelerBreakdown,
    TravelerBreakdown,
} from '@/features/hotels/lib/reviewsUtils';
import { useReviewsStore } from '@/stores/reviewsStore';

interface ReviewsSectionProps {
    reviews: HotelReview[];
    averageRating: number;
    totalCount: number;
}

function RatingSummary({ rating: rawRating, totalCount }: { rating: number; totalCount: number }) {
    const rating = Number(rawRating) || 0;
    return (
        <div className="flex items-center gap-2 lg:gap-3 lg:mb-6">
            <div className={`${getRatingColor(rating)} text-white w-9 h-9 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center font-bold text-sm lg:text-xl`}>
                {rating > 0 ? rating.toFixed(1) : '-'}
            </div>
            <div>
                <p className="font-semibold text-slate-900 dark:text-white text-xs lg:text-lg leading-tight">
                    {getRatingLabel(rating)}
                </p>
                <p className="text-[10px] lg:text-sm text-slate-500 dark:text-slate-400">
                    {totalCount > 0
                        ? `Based on ${totalCount.toLocaleString()} review${totalCount !== 1 ? 's' : ''}`
                        : 'Aggregated guest score'}
                </p>
            </div>
        </div>
    );
}

function WhoStaysHere({ breakdown }: { breakdown: TravelerBreakdown }) {
    const types = [
        { key: 'family',       label: 'Family',        icon: Users,       value: breakdown.family },
        { key: 'couple',       label: 'Couple',         icon: Heart,       value: breakdown.couple },
        { key: 'friendsGroup', label: 'Friends/Group',  icon: Users2,      value: breakdown.friendsGroup },
        { key: 'solo',         label: 'Solo',           icon: UserCircle,  value: breakdown.solo },
        { key: 'business',     label: 'Business',       icon: Briefcase,   value: breakdown.business },
    ].filter(t => t.value > 0);

    if (types.length === 0) return null;

    return (
        <div className="mb-4 lg:mb-6">
            <h3 className="text-[10px] lg:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 lg:mb-3">Who stays here</h3>
            <div className="flex flex-wrap gap-2.5 lg:gap-4">
                {types.map(({ key, label, icon: Icon, value }) => (
                    <div key={key} className="flex flex-col items-center text-center">
                        <Icon className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-slate-400 mb-0.5" />
                        <span className="text-[8px] lg:text-xs text-slate-600 dark:text-slate-300">{label}</span>
                        <span className="text-[9px] lg:text-xs font-semibold text-slate-800 dark:text-slate-200">{value}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ReviewItem({ review, index }: { review: HotelReview; index: number }) {
    const { toggleExpanded, expandedReviewIds } = useReviewsStore();
    const reviewId = `${review.name}-${index}`;
    const isExpanded = expandedReviewIds.has(reviewId);

    const reviewText = [review.pros, review.cons].filter(Boolean).join(' ');
    const isLongText = reviewText.length > 200;

    return (
        <div className="py-2.5 lg:py-4 border-b border-slate-100 dark:border-slate-700 last:border-b-0">
            <div className="flex items-start justify-between gap-3 lg:gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 lg:gap-2 mb-0.5">
                        <span className="font-semibold text-[11px] lg:text-sm text-slate-900 dark:text-white truncate">
                            {review.name || 'Anonymous'}
                        </span>
                        {review.type && (
                            <span className="text-[9px] lg:text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                • {review.type}
                            </span>
                        )}
                    </div>
                    <p className="text-[9px] lg:text-xs text-slate-400 dark:text-slate-500 mb-1 lg:mb-2">
                        {formatReviewDate(review.date)}
                    </p>

                    {review.headline && (
                        <p className="font-medium text-[11px] lg:text-sm text-slate-800 dark:text-slate-200 mb-0.5 lg:mb-1">
                            {review.headline}
                        </p>
                    )}

                    {reviewText && (
                        <div className="text-[11px] lg:text-sm text-slate-600 dark:text-slate-300">
                            {review.pros && (
                                <p className="mb-0.5 lg:mb-1">
                                    <span className="text-emerald-500">👍</span>{' '}
                                    {isExpanded || !isLongText ? review.pros : review.pros.substring(0, 100) + '...'}
                                </p>
                            )}
                            {review.cons && (isExpanded || review.pros === undefined) && (
                                <p>
                                    <span className="text-amber-500">👎</span> {review.cons}
                                </p>
                            )}
                            {isLongText && (
                                <button
                                    onClick={() => toggleExpanded(reviewId)}
                                    className="text-blue-600 hover:text-blue-700 text-[9px] lg:text-xs font-medium mt-1"
                                >
                                    {isExpanded ? 'Show Less' : 'Show More'}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {Number(review.averageScore) > 0 && (
                    <div className={`${getRatingColor(Number(review.averageScore))} text-white w-6 h-6 lg:w-9 lg:h-9 rounded-full flex items-center justify-center font-bold text-[10px] lg:text-sm shrink-0`}>
                        {Number(review.averageScore).toFixed(0)}
                    </div>
                )}
            </div>
        </div>
    );
}

export function ReviewsSection({ reviews, averageRating, totalCount }: ReviewsSectionProps) {
    const { displayCount, loadMore, sortBy, setSortBy } = useReviewsStore();

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const prevDisplayCountRef = React.useRef(displayCount);
    const prevScrollHeightRef = React.useRef<number>(0);

    const travelerBreakdown = calculateTravelerBreakdown(reviews);

    const sortedReviews = [...reviews].sort((a, b) => {
        if (sortBy === 'highest') return (b.averageScore || 0) - (a.averageScore || 0);
        if (sortBy === 'lowest')  return (a.averageScore || 0) - (b.averageScore || 0);
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const displayedReviews = sortedReviews.slice(0, displayCount);
    const hasMore = displayCount < reviews.length;

    const [isSortOpen, setIsSortOpen] = React.useState(false);

    React.useEffect(() => {
        if (displayCount > prevDisplayCountRef.current) {
            setTimeout(() => {
                if (scrollContainerRef.current && prevScrollHeightRef.current > 0) {
                    scrollContainerRef.current.scrollTo({
                        top: prevScrollHeightRef.current - 60,
                        behavior: 'smooth',
                    });
                }
            }, 100);
        }
        prevDisplayCountRef.current = displayCount;
    }, [displayCount]);

    const handleLoadMore = () => {
        if (scrollContainerRef.current) {
            prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
        }
        loadMore();
    };

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isSortOpen && !(event.target as Element).closest('#sort-dropdown')) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSortOpen]);

    if (totalCount === 0 && averageRating === 0) return null;

    const sortOptions = [
        { value: 'newest',  label: 'Newest first' },
        { value: 'highest', label: 'Highest rated' },
        { value: 'lowest',  label: 'Lowest rated' },
    ] as const;

    const currentSortLabel = sortOptions.find(opt => opt.value === sortBy)?.label ?? 'Newest first';

    return (
        <section id="reviews-section" className="py-4 lg:py-8">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
                {/* Left: summary */}
                <div className="lg:w-64 shrink-0">
                    <h2 className="text-[14px] lg:text-xl font-bold text-slate-900 dark:text-white mb-2 lg:mb-4">Guest reviews</h2>
                    <div className="flex lg:flex-col gap-4 lg:gap-0">
                        <RatingSummary rating={averageRating} totalCount={totalCount} />
                        <WhoStaysHere breakdown={travelerBreakdown} />
                    </div>
                </div>

                {/* Right: list */}
                <div className="flex-1 w-full min-w-0">
                    {/* Sort dropdown */}
                    <div
                        id="sort-dropdown"
                        className={`flex sm:justify-end mb-4 relative z-20 ${reviews.length === 0 ? 'hidden' : ''}`}
                    >
                        <div className="relative w-full sm:w-auto">
                            <button
                                onClick={() => setIsSortOpen(!isSortOpen)}
                                className="w-full text-left sm:w-48 text-[15px] sm:text-sm border border-slate-200 dark:border-slate-600 rounded-lg pl-4 pr-10 py-3 sm:py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm flex items-center justify-between"
                            >
                                <span>{currentSortLabel}</span>
                                <svg
                                    className={`w-4 h-4 text-slate-400 transition-transform ${isSortOpen ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isSortOpen && (
                                <div className="absolute top-full left-0 right-0 sm:left-auto sm:right-0 mt-1 w-full sm:w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden z-30">
                                    {sortOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setSortBy(opt.value); setIsSortOpen(false); }}
                                            className={`w-full text-left px-4 py-3 sm:py-2.5 text-[15px] sm:text-sm transition-colors ${
                                                sortBy === opt.value
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Reviews list */}
                    <div
                        ref={scrollContainerRef}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-[400px] md:max-h-[500px] overflow-y-auto shadow-sm relative z-10"
                    >
                        <div className="px-3 md:px-5">
                            {displayedReviews.length > 0 ? (
                                displayedReviews.map((review, index) => (
                                    <ReviewItem key={`${review.name}-${index}`} review={review} index={index} />
                                ))
                            ) : (
                                <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                                    <p className="text-sm">No individual reviews available.</p>
                                    <p className="text-xs mt-1">Guest score is based on aggregated ratings.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Load more */}
                    <div className={`mt-4 md:mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 ${reviews.length === 0 ? 'hidden' : ''}`}>
                        {hasMore && (
                            <button
                                onClick={handleLoadMore}
                                className="w-auto px-4 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm active:scale-95"
                            >
                                Load more reviews
                            </button>
                        )}
                        <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center w-full sm:w-auto mt-1 sm:mt-0">
                            Showing {displayedReviews.length} of {reviews.length} reviews
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}

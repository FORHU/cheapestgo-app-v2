import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/shared/lib/format';
import type { GolfCourse } from '@/features/golf/types';

/**
 * One course in the `/golf` grid, in the materials of the results and bookings cards: a rounded
 * plate on the card surface that lifts on hover. The from-fee shows only when the course has one.
 */
export function GolfCourseCard({ course }: { course: GolfCourse }) {
    const t = useTranslations('golf');
    const cover = course.imageUrls[0];

    return (
        <Link
            href={`/golf/${course.slug}`}
            className="group block overflow-hidden rounded-2xl bg-white transition-shadow duration-150 hover:shadow-lg dark:bg-slate-900 dark:hover:shadow-black/40"
        >
            {/* A step darker than the flat ground, so a card with no photo still shows its top. */}
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-200/70 dark:bg-white/5">
                {cover ? (
                    // Admin-pasted URLs come from any host, which next/image would refuse.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : (
                    <div className="flex h-full items-center justify-center text-slate-300 dark:text-white/20">
                        <Flag size={28} strokeWidth={1.5} aria-hidden />
                    </div>
                )}
            </div>
            <div className="space-y-1 p-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{course.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{course.city} · {course.country}</p>
                <div className="flex items-center justify-between gap-3 pt-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        {t('holes', { holes: course.holes })}
                    </span>
                    {course.greenFeeFrom != null && (
                        <span className="font-semibold text-slate-900 dark:text-slate-50">
                            {t('greenFeesFrom', { price: formatCurrency(course.greenFeeFrom, course.currency) })}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}

import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/shared/lib/format';
import type { GolfCourse } from '@/features/golf/types';

/** One course in the `/golf` grid. The from-fee shows only when the course has one. */
export function GolfCourseCard({ course }: { course: GolfCourse }) {
    const t = useTranslations('golf');
    const cover = course.imageUrls[0];

    return (
        <Link
            href={`/golf/${course.slug}`}
            className="group block overflow-hidden border border-slate-200 bg-white transition-colors hover:border-slate-400 dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/30"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-white/5">
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
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{course.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{course.city} · {course.country}</p>
                <div className="flex items-center justify-between gap-3 pt-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{t('holes', { holes: course.holes })}</span>
                    {course.greenFeeFrom != null && (
                        <span className="font-semibold text-slate-900 dark:text-white">
                            {t('greenFeesFrom', { price: formatCurrency(course.greenFeeFrom, course.currency) })}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}

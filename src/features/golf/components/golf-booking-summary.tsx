import { Flag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { money, teeTimeLabels } from '@/features/golf/lib/format';
import type { GolfExtraLine } from '@/features/golf/types';

/**
 * The tee time and what it costs, as a card: on the checkout beside the payment, and on the booking's
 * own page. Green fee, each extra, service fee and total are separate lines and always api-v2's figures,
 * so what is shown is exactly what the card is asked for.
 */
export function GolfBookingSummary({ course, startsAt, timezone, players, currency, greenFee, extras, serviceFee, total }: {
    course:     { name: string; city: string; country: string; imageUrl: string | null };
    startsAt:   string;
    timezone:   string | null;
    players:    number;
    currency:   string;
    greenFee:   number;
    extras:     GolfExtraLine[];
    serviceFee: number;
    total:      number;
}) {
    const t = useTranslations('golf.booking');
    const locale = useLocale();
    const { date, time } = teeTimeLabels(startsAt, timezone, locale);

    return (
        <aside className="h-fit overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-900">
            <div className="aspect-[16/9] bg-slate-200/70 dark:bg-white/5">
                {course.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin URLs come from any host
                    <img src={course.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center text-slate-300 dark:text-white/20">
                        <Flag size={28} strokeWidth={1.5} aria-hidden />
                    </div>
                )}
            </div>
            <div className="space-y-4 p-5">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{course.name}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{course.city} · {course.country}</p>
                </div>
                <dl className="space-y-1.5 text-sm">
                    <Row label={t('date')} value={date} />
                    <Row label={t('time')} value={time} />
                    <Row label={t('players')} value={String(players)} />
                </dl>
                <dl className="space-y-1.5 border-t border-slate-100 pt-4 text-sm dark:border-white/10">
                    <Row label={t('greenFee')} value={money(greenFee, currency, locale)} />
                    {extras.map((e) => (
                        <Row key={e.code} label={t('extraLine', { name: t(`extraNames.${e.code}`), count: e.quantity })} value={money(e.total, currency, locale)} />
                    ))}
                    <Row label={t('serviceFee')} value={money(serviceFee, currency, locale)} />
                    <div className="flex items-baseline justify-between gap-4 pt-1.5">
                        <dt className="font-semibold text-slate-900 dark:text-slate-50">{t('total')}</dt>
                        <dd className="text-xl font-bold text-slate-900 dark:text-slate-50">{money(total, currency, locale)}</dd>
                    </div>
                </dl>
            </div>
        </aside>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="text-right font-medium text-slate-800 dark:text-slate-100">{value}</dd>
        </div>
    );
}

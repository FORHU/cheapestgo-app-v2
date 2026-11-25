import { Flag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { money, teeTimeLabels } from '@/features/golf/lib/format';
import type { GolfServiceDetail, GolfServiceInvoiceLine } from '@/features/golf/lib/golf-services-pricing';
import type { GolfExtraLine } from '@/features/golf/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "2 × $15.00" / "2 sessions" / "15 guests" / nothing — the component layer's job since it needs translations. */
function formatServiceDetail(detail: GolfServiceDetail, ts: (key: string, values?: Record<string, number>) => string, locale: string): string | null {
    switch (detail.kind) {
        case 'product':   return `${detail.quantity} × ${money(detail.unitPrice, detail.currency, locale)}`;
        case 'unitCount': return ts(`unitLabel.${detail.unitNoun}`, { count: detail.quantity });
        case 'guests':    return ts('unitLabel.guest', { count: detail.partySize });
        case 'familyMembers': return `${ts('unitLabel.adult', { count: detail.adults })}, ${ts('unitLabel.junior', { count: detail.juniors })}`;
        case 'none':      return null;
    }
}

/**
 * The tee time and what it costs, as a card: on the checkout beside the payment, and on the booking's
 * own page. Green fee, each extra, service fee and total are separate lines and always api-v2's figures,
 * so what is shown is exactly what the card is asked for.
 *
 * `services`/`servicesCurrency` are optional and entirely additive: api-v2's separate Golf
 * Services mock catalog, one invoice row per confirmed service by its real catalog name — folded
 * into one combined "Final total" only when its currency matches this tee time's own (both are
 * simulated figures otherwise — see GolfBookView). `total` itself is never changed by them: it
 * stays exactly the real, Stripe-authorised figure.
 */
export function GolfBookingSummary({ course, startsAt, timezone, players, currency, greenFee, extras, serviceFee, total, services = [], servicesCurrency }: {
    course:             { name: string; city: string; country: string; imageUrl: string | null };
    startsAt:           string;
    timezone:           string | null;
    players:            number;
    currency:           string;
    greenFee:           number;
    extras:             GolfExtraLine[];
    serviceFee:         number;
    total:              number;
    services?:          GolfServiceInvoiceLine[];
    servicesCurrency?:  string;
}) {
    const t = useTranslations('golf.booking');
    const ts = useTranslations('golf.booking.services');
    const locale = useLocale();
    const { date, time } = teeTimeLabels(startsAt, timezone, locale);

    const hasServices = services.length > 0;
    const servicesTotal = round2(services.reduce((sum, l) => sum + (l.amount ?? 0), 0));
    const canCombine = hasServices && servicesCurrency === currency;
    const grandTotal = canCombine ? round2(total + servicesTotal) : total;

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
                    {hasServices && (
                        <>
                            <p className="pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{ts('heading')}</p>
                            {services.map((line) => {
                                const detail = formatServiceDetail(line.detail, ts, locale);
                                return (
                                    <Row
                                        key={line.key}
                                        label={detail ? `${line.name} (${detail})` : line.name}
                                        value={line.amount != null ? money(line.amount, servicesCurrency ?? 'USD', locale) : ts('quotePending')}
                                    />
                                );
                            })}
                        </>
                    )}
                    <Row label={t('serviceFee')} value={money(serviceFee, currency, locale)} />
                    {/* The amount this hold's own payment button actually charges — `total`, never
                     *  `grandTotal` — so this figure and that button can never disagree. Labelled
                     *  "Total" when there is nothing else to pay for, "Pay now" once there is, so a
                     *  combined estimate below it is never mistaken for what the card is charged. */}
                    <div className="flex items-baseline justify-between gap-4 pt-1.5">
                        <dt className="font-semibold text-slate-900 dark:text-slate-50">{hasServices ? t('payNow') : t('total')}</dt>
                        <dd className="text-xl font-bold text-slate-900 dark:text-slate-50">{money(total, currency, locale)}</dd>
                    </div>
                    {/* Additive only, never sent to Stripe: the tee time's own charge plus the
                     *  selected Golf Services' simulated prices, for reference — shown only when
                     *  they share a currency to add in (see `canCombine`/GolfBookingSummary doc)
                     *  and only when that adds up to something other than "Pay now" already shows
                     *  (every selected service still quote-pending contributes nothing to add). */}
                    {canCombine && grandTotal !== total && (
                        <div className="flex items-baseline justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                            <dt>{t('estimatedBookingTotal')}</dt>
                            <dd>{money(grandTotal, currency, locale)}</dd>
                        </div>
                    )}
                </dl>
                {hasServices && (
                    <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                        {canCombine ? ts('summaryCaption') : ts('summaryCaptionDifferentCurrency')}
                    </p>
                )}
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

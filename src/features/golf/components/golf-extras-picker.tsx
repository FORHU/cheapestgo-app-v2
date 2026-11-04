import { Minus, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { money } from '@/features/golf/lib/format';
import type { GolfExtraCode, GolfExtraOffer } from '@/features/golf/types';

const STEP = 'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors enabled:hover:border-blue-500 enabled:hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-slate-300';

/**
 * What the course offers to add to a tee time: a caddie, a cart, club rental. Up to one of each per
 * player. Prices are api-v2's, per item, in the currency the checkout is in.
 */
export function GolfExtrasPicker({ offers, currency, players, quantityOf, onChange }: {
    offers:     GolfExtraOffer[];
    currency:   string;
    players:    number;
    quantityOf: (code: GolfExtraCode) => number;
    onChange:   (code: GolfExtraCode, quantity: number) => void;
}) {
    const t = useTranslations('golf.booking');
    const locale = useLocale();

    return (
        <section aria-labelledby="golf-extras-title" className="rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900">
            <h2 id="golf-extras-title" className="text-base font-bold text-slate-900 dark:text-slate-50">{t('extrasHeading')}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('extrasHint')}</p>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                {offers.map(({ code, price }) => {
                    const name = t(`extraNames.${code}`);
                    const quantity = quantityOf(code);
                    return (
                        <li key={code} className="flex items-center justify-between gap-4 py-3 last:pb-0">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t('extraEach', { price: money(price, currency, locale) })}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-label={t('extraRemove', { name })}
                                    disabled={quantity <= 0}
                                    onClick={() => onChange(code, quantity - 1)}
                                    className={STEP}
                                >
                                    <Minus size={15} aria-hidden />
                                </button>
                                <span aria-live="polite" className="w-6 text-center text-sm font-semibold text-slate-900 dark:text-slate-50">{quantity}</span>
                                <button
                                    type="button"
                                    aria-label={t('extraAdd', { name })}
                                    disabled={quantity >= players}
                                    onClick={() => onChange(code, quantity + 1)}
                                    className={STEP}
                                >
                                    <Plus size={15} aria-hidden />
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

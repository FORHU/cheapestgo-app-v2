import { useTranslations } from 'next-intl';

/** Only the numerals are fixed; the words for each step come from the locale file. */
const STEPS = ['search', 'compare', 'book'] as const;

export function HowItWorksSection() {
    const t = useTranslations('landing.howItWorks');
    return (
        <section className="w-full py-10 md:py-16 px-4 sm:px-6 bg-slate-50 dark:bg-slate-900/50">
            <div className="max-w-[1400px] mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                    {t('title')}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-10 text-center max-w-xl mx-auto">
                    {t('subtitle')}
                </p>

                <ol className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    {STEPS.map((step, i) => (
                        <li key={step} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                            <span className="text-4xl font-extrabold text-blue-500 dark:text-blue-400 mb-3 leading-none">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                {t(`steps.${step}.title`)}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                {t(`steps.${step}.description`)}
                            </p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

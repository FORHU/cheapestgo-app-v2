import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { hreflangAlternates } from '@/shared/lib/seo';
import {
    PlaneTakeoff,
    BedDouble,
    Package,
    BadgePercent,
    ShieldCheck,
    Globe2,
    ArrowRight,
    Mail,
} from 'lucide-react';

// Not a static `metadata` object: that cannot await the request's locale, so it gave all
// four languages the English canonical, title and description — and a search result shows
// only the title and description. Through the translations, "CheapestGo" also becomes the
// serving brand's name on AirangGo, which the hardcoded strings never did.
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('about.meta');
    return {
        title: t('title'),
        description: t('description'),
        alternates: await hreflangAlternates('/about'),
    };
}

const partners = ['Duffel', 'TravelgateX', 'Stripe'];

export default async function AboutUsPage() {
    const t = await getTranslations('about');

    const whatWeDo = [
        { icon: PlaneTakeoff, title: t('flightsTitle'), body: t('flightsBody') },
        { icon: BedDouble, title: t('hotelsTitle'), body: t('hotelsBody') },
        { icon: Package, title: t('dealsTitle'), body: t('dealsBody') },
    ];

    const values = [
        { icon: BadgePercent, title: t('transparentTitle'), body: t('transparentBody') },
        { icon: ShieldCheck, title: t('secureTitle'), body: t('secureBody') },
        { icon: Globe2, title: t('builtTitle'), body: t('builtBody') },
    ];

    return (
        <main className="min-h-screen">
            {/* Hero band */}
            <section className="bg-obsidian dark:bg-obsidian border-b border-white/5 px-4 py-16 sm:py-24">
                <div className="max-w-3xl mx-auto text-center">
                    <p className="text-xs font-semibold uppercase tracking-widest text-obsidian-accent mb-4 font-display">
                        {t('heroLabel')}
                    </p>
                    <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display mb-5">
                        {t('heroTitle')}
                    </h1>
                    <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
                        {t('heroBody')}
                    </p>
                </div>
            </section>

            <div className="max-w-4xl mx-auto px-4 py-14 sm:py-20 space-y-20">
                {/* Mission */}
                <section>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-display mb-4">
                        {t('missionTitle')}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base sm:text-lg">
                        {t('missionBody')}
                    </p>
                </section>

                {/* What we do */}
                <section>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-display mb-8">
                        {t('whatWeDoTitle')}
                    </h2>
                    <div className="grid gap-5 sm:grid-cols-3">
                        {whatWeDo.map(({ icon: Icon, title, body }) => (
                            <div
                                key={title}
                                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6"
                            >
                                <div className="size-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-4">
                                    <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                                    {title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {body}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Values */}
                <section>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-display mb-8">
                        {t('valuesTitle')}
                    </h2>
                    <div className="space-y-4">
                        {values.map(({ icon: Icon, title, body }) => (
                            <div
                                key={title}
                                className="flex gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6"
                            >
                                <div className="size-11 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                    <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                                        {title}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {body}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Partners */}
                <section>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-display mb-3">
                        {t('partnersTitle')}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                        {t('partnersBody')}
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                        {partners.map((p) => (
                            <span
                                key={p}
                                className="px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                                {p}
                            </span>
                        ))}
                    </div>
                </section>

                {/* Company + CTA */}
                <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-6 sm:p-8">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display mb-4">
                        {t('whoTitle')}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                        {t('whoBody')}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <a
                            href="mailto:support@cheapestgo.com"
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                        >
                            <Mail className="h-4 w-4" />
                            {t('contactUs')}
                        </a>
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-white dark:hover:bg-white/5 transition-colors"
                        >
                            {t('startExploring')}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                        <Link href="/terms-of-service" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('terms')}</Link>
                        <Link href="/privacy-policy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('privacy')}</Link>
                        <Link href="/refund-policy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('refund')}</Link>
                    </div>
                </section>
            </div>
        </main>
    );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { hreflangAlternates } from '@/shared/lib/seo';
import { QUICK_QUESTIONS } from '@/features/support/lib/suggestions';

/**
 * The Help Centre.
 *
 * The same five articles the widget answers with (ADR-0044), on a page of their own — so they
 * can be linked to, found by a search engine, and read by someone who is not signed in. The
 * widget cannot serve that last case at all: a Support Chat needs an account (ADR-0032), and a
 * visitor deciding whether to book should still be able to read how refunds work.
 *
 * Async so the canonical names the URL this is actually served at, and so the text is read in
 * the language being served.
 */
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('help');
    return {
        title:       t('title'),
        description: t('description'),
        alternates:  await hreflangAlternates('/help'),
    };
}

export default async function HelpPage() {
    const t     = await getTranslations('help');
    const about = await getTranslations('help.sections');

    return (
        <main className="mx-auto max-w-3xl px-4 py-12">
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{t('pageTitle')}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">{t('pageSubtitle')}</p>

            {/* One order, shared with the widget: the questions people ask most, most-asked first. */}
            <div className="mt-10 space-y-8">
                {QUICK_QUESTIONS.map(id => (
                    <article key={id} id={id} className="scroll-mt-24">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white">{about(`${id}.title`)}</h2>
                        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
                            {about(`${id}.body`)}
                        </p>
                    </article>
                ))}
            </div>

            <section className="mt-12 rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                <h2 className="text-base font-medium text-slate-900 dark:text-white">{t('chatCta')}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('chatNote')}</p>
            </section>
        </main>
    );
}

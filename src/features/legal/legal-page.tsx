import React from 'react';
import { getTranslations } from 'next-intl/server';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { legalSections, type LegalDocument } from './legal-sections';

/**
 * The shell all four legal pages share.
 *
 * They had the same markup copied four times with different English inside. One copy now, with
 * the words coming from the messages — so the Korean, Japanese and Chinese versions exist
 * without four more copies, and a change to the layout lands on all four.
 */

export const LEGAL_EFFECTIVE_DATE = 'May 1, 2025';
export const LEGAL_LAST_UPDATED   = 'April 1, 2025';

export async function LegalPage({ doc, titleKey }: { doc: LegalDocument; titleKey: string }) {
    const t     = await getTranslations('legal');
    const tMeta = await getTranslations(`legal.${titleKey}`);

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-12">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{tMeta('pageTitle')}</h1>
                        <p className="text-slate-500 dark:text-slate-400">{tMeta('pageSubtitle')}</p>
                        <div className="flex gap-4 mt-3 text-xs text-slate-400 dark:text-slate-500">
                            <span>{t('layout.effective')} {LEGAL_EFFECTIVE_DATE}</span>
                            <span>{t('layout.lastUpdated')} {LEGAL_LAST_UPDATED}</span>
                        </div>
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-700 dark:text-slate-300">
                        {legalSections(t as never, doc).map((section, i) => (
                            <section key={i}>
                                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">{section.title}</h2>
                                {section.content}
                            </section>
                        ))}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

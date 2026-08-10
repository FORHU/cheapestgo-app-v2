'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';

/**
 * Questions come from the `seo.faq` translations — the same source as the
 * FAQPage JSON-LD on the landing page, so the structured data always describes
 * something a visitor can actually read.
 */
const KEYS = ['1', '2', '3', '4'] as const;

export function FaqSection() {
    const t = useTranslations('seo.faq');
    const [open, setOpen] = useState<number>(-1);

    return (
        <section id="faq" className="max-w-[1240px] mx-auto px-6 pt-[clamp(64px,8vw,104px)] w-full">
            <h2 className="font-display font-semibold tracking-[-0.03em] leading-tight text-[clamp(22px,2.6vw,28px)] text-slate-900 dark:text-white mb-6">
                Before you book
            </h2>

            <div className="max-w-[980px] border-t border-slate-200/70 dark:border-white/10">
                {KEYS.map((key, i) => {
                    const isOpen = open === i;
                    return (
                        <div key={key} className="border-b border-slate-200/70 dark:border-white/10">
                            <button
                                type="button"
                                aria-expanded={isOpen}
                                onClick={() => setOpen(isOpen ? -1 : i)}
                                className="w-full flex items-start justify-between gap-6 py-5 text-left group"
                            >
                                <span className="text-[15px] font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {t(`q${key}`)}
                                </span>
                                <ChevronDown
                                    size={18}
                                    className={cn(
                                        'shrink-0 mt-0.5 text-slate-400 transition-transform duration-200',
                                        isOpen && 'rotate-180'
                                    )}
                                />
                            </button>
                            {isOpen && (
                                <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-400 pb-5 pr-10 max-w-none">
                                    {t(`a${key}`)}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

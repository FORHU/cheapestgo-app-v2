'use client';

import { useTranslations } from 'next-intl';
import React, { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { SECTION_HEADING } from '@/shared/lib/layout';
import { formatStayTime } from '@/features/hotels/components/property-description';

// ─── Which questions ──────────────────────────────────────────────────────────

/** Each entry's wording is `property.faq.<key>Question` and `<key>Answer`. */
type FaqKey =
    | 'checkIn' | 'checkOut' | 'parking' | 'wifi' | 'pool' | 'restaurant' | 'important'
    | 'fallbackCancellation' | 'fallbackPayment' | 'fallbackModification';

export interface FaqEntry {
    key: FaqKey;
    /** Placed into the answer's wording. */
    values?: Record<string, string>;
    /** The supplier's own text, shown as the answer in place of a message. */
    verbatim?: string;
}

const PARKING    = /parking|car park|garage|valet/i;
const WIFI       = /wi-?fi|internet/i;
const POOL       = /pool|swimming/i;
const RESTAURANT = /restaurant|dining/i;

/**
 * The questions this property can actually answer, in v1's order: its hours, then what it has,
 * then what it asks you to know. Built from the property's own data, so every answer is a fact
 * about this hotel — a question is asked only when there is something to say.
 *
 * A hotel the supplier told us nothing about still gets the three questions every booking raises
 * (cancellation, payment, changing it), answered in general terms; with anything specific to say,
 * those are left off rather than padding the list.
 *
 * The amenity questions name the facility as the hotel words it — "Free private parking" rather
 * than "parking" — since that word carries the free/paid and on-site detail the guest is asking.
 */
export function propertyFaqs({ checkInTime, checkOutTime, facilities, importantInfo }: {
    checkInTime?: string | null;
    checkOutTime?: string | null;
    facilities: string[];
    importantInfo?: string | null;
}): FaqEntry[] {
    const faqs: FaqEntry[] = [];
    const checkIn  = formatStayTime(checkInTime);
    const checkOut = formatStayTime(checkOutTime);
    if (checkIn)  faqs.push({ key: 'checkIn',  values: { time: checkIn } });
    if (checkOut) faqs.push({ key: 'checkOut', values: { time: checkOut } });

    const find = (pattern: RegExp) => facilities.find(f => pattern.test(f));
    const parking = find(PARKING);
    if (parking) faqs.push({ key: 'parking', values: { facility: parking.toLowerCase() } });
    if (find(WIFI)) faqs.push({ key: 'wifi' });
    const pool = find(POOL);
    if (pool) faqs.push({ key: 'pool', values: { facility: pool.toLowerCase() } });
    if (find(RESTAURANT)) faqs.push({ key: 'restaurant' });

    const important = importantInfo?.trim();
    if (important) faqs.push({ key: 'important', verbatim: important });

    if (faqs.length === 0) {
        faqs.push({ key: 'fallbackCancellation' }, { key: 'fallbackPayment' }, { key: 'fallbackModification' });
    }
    return faqs;
}

// ─── Section ──────────────────────────────────────────────────────────────────

/** Painted by theme, as the description and room sections beside it are — no plate. */
function faqPalette(tone: 'light' | 'dark') {
    const dark = tone === 'dark';
    return {
        question: dark ? 'text-white' : 'text-slate-900',
        answer:   dark ? 'text-white/65' : 'text-slate-600',
        rule:     dark ? 'border-white/10' : 'border-slate-200',
        /** The chevron's round plate, which fills with the brand gradient while open. */
        chevron:  dark ? 'bg-white/[0.07] text-white/70' : 'bg-slate-100 text-slate-500',
        chevronOpen: 'bg-linear-to-r from-blue-600 to-cyan-500 text-white',
        hover:    dark ? 'hover:text-sky-300' : 'hover:text-blue-600',
    };
}

/**
 * v1's FAQ, drawn in v2's language: a section heading straight on the page ground, then a column
 * of questions between hairlines. Each opens in place, its chevron turning and filling with the
 * brand gradient, the same "this one is on" the room filters use.
 *
 * Every question is a button with `aria-expanded` over a region it labels, so a screen reader
 * hears the question, whether it is open, and then the answer under it.
 */
export function PropertyFaq({
    tone, propertyName, checkInTime, checkOutTime, facilities, importantInfo, className,
}: {
    tone: 'light' | 'dark';
    propertyName: string;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    facilities: string[];
    importantInfo?: string | null;
    className?: string;
}) {
    const t = useTranslations('property.faq');
    const palette = faqPalette(tone);
    const faqs = propertyFaqs({ checkInTime, checkOutTime, facilities, importantInfo });
    const name = propertyName;

    return (
        <section id="faqs" aria-labelledby="faqs-heading" className={className}>
            <h2 id="faqs-heading" className={cn(SECTION_HEADING, 'mb-4 sm:mb-6', palette.question)}>{t('title')}</h2>
            <div className={cn('max-w-4xl border-t', palette.rule)}>
                {faqs.map(faq => (
                    <FaqItem
                        key={faq.key}
                        palette={palette}
                        question={t(`${faq.key}Question`, { name, ...faq.values })}
                        answer={faq.verbatim ?? t(`${faq.key}Answer`, { name, ...faq.values })}
                    />
                ))}
            </div>
        </section>
    );
}

function FaqItem({ question, answer, palette }: {
    question: string;
    answer: string;
    palette: ReturnType<typeof faqPalette>;
}) {
    const [open, setOpen] = useState(false);
    const reduce = useReducedMotion();
    const id = useId();
    const buttonId = `${id}-q`;
    const panelId = `${id}-a`;

    return (
        <div className={cn('border-b', palette.rule)}>
            <h3>
                <button
                    id={buttonId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpen(o => !o)}
                    className={cn(
                        'flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-[17px] font-semibold transition-colors sm:py-5 sm:text-[19px]',
                        palette.question, palette.hover,
                    )}
                >
                    <span>{question}</span>
                    <span
                        aria-hidden
                        className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-full transition-[transform,background-color,color] duration-200',
                            open ? cn(palette.chevronOpen, 'rotate-180') : palette.chevron,
                        )}
                    >
                        <ChevronDown size={18} strokeWidth={2.25} />
                    </span>
                </button>
            </h3>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: reduce ? 0 : 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                        className="overflow-hidden"
                    >
                        <p className={cn('max-w-3xl pr-12 pb-5 text-[15px] leading-relaxed whitespace-pre-line sm:text-[16px]', palette.answer)}>
                            {answer}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format';
import { convertForDisplay } from '@/shared/lib/currency';
import { useLiveRates } from '@/shared/lib/use-live-rates';
import { useUserCurrency } from '@/shared/stores/search.store';

// ─── Palette ──────────────────────────────────────────────────────────────────

/**
 * The results cards' materials (`flight-card.tsx`, `hotel-card.tsx`), so a booking
 * looks like the fare or the stay it was bought from. One copy for both trip cards:
 * a hotel and a flight sit in the same list, and two copies of a palette drift.
 */
export const SURFACE  = 'bg-white dark:bg-slate-900';
export const TITLE    = 'text-slate-900 dark:text-slate-50';
export const TEXT     = 'text-slate-700 dark:text-slate-100';
export const MUTED    = 'text-slate-500 dark:text-slate-400';
export const HAIRLINE = 'border-slate-200 dark:border-white/10';
/** The card's one primary action — and a selected tab — in the brand gradient, as Select Now has it. */
export const CHIP     = 'bg-linear-to-r from-blue-600 to-cyan-500 text-white';
/** A second action beside it: the flight card's unselected fare-option button. */
export const SOFT     = 'bg-slate-100 dark:bg-white/8';

/** Both actions take the flight card's Select Now measure. */
export const ACTION =
    'inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-full px-6 text-[15px] font-medium whitespace-nowrap transition-opacity hover:opacity-85';

// ─── Paid, in the currency picked ─────────────────────────────────────────────

export interface PaidEstimate {
    /** "≈ ₩189,000" */
    amount: string;
    /** "Approx. in KRW", for a screen reader — the "≈" alone says nothing. */
    label: string;
}

/**
 * What a booking cost, in the currency picked in the header — the confirmation screen's rule
 * (`flight-confirmed-screen.tsx`). The amount charged is a fact and does not move with the
 * selector; this is a second line under it, at today's rate. Null until the rates are live,
 * and when the currency picked is the one it was paid in.
 */
export function usePaidEstimate(amount: number, currency: string): PaidEstimate | null {
    const tAll = useTranslations();
    const userCurrency = useUserCurrency();
    useLiveRates();
    const paid = (currency || 'USD').toUpperCase();
    // `Number`: a Decimal column can arrive as a string.
    const approx = convertForDisplay(Number(amount), paid, userCurrency);
    if (approx.currency === paid) return null;
    return {
        amount: `≈ ${formatCurrency(approx.amount, approx.currency)}`,
        label: tAll('checkout.flight.receipt.approxTotal', { currency: approx.currency }),
    };
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function BookingStatusBadge({ label, color }: { label: string; color: string }) {
    return (
        <span className={cn('inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[12px] font-semibold whitespace-nowrap', color)}>
            {label}
        </span>
    );
}

// ─── Span ─────────────────────────────────────────────────────────────────────

interface SpanEnd {
    value: string;
    label: string;
}

/**
 * The card's middle line: two ends and what lies between them — a departure and an
 * arrival, or a check-in and a check-out. The flight card's times row, measure for
 * measure, so a stay and a flight read with the same rhythm.
 *
 * `above` and `below` keep their line even when empty, or the two ends would sit
 * off-centre against the rule.
 */
export function BookingSpan({ from, to, above, below, line }: {
    from: SpanEnd;
    to: SpanEnd;
    above?: string;
    below?: string;
    line: React.ReactNode;
}) {
    const value = cn('text-2xl leading-none font-semibold tracking-[-0.01em] whitespace-nowrap md:text-[30px]', TITLE);
    const label = cn('mt-1.5 text-[14px] tracking-[0.04em]', MUTED);

    return (
        <div className="mt-[18px] flex items-center gap-4 md:gap-5">
            <div>
                <div className={value}>{from.value}</div>
                <div className={label}>{from.label}</div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className={cn('text-[13px] whitespace-nowrap', TEXT)}>{above || ' '}</span>
                {line}
                <span className={cn('text-[13px] whitespace-nowrap', MUTED)}>{below || ' '}</span>
            </div>
            <div className="text-right">
                <div className={value}>{to.value}</div>
                <div className={label}>{to.label}</div>
            </div>
        </div>
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * The frame both trip cards are drawn in: the flight card's three columns — a plate,
 * the details, and the price column behind a hairline.
 *
 * Where the flight card's price column carries its bookmark, this one carries the
 * booking's status. On a phone the price column is a row with no room for it, so the
 * status leads the details instead.
 */
export function BookingCardShell({
    index = 0, plate, status, price, priceLabel, estimate, actions, expansion, children,
}: {
    index?: number;
    /** The left column: the airline's disc, or the stay's photo. */
    plate: React.ReactNode;
    status: React.ReactNode;
    price: string;
    priceLabel: string;
    /** The price in the currency picked, under the one paid — see `usePaidEstimate`. */
    estimate?: PaidEstimate | null;
    actions: React.ReactNode;
    /**
     * Opened under the whole card, across the plate as well — the flight card's segments
     * view, which needs the width more than the plate needs its column. Null when closed.
     */
    expansion?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.25 }}
            className={cn(
                'group relative w-full overflow-hidden rounded-2xl transition-shadow duration-150 hover:shadow-lg dark:hover:shadow-black/40',
                SURFACE,
            )}
        >
            <div className="flex flex-col md:min-h-[205px] md:flex-row">
                <div className="relative shrink-0 md:w-[240px]">{plate}</div>

                <div className="flex min-w-0 flex-1 flex-col px-5 py-5 md:pt-7 md:pr-8 md:pb-6 md:pl-9">
                    <div className="mb-3 md:hidden">{status}</div>
                    {children}
                </div>

                <div className={cn(
                    'flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-4',
                    'md:w-[230px] md:flex-col md:flex-nowrap md:items-stretch md:border-t-0 md:border-l md:p-6',
                    HAIRLINE,
                )}>
                    <div className="hidden justify-end md:flex">{status}</div>
                    <div>
                        <p className={cn('text-[22px] font-bold whitespace-nowrap md:text-[26px]', TITLE)}>{price}</p>
                        <p className={cn('mt-1 text-[13px]', MUTED)}>{priceLabel}</p>
                        {estimate && (
                            <p className={cn('mt-0.5 text-[13px] whitespace-nowrap', MUTED)}>
                                <span className="sr-only">{estimate.label}: </span>{estimate.amount}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:flex-col md:flex-nowrap md:items-stretch">
                        {actions}
                    </div>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {expansion && (
                    <motion.div
                        key="expansion"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className={cn('overflow-hidden border-t', HAIRLINE)}
                    >
                        {expansion}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

/** The frame above, empty — so the list keeps its shape while it loads. */
export function BookingCardSkeleton() {
    const bar = 'rounded bg-slate-200 dark:bg-white/10';
    return (
        <div className={cn('flex animate-pulse flex-col overflow-hidden rounded-2xl md:min-h-[205px] md:flex-row', SURFACE)}>
            <div className="flex h-20 shrink-0 items-center justify-center md:h-auto md:w-[240px]">
                <div className="size-14 rounded-full bg-slate-200 md:size-[120px] dark:bg-white/10" />
            </div>
            <div className="flex flex-1 flex-col gap-3 px-5 py-5 md:pt-7 md:pr-8 md:pl-9">
                <div className={cn('h-5 w-2/5', bar)} />
                <div className={cn('h-3.5 w-1/4', bar)} />
                <div className={cn('mt-3 h-9 w-full', bar)} />
                <div className={cn('h-3.5 w-1/3', bar)} />
            </div>
            <div className={cn(
                'flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4',
                'md:w-[230px] md:flex-col md:items-stretch md:justify-center md:border-t-0 md:border-l md:p-6',
                HAIRLINE,
            )}>
                <div className={cn('h-7 w-24', bar)} />
                <div className="h-[42px] w-28 rounded-full bg-slate-200 md:w-full dark:bg-white/10" />
            </div>
        </div>
    );
}

// ─── Detail panels ────────────────────────────────────────────────────────────

/**
 * A section of a booking's own page — passengers, payment, documents — drawn as the
 * results sidebar's panel (`flight-filters.tsx`): the same plate, radius and heading, so
 * the booking page reads as the results page's other half. The title is a real heading;
 * the icon beside it is decoration.
 */
export function DetailPanel({ title, icon: Icon, children, className }: {
    title: string;
    icon: LucideIcon;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('rounded-[20px] bg-white shadow-sm dark:bg-slate-900', className)}>
            <div className="flex items-center gap-2.5 px-6 pt-6">
                <Icon size={17} strokeWidth={1.75} className="shrink-0 text-slate-700 dark:text-white" aria-hidden />
                <h2 className="text-[17px] text-slate-900 dark:text-white">{title}</h2>
            </div>
            <div className="px-6 pt-3 pb-5">{children}</div>
        </section>
    );
}

/** One fact in a panel: its name, and the value flush right, split from the next by a hairline. */
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className={cn('flex items-start justify-between gap-4 border-b py-3 last:border-0', HAIRLINE)}>
            <span className={cn('shrink-0 text-[14px]', MUTED)}>{label}</span>
            <span className={cn('text-right text-[14px] font-medium', TEXT)}>{value}</span>
        </div>
    );
}

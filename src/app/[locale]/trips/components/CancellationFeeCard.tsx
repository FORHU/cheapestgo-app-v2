'use client';

import React from 'react';
import { formatCurrency } from '@/shared/lib/format';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface CancellationFeeCardProps {
    originalAmount: number;
    penaltyAmount: number;
    refundAmount: number;
    currency: string;
}

export function CancellationFeeCard({
    originalAmount,
    penaltyAmount,
    refundAmount,
    currency,
}: CancellationFeeCardProps) {
    const isFullRefund = penaltyAmount === 0 && refundAmount > 0;
    const isNonRefundable = refundAmount === 0;

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Refund Summary
                </h4>
                {isFullRefund && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <ShieldCheck size={12} />
                        Full Refund
                    </span>
                )}
                {isNonRefundable && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                        <AlertCircle size={12} />
                        Non-Refundable
                    </span>
                )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
                {/* Original Amount */}
                <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">
                        Paid
                    </span>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(originalAmount, currency)}
                    </p>
                </div>

                {/* Penalty */}
                <div className="space-y-1 border-x border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">
                        Penalty
                    </span>
                    <p className={cn(
                        "text-sm font-semibold",
                        penaltyAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"
                    )}>
                        {formatCurrency(penaltyAmount, currency)}
                    </p>
                </div>

                {/* Net Refund */}
                <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">
                        Refund
                    </span>
                    <p className={cn(
                        "text-sm font-bold",
                        refundAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                    )}>
                        {formatCurrency(refundAmount, currency)}
                    </p>
                </div>
            </div>
        </div>
    );
}

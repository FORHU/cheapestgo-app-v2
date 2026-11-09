'use client';

import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { http } from '@/shared/lib/http';
import { CancellationFeeCard } from './CancellationFeeCard';
import { Button } from '@/shared/components/ui/button';
import { errorMessage } from '@/shared/lib/error';

interface CancellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string;
    originalAmount: number;
    currency: string;
    onSuccess: () => void;
}

interface QuoteResponse {
    success: boolean;
    refundAmount?: number;
    refundCurrency?: string;
    penaltyAmount?: number;
    cancellationId?: string | null;
    requiresManualCancellation?: boolean;
    /** Cancelled at Duffel already — its dashboard, or the airline — and settled by the API. */
    alreadyCancelled?: boolean;
    status?: string;
    error?: string;
}

/** What to tell a traveller whose flight turned out to be cancelled already, by where it stands. */
function alreadyCancelledMessage(status: string | undefined): string {
    switch (status) {
        case 'refunded':
            return 'This flight has already been cancelled, and your refund has been issued.';
        case 'refund_failed':
            return 'This flight has already been cancelled, but the refund didn\'t go through. Our team will follow up.';
        case 'cancelled':
            return 'This flight has already been cancelled. Our support team will be in touch about any refund.';
        default:
            return 'This flight has already been cancelled. Your refund is on its way.';
    }
}

/** What `POST /flights/cancel-booking` answers — a 200 whether or not the airline agreed. */
interface CancelResult {
    status: string;
    requiresManualCancellation?: boolean;
    providerMissing?: boolean;
}

function cancelOutcome(result: CancelResult | undefined): { kind: 'done' | 'refund_failed' | 'failed'; message: string } {
    switch (result?.status) {
        case 'cancel_failed':
            return {
                kind: 'failed',
                message: result.requiresManualCancellation
                    ? 'This booking can\'t be cancelled online. Please contact support and we\'ll cancel it for you.'
                    : 'The airline didn\'t accept the cancellation. Please try again, or contact support.',
            };
        case 'refund_failed':
            return { kind: 'refund_failed', message: 'Your flight is cancelled, but the refund didn\'t go through. Our team will follow up.' };
        case 'refund_pending':
            return { kind: 'done', message: 'Your flight is cancelled. Your refund is on its way.' };
        case 'refunded':
            return { kind: 'done', message: 'Your flight is cancelled and your refund has been issued.' };
        default:
            return { kind: 'done', message: 'Your flight is cancelled.' };
    }
}

export function CancellationModal({
    isOpen,
    onClose,
    bookingId,
    originalAmount,
    currency,
    onSuccess,
}: CancellationModalProps) {
    const tAll = useTranslations();
    const [step, setStep] = useState<1 | 2>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quote, setQuote] = useState<QuoteResponse | null>(null);
    /** Set when the flight proved to be cancelled already: nothing left to confirm. */
    const [notice, setNotice] = useState<string | null>(null);

    // Fetch cancel quote on step 1 mount
    useEffect(() => {
        if (!isOpen) return;
        setStep(1);
        setError(null);
        setQuote(null);
        setNotice(null);
        setIsLoading(true);

        http.post<QuoteResponse>('/flights/cancel-quote', { bookingId })
            .then((res) => {
                if (res.alreadyCancelled) {
                    setNotice(alreadyCancelledMessage(res.status));
                } else if (res.success) {
                    setQuote(res);
                } else if (res.requiresManualCancellation) {
                    setError(res.error || 'Online cancellation is not supported for this booking. Please contact customer service.');
                } else {
                    setError(res.error || 'Failed to get cancellation quote.');
                }
            })
            .catch((err) => {
                setError(err.message || 'An error occurred while estimating refund details.');
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [isOpen, bookingId]);

    // The page behind the dialog still shows the flight as booked: bring it up to date.
    useEffect(() => {
        if (notice) onSuccess();
    }, [notice, onSuccess]);

    if (!isOpen) return null;

    const handleConfirmCancel = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await http.post<CancelResult>('/flights/cancel-booking', {
                bookingId,
                cancellationId: quote?.cancellationId || undefined,
            });
            // A refusal comes back as a 200 with its status — it was reported as a success.
            const outcome = cancelOutcome(result);
            onSuccess();
            if (outcome.kind === 'failed') {
                setError(outcome.message);
                return;
            }
            if (outcome.kind === 'refund_failed') toast.error(outcome.message);
            else toast.success(outcome.message);
            onClose();
        } catch (err) {
            setError(errorMessage(err, 'Cancellation request failed. Please try again.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Content Container */}
            <div className="relative w-full max-w-md bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                    <X size={18} />
                </button>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 pr-6">
                    {step === 1 ? 'Cancel Booking' : 'Confirm Cancellation'}
                </h3>

                {isLoading && (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                        <Loader2 size={32} className="text-blue-600 animate-spin" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {step === 1 ? 'Fetching cancellation quote...' : 'Processing request...'}
                        </p>
                    </div>
                )}

                {!isLoading && notice && (
                    <div className="my-4 space-y-4">
                        <div className="flex gap-3 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                            <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{notice}</p>
                        </div>
                        <Button onClick={onClose} className="w-full">
                            {tAll('trips.cancellationModal.close')}
                        </Button>
                    </div>
                )}

                {!isLoading && !notice && error && (
                    <div className="my-4 space-y-4">
                        <div className="flex gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl">
                            <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-400">{tAll('trips.cancellationModal.unableTitle')}</h4>
                                <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed">{error}</p>
                            </div>
                        </div>
                        <Button onClick={onClose} className="w-full">
                            {tAll('trips.cancellationModal.close')}
                        </Button>
                    </div>
                )}

                {!isLoading && !notice && !error && step === 1 && quote && (
                    <div className="my-4 space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            Review the penalty and refund breakdown below. The refund amount shown is estimated based on the airline fare policies.
                        </p>

                        <CancellationFeeCard
                            originalAmount={originalAmount}
                            penaltyAmount={quote.penaltyAmount ?? 0}
                            refundAmount={quote.refundAmount ?? 0}
                            currency={quote.refundCurrency || currency}
                        />

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={onClose} className="flex-1">
                                {tAll('trips.cancellationModal.keepBooking')}
                            </Button>
                            <Button 
                                variant="destructive" 
                                onClick={() => setStep(2)}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {tAll('checkout.continue')}
                            </Button>
                        </div>
                    </div>
                )}

                {!isLoading && !error && step === 2 && (
                    <div className="my-4 space-y-4">
                        <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-400">
                            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                            <p className="text-xs leading-relaxed">
                                <strong>{tAll('trips.cancellationModal.important')}</strong> Cancellation requests cannot be undone. Once submitted, the airline will release your seats and begin the refund process.
                            </p>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {tAll('trips.cancellationModal.confirmQuestion')}
                        </p>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                                {tAll('checkout.back')}
                            </Button>
                            <Button 
                                variant="destructive" 
                                onClick={handleConfirmCancel}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {tAll('trips.cancellationModal.confirm')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

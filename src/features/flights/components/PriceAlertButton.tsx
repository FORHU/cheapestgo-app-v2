'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, Check } from 'lucide-react';
import { http } from '@/shared/lib/http';

interface PriceAlertButtonProps {
    origin: string;
    destination: string;
    adults?: number;
    cabin?: string;
}

type AlertState = 'idle' | 'loading' | 'active' | 'error';

export function PriceAlertButton({
    origin,
    destination,
    adults = 1,
    cabin = 'economy',
}: PriceAlertButtonProps) {
    const [state, setState] = useState<AlertState>('loading');
    const [alertId, setAlertId] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        let cancelled = false;
        async function checkExisting() {
            try {
                const res = await http.get<{ data?: Array<{ id: string; origin: string; destination: string; adults: number; cabin_class: string; is_active: boolean }> }>('/api/price-alerts');
                if (!cancelled) {
                    setIsLoggedIn(true);
                    const items = Array.isArray(res) ? res : res?.data ?? [];
                    const existing = items.find((a: any) =>
                        a.origin === origin &&
                        a.destination === destination &&
                        a.adults === adults &&
                        a.cabin_class === cabin &&
                        a.is_active
                    );
                    if (existing) { setAlertId(existing.id); setState('active'); }
                    else setState('idle');
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const status = (err as { status?: number })?.status;
                    if (status === 401) {
                        setIsLoggedIn(false);
                    }
                    setState('idle');
                }
            }
        }
        checkExisting();
        return () => { cancelled = true; };
    }, [origin, destination, adults, cabin]);

    const createAlert = async () => {
        setState('loading');
        try {
            const res = await http.post<{ success: boolean; data: { id: string } }>('/api/price-alerts', { origin, destination, cabin_class: cabin, adults });
            if (res.success) {
                setAlertId(res.data.id);
                setState('active');
                setFeedback('Price alerts enabled');
                setTimeout(() => setFeedback(''), 4000);
            } else {
                setFeedback('Failed to create alert');
                setState('idle');
                setTimeout(() => setFeedback(''), 3000);
            }
        } catch {
            setState('error');
            setTimeout(() => setState('idle'), 2000);
        }
    };

    const removeAlert = async () => {
        if (!alertId) return;
        setState('loading');
        try {
            await http.delete(`/api/price-alerts/${alertId}`);
            setAlertId(null);
            setState('idle');
            setFeedback('Alert removed');
            setTimeout(() => setFeedback(''), 2000);
        } catch {
            setState('active');
        }
    };

    if (isLoggedIn === false) {
        return (
            <button
                onClick={() => { setFeedback('Sign in required'); setTimeout(() => setFeedback(''), 3000); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors"
                title="Sign in required"
            >
                <Bell size={13} />
                Track Price
                {feedback && <span className="ml-1 text-amber-600 dark:text-amber-400">{feedback}</span>}
            </button>
        );
    }

    if (state === 'loading') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-400">
                <Loader2 size={13} className="animate-spin" />
                <span>Loading</span>
            </div>
        );
    }

    if (state === 'active') {
        return (
            <div className="flex items-center gap-1.5">
                <button
                    onClick={removeAlert}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                    title="Remove alert"
                >
                    <BellOff size={13} />
                    Price alerts active
                </button>
                {feedback && <span className="text-xs text-emerald-600 dark:text-emerald-400">{feedback}</span>}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={createAlert}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 transition-colors"
                title="Email me when price drops"
            >
                <Bell size={13} />
                Track Price
            </button>
            {feedback && (
                <span className={`text-xs flex items-center gap-1 ${feedback === 'Price alerts enabled' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                    {feedback === 'Price alerts enabled' && <Check size={11} />}
                    {feedback}
                </span>
            )}
        </div>
    );
}

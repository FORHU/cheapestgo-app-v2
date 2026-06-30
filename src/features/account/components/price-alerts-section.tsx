'use client';

import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Trash2, Plane, Hotel as HotelIcon } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format';
import type { PriceAlert } from '@/shared/types';

export function PriceAlertsSection() {
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);

    useEffect(() => {
        http.get<PriceAlert[] | { data?: PriceAlert[] }>('/api/bookings/price-alerts')
            .then(res => {
                const data = Array.isArray(res) ? res : (res as { data?: PriceAlert[] }).data ?? [];
                setAlerts(data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = async (id: string) => {
        setRemovingId(id);
        try {
            await http.delete(`/api/bookings/price-alerts/${id}`);
            setAlerts(prev => prev.filter(a => a.id !== id));
        } catch {
            // silently ignore
        } finally {
            setRemovingId(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Price Alerts</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Get notified when prices drop for your saved routes.
                </p>
            </div>

            {alerts.length === 0 ? (
                <div className="flex flex-col items-center text-center py-16 px-4">
                    <div className="w-14 h-14 mb-4 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center">
                        <BellOff size={24} className="text-slate-400" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">No price alerts</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Set up alerts from the search results page to track prices.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {alerts.map(alert => (
                        <div
                            key={alert.id}
                            className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 group"
                        >
                            {/* Type icon */}
                            <div className={cn(
                                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                                alert.type === 'flight' ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-amber-50 dark:bg-amber-900/30'
                            )}>
                                {alert.type === 'flight'
                                    ? <Plane size={15} className="text-blue-600 dark:text-blue-400" />
                                    : <HotelIcon size={15} className="text-amber-600 dark:text-amber-400" />}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <Bell size={11} className="text-blue-500 shrink-0" />
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{alert.title}</p>
                                </div>
                                {alert.destination && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{alert.destination}</p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Created {new Date(alert.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            {/* Threshold price */}
                            {alert.threshold_price != null && (
                                <div className="text-right shrink-0">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Alert at</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(alert.threshold_price, alert.currency)}
                                    </p>
                                </div>
                            )}

                            {/* Delete button */}
                            <button
                                onClick={() => handleDelete(alert.id)}
                                disabled={removingId === alert.id}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                                title="Delete alert"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

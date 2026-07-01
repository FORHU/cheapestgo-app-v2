'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Activity, Clock, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface AnalyticsData {
    totalSearches:    number;
    successRate:      number;
    avgResponseMs:    number;
    errorsToday:      number;
}

function SkeletonGrid() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-32" />
                </div>
            ))}
        </div>
    );
}

export default function AdminAnalyticsPage() {
    const [data, setData]     = useState<AnalyticsData | null>(null);
    const [error, setError]   = useState(false);

    useEffect(() => {
        http.get<AnalyticsData>('/admin/analytics')
            .then(setData)
            .catch(() => setError(true));
    }, []);

    return (
        <div className="p-6 space-y-8">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
                <p className="text-sm text-slate-500 mt-0.5">Platform performance and API health</p>
            </div>

            {data === null && !error && <SkeletonGrid />}

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                    <AlertTriangle size={15} className="shrink-0" />
                    Analytics endpoint not available yet.
                </div>
            )}

            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard label="Total Searches"    value={data.totalSearches.toLocaleString()} />
                    <StatsCard label="Success Rate"      value={`${data.successRate.toFixed(1)}%`} />
                    <StatsCard label="Avg Response"      value={`${data.avgResponseMs}ms`} />
                    <StatsCard label="Errors Today"      value={data.errorsToday.toLocaleString()} />
                </div>
            )}

            {/* Charts placeholder */}
            <section>
                <h2 className="text-sm font-bold text-slate-900 mb-4">Charts</h2>
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <BarChart3 size={40} strokeWidth={1} />
                    <p className="text-sm font-medium">Charts coming soon</p>
                    <p className="text-xs">Connect a charting library (Recharts / Chart.js) to visualise search trends and booking conversion.</p>
                </div>
            </section>

            {/* Provider success placeholder */}
            <section>
                <h2 className="text-sm font-bold text-slate-900 mb-4">Provider Health</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['Duffel', 'TravelgateX', 'ONDA'].map(provider => (
                        <div key={provider} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-2 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{provider}</span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                                    <Activity size={10} /> Online
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }} />
                            </div>
                            <p className="text-[10px] text-slate-400">92% success rate — last 24h</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

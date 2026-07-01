'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ExternalLink, Plane, Hotel, Wifi, Activity } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface SupplierHealth {
    name:        string;
    type:        'flight' | 'hotel';
    status:      'healthy' | 'degraded' | 'down' | 'unknown';
    lastChecked: string | null;
    message:     string | null;
    url?:        string;
}

// Static known suppliers — health data merged from API if available
const STATIC_SUPPLIERS: SupplierHealth[] = [
    { name: 'Duffel',      type: 'flight', status: 'unknown', lastChecked: null, message: null, url: 'https://app.duffel.com' },
    { name: 'TravelgateX', type: 'hotel',  status: 'unknown', lastChecked: null, message: null, url: 'https://app.travelgate.com' },
    { name: 'ONDA',        type: 'hotel',  status: 'unknown', lastChecked: null, message: null },
];

function statusBadge(status: SupplierHealth['status']) {
    switch (status) {
        case 'healthy':  return <Badge variant="success">Healthy</Badge>;
        case 'degraded': return <Badge variant="warning">Degraded</Badge>;
        case 'down':     return <Badge variant="destructive">Down</Badge>;
        default:         return <Badge variant="secondary">Unknown</Badge>;
    }
}

function statusIcon(status: SupplierHealth['status']) {
    switch (status) {
        case 'healthy':  return <CheckCircle2 size={16} className="text-emerald-500" />;
        case 'degraded': return <AlertTriangle size={16} className="text-amber-500" />;
        case 'down':     return <XCircle size={16} className="text-rose-500" />;
        default:         return <Wifi size={16} className="text-slate-300" />;
    }
}

function SkeletonCards() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-16" />
                </div>
            ))}
        </div>
    );
}

export default function AdminSuppliersPage() {
    const [suppliers, setSuppliers] = useState<SupplierHealth[]>(STATIC_SUPPLIERS);
    const [loading, setLoading]     = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function load() {
        try {
            const res = await http.get<{ suppliers: SupplierHealth[] }>('/admin/suppliers/health');
            if (res.suppliers?.length) {
                // Merge API data over static list
                setSuppliers(prev => prev.map(s => {
                    const found = res.suppliers.find(r => r.name.toLowerCase() === s.name.toLowerCase());
                    return found ?? s;
                }));
            }
        } catch {
            // Keep static data — health endpoint may not exist yet
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => { load(); }, []);

    function handleRefresh() {
        setRefreshing(true);
        load();
    }

    const allHealthy   = suppliers.every(s => s.status === 'healthy');
    const anyDown      = suppliers.some(s => s.status === 'down');
    const anyDegraded  = suppliers.some(s => s.status === 'degraded');

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Suppliers</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Integration health status for Duffel, TravelgateX, and ONDA</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={refreshing}>
                    <RefreshCw size={13} />
                </Button>
            </div>

            {/* Overall status banner */}
            {!loading && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold ${
                    allHealthy ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : anyDown  ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : anyDegraded ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                    <Activity size={15} className="shrink-0" />
                    {allHealthy ? 'All supplier integrations are healthy'
                        : anyDown   ? 'One or more suppliers are unreachable'
                        : anyDegraded ? 'Some suppliers are experiencing degraded performance'
                        : 'Supplier health status is unknown'}
                </div>
            )}

            {loading && <SkeletonCards />}

            {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {suppliers.map(supplier => (
                        <div key={supplier.name} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${supplier.type === 'flight' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                        {supplier.type === 'flight' ? <Plane size={18} /> : <Hotel size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{supplier.name}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{supplier.type}</p>
                                    </div>
                                </div>
                                {statusIcon(supplier.status)}
                            </div>

                            <div className="flex items-center justify-between">
                                {statusBadge(supplier.status)}
                                {supplier.url && (
                                    <a href={supplier.url} target="_blank" rel="noopener noreferrer"
                                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                        Portal <ExternalLink size={10} />
                                    </a>
                                )}
                            </div>

                            {supplier.message && (
                                <p className="text-xs text-slate-500 leading-relaxed">{supplier.message}</p>
                            )}

                            {supplier.lastChecked && (
                                <p className="text-[10px] text-slate-400">
                                    Last checked: {new Date(supplier.lastChecked).toLocaleTimeString()}
                                </p>
                            )}

                            {supplier.status === 'unknown' && !supplier.message && (
                                <p className="text-xs text-slate-400 italic">Health check endpoint not configured.</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Configuration notes */}
            <section>
                <h2 className="text-sm font-bold text-slate-900 mb-4">Integration Notes</h2>
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm divide-y divide-slate-100">
                    {[
                        { name: 'Duffel', note: 'Flight booking via Duffel Orders API. Monitor balance at /admin/duffel.' },
                        { name: 'TravelgateX', note: 'Hotel booking via Hotel-X GraphQL (OTV/RateHawk). Monitor at /admin/travelgatex.' },
                        { name: 'ONDA', note: 'Hotel supply via ONDA API. Configure ONDA_API_KEY in environment.' },
                    ].map(item => (
                        <div key={item.name} className="flex items-start gap-4 px-5 py-4">
                            <span className="text-xs font-bold text-slate-700 w-24 shrink-0 pt-0.5">{item.name}</span>
                            <p className="text-xs text-slate-500">{item.note}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

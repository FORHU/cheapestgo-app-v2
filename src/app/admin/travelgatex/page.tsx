'use client';

import { useEffect, useState } from 'react';
import {
    Hotel, CheckCircle2, XCircle, AlertTriangle, ExternalLink,
    Key, Globe, RefreshCw, Wifi, WifiOff, Activity, Building2, TrendingUp,
} from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface TGXBooking {
    id:        string;
    reference: string;
    guestName: string;
    hotelName: string | null;
    checkIn:   string | null;
    checkOut:  string | null;
    status:    string;
    amount:    number | null;
    currency:  string;
}

interface TGXApiLog {
    id:             string;
    endpoint:       string;
    responseStatus: number | null;
    durationMs:     number;
    errorMessage:   string | null;
    createdAt:      string;
}

interface TGXData {
    status:             string;
    errorMessage?:      string;
    otvStatus:          'active' | 'no_rates' | 'unknown';
    apiKeyConfigured:   boolean;
    accessCode:         string | null;
    clientName:         string | null;
    supplierCode:       string | null;
    contextCode:        string | null;
    totalBookings:      number | null;
    confirmedBookings:  number | null;
    cancelledBookings:  number | null;
    totalRevenue:       number | null;
    revenueCurrency:    string | null;
    recentBookings:     TGXBooking[];
    recentApiLogs:      TGXApiLog[];
}

const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

function OTVBadge({ status }: { status: TGXData['otvStatus'] }) {
    if (status === 'active')   return <Badge variant="success"><Wifi size={10} className="mr-1" />OTV Live</Badge>;
    if (status === 'no_rates') return <Badge variant="warning"><WifiOff size={10} className="mr-1" />No Rates</Badge>;
    return <Badge variant="secondary"><Activity size={10} className="mr-1" />Unknown</Badge>;
}

function ConfigRow({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
            {value ? (
                <span className={`text-sm font-bold text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
            ) : (
                <span className="text-xs text-slate-300 italic">not set</span>
            )}
        </div>
    );
}

function StatusRow({ label, ok, text, warn = false }: { label: string; ok: boolean; text: string; warn?: boolean }) {
    const Icon = warn ? AlertTriangle : ok ? CheckCircle2 : XCircle;
    const iconCls = warn ? 'text-amber-500' : ok ? 'text-emerald-500' : 'text-rose-400';
    const textCls = warn ? 'text-amber-700' : ok ? 'text-slate-700' : 'text-rose-600';
    return (
        <div className="flex items-center gap-3">
            <Icon size={13} className={`${iconCls} shrink-0`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 w-36 shrink-0">{label}</span>
            <span className={`text-xs font-bold ${textCls}`}>{text}</span>
        </div>
    );
}

function httpStatusVariant(code: number | null): 'success' | 'warning' | 'destructive' | 'secondary' {
    if (!code) return 'secondary';
    if (code < 300) return 'success';
    if (code < 500) return 'warning';
    return 'destructive';
}

function bookingStatusVariant(status: string): 'success' | 'destructive' | 'warning' {
    if (status === 'confirmed') return 'success';
    if (status === 'cancelled') return 'destructive';
    return 'warning';
}

function SkeletonCards() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-20" />
                </div>
            ))}
        </div>
    );
}

export default function AdminTravelgateXPage() {
    const [data, setData]       = useState<TGXData | null>(null);
    const [error, setError]     = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab]         = useState<'bookings' | 'logs'>('bookings');
    const [refreshing, setRefreshing] = useState(false);

    async function load() {
        try {
            const res = await http.get<TGXData>('/admin/travelgatex');
            setData(res);
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load TravelgateX data.');
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

    const cur = data?.revenueCurrency ?? 'USD';

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">TravelgateX</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Hotel-X GraphQL · OTV / WorldOTA (RateHawk)</p>
                </div>
                <div className="flex items-center gap-3">
                    {data && <OTVBadge status={data.otvStatus} />}
                    {data && !data.apiKeyConfigured && (
                        <Badge variant="destructive"><Key size={10} className="mr-1" />API Key Missing</Badge>
                    )}
                    <a href="https://app.travelgate.com" target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                        Portal <ExternalLink size={11} />
                    </a>
                    <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={refreshing}>
                        <RefreshCw size={13} />
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                    <AlertTriangle size={15} className="shrink-0" /> {error}
                </div>
            )}

            {loading && !data && <SkeletonCards />}

            {data && (
                <>
                    {/* Warnings */}
                    {data.otvStatus === 'no_rates' && (
                        <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-amber-50 border border-amber-200">
                            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-800">OTV returning no rates</p>
                                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                    The API is reachable but hotel searches return 0 results. This typically means the B2B account
                                    does not yet have active rate agreements for the queried markets. Contact TravelgateX or WorldOTA/RateHawk support.
                                </p>
                            </div>
                        </div>
                    )}

                    {data.status === 'error' && data.errorMessage && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200">
                            <XCircle size={15} className="text-rose-500 shrink-0" />
                            <p className="text-xs font-bold text-rose-700">{data.errorMessage}</p>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatsCard label="Hotel Bookings" value={data.totalBookings != null ? data.totalBookings.toLocaleString() : '—'} />
                        <StatsCard label="Confirmed"      value={data.confirmedBookings != null ? data.confirmedBookings.toLocaleString() : '—'} />
                        <StatsCard label="Cancelled"      value={data.cancelledBookings != null ? data.cancelledBookings.toLocaleString() : '—'} />
                        <StatsCard label="Revenue"        value={data.totalRevenue != null ? fmt(data.totalRevenue, cur) : '—'} />
                    </div>

                    {/* Config + Connection status */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-1">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Key size={14} className="text-blue-600" /></div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">API Configuration</p>
                                    <p className="text-[11px] text-slate-400">Hotel-X GraphQL endpoint</p>
                                </div>
                            </div>
                            <ConfigRow label="API Key"     value={data.apiKeyConfigured ? '•••••••• (configured)' : null} mono />
                            <ConfigRow label="Client"      value={data.clientName} mono />
                            <ConfigRow label="Access Code" value={data.accessCode} mono />
                            <ConfigRow label="Supplier"    value={data.supplierCode} mono />
                            <ConfigRow label="Context"     value={data.contextCode} mono />
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center"><Globe size={14} className="text-purple-600" /></div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">OTV / WorldOTA (RateHawk)</p>
                                    <p className="text-[11px] text-slate-400">Emerging Travel Group · B2B hotel rates</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <StatusRow label="API Connectivity"   ok={data.otvStatus !== 'unknown'} text={data.otvStatus !== 'unknown' ? 'Reachable' : 'Unknown'} />
                                <StatusRow label="Destination Catalog" ok={data.otvStatus === 'active' || data.otvStatus === 'no_rates'} text={data.otvStatus !== 'unknown' ? 'Loaded' : 'Unknown'} />
                                <StatusRow label="Rate Plans"          ok={data.otvStatus === 'active'} warn={data.otvStatus === 'no_rates'}
                                    text={data.otvStatus === 'active' ? 'Active' : data.otvStatus === 'no_rates' ? 'No rates — contact OTV' : 'Unknown'} />
                                <StatusRow label="API Key"             ok={data.apiKeyConfigured} text={data.apiKeyConfigured ? 'Configured' : 'Missing — set TRAVELGATE_API_KEY'} />
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
                            {(['bookings', 'logs'] as const).map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}>
                                    {t === 'bookings' ? 'Hotel Bookings' : 'API Logs'}
                                </button>
                            ))}
                        </div>

                        {tab === 'bookings' && (
                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                                {data.recentBookings.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <Hotel size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                                        <p className="text-sm font-bold text-slate-900">No hotel bookings yet</p>
                                        <p className="text-xs text-slate-400 mt-1">OTV bookings will appear here</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                                <tr>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reference</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Guest</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Hotel</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Check-in</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {data.recentBookings.map(b => (
                                                    <tr key={b.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold">{b.reference}</td>
                                                        <td className="px-4 py-3 font-bold text-slate-900">{b.guestName}</td>
                                                        <td className="px-4 py-3 text-xs text-slate-600">{b.hotelName || '—'}</td>
                                                        <td className="px-4 py-3 text-xs text-slate-500">{b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '—'}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant={bookingStatusVariant(b.status)} size="sm">{b.status}</Badge>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                                                            {b.amount ? fmt(b.amount, b.currency) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'logs' && (
                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                                {data.recentApiLogs.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <Activity size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                                        <p className="text-sm font-bold text-slate-900">No API logs</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                                <tr>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Endpoint</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Duration</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Error</th>
                                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {data.recentApiLogs.map(log => (
                                                    <tr key={log.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">
                                                            <span className="font-mono text-xs text-slate-600 truncate block max-w-[200px]">
                                                                {log.endpoint.replace(/^https?:\/\//, '')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant={httpStatusVariant(log.responseStatus)} size="sm">
                                                                {log.responseStatus ?? '—'}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-xs font-bold ${log.durationMs > 5000 ? 'text-rose-500' : log.durationMs > 2000 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                                                {log.durationMs ? `${log.durationMs.toLocaleString()}ms` : '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-xs text-rose-500 truncate block max-w-[180px]">
                                                                {log.errorMessage || <span className="text-slate-300">—</span>}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-xs text-slate-400">
                                                            {new Date(log.createdAt).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

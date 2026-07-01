'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Bell, Send, TrendingUp, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface MobileStats {
    total:     number;
    confirmed: number;
    pending:   number;
    failed:    number;
    devices:   number;
}

interface DeviceToken {
    id:         string;
    user_id:    string;
    platform:   string;
    token:      string;
    created_at: string;
}

interface MobileData {
    stats:   MobileStats;
    devices: DeviceToken[];
}

function SkeletonCards() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-20" />
                </div>
            ))}
        </div>
    );
}

// ─── Push notification form ───────────────────────────────────────────────────

function PushForm({ deviceCount }: { deviceCount: number }) {
    const [pushTitle, setPushTitle]   = useState('');
    const [pushBody, setPushBody]     = useState('');
    const [target, setTarget]         = useState<'all' | 'user'>('all');
    const [userId, setUserId]         = useState('');
    const [sending, setSending]       = useState(false);
    const [result, setResult]         = useState<{ ok: boolean; msg: string } | null>(null);

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (!pushTitle.trim() || !pushBody.trim()) return;
        setSending(true);
        setResult(null);
        try {
            await http.post('/admin/mobile/push', {
                title: pushTitle.trim(),
                body:  pushBody.trim(),
                target,
                userId: target === 'user' ? userId.trim() : undefined,
            });
            setResult({ ok: true, msg: 'Notification sent.' });
            setPushTitle(''); setPushBody(''); setUserId('');
        } catch (err: unknown) {
            setResult({ ok: false, msg: err instanceof Error ? err.message : 'Failed to send.' });
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0"><Bell size={14} className="text-violet-600" /></div>
                <div>
                    <p className="text-sm font-bold text-slate-900">Push Notifications</p>
                    <p className="text-[11px] text-slate-400">{deviceCount} registered device{deviceCount !== 1 ? 's' : ''}</p>
                </div>
            </div>

            {result && (
                <div className={`text-sm px-3 py-2 rounded-lg ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {result.msg}
                </div>
            )}

            <form onSubmit={handleSend} className="space-y-3">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 w-fit">
                    {(['all', 'user'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setTarget(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${target === t ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-violet-600'}`}>
                            {t === 'all' ? 'All Devices' : 'Specific User'}
                        </button>
                    ))}
                </div>

                {target === 'user' && (
                    <Input placeholder="User UUID" value={userId} onChange={e => setUserId(e.target.value)} />
                )}

                <Input placeholder="Notification title" value={pushTitle} onChange={e => setPushTitle(e.target.value)} required />
                <textarea
                    placeholder="Notification body"
                    value={pushBody}
                    onChange={e => setPushBody(e.target.value)}
                    rows={3}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white text-sm px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none transition-all"
                />
                <Button type="submit" isLoading={sending} disabled={deviceCount === 0} fullWidth className="bg-violet-600 hover:bg-violet-700" size="sm">
                    <Send size={13} />
                    {sending ? 'Sending…' : `Send to ${target === 'all' ? `all ${deviceCount} devices` : 'user'}`}
                </Button>
                {deviceCount === 0 && (
                    <p className="text-[11px] text-slate-400 text-center">No devices registered yet.</p>
                )}
            </form>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminMobilePage() {
    const [data, setData]     = useState<MobileData | null>(null);
    const [error, setError]   = useState<string | null>(null);

    useEffect(() => {
        http.get<MobileData>('/admin/mobile')
            .then(setData)
            .catch(err => setError(err instanceof Error ? err.message : 'Failed to load mobile data.'));
    }, []);

    const stats    = data?.stats;
    const devices  = data?.devices ?? [];
    const successRate = stats && stats.total > 0 ? ((stats.confirmed / stats.total) * 100).toFixed(1) : '0.0';

    return (
        <div className="p-6 space-y-8">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Mobile</h1>
                <p className="text-sm text-slate-500 mt-0.5">App stats and device token management</p>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                    <AlertTriangle size={15} className="shrink-0" />
                    {error}
                </div>
            )}

            {!data && !error && <SkeletonCards />}

            {data && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatsCard label="Total Bookings"     value={stats!.total.toLocaleString()} />
                        <StatsCard label="Confirmed"          value={stats!.confirmed.toLocaleString()} />
                        <StatsCard label="Pending"            value={stats!.pending.toLocaleString()} />
                        <StatsCard label="Success Rate"       value={`${successRate}%`} />
                        <StatsCard label="Registered Devices" value={stats!.devices.toLocaleString()} />
                    </div>

                    <PushForm deviceCount={stats!.devices} />

                    {/* Device tokens */}
                    <section>
                        <h2 className="text-sm font-bold text-slate-900 mb-4">Device Tokens</h2>
                        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                            {devices.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Smartphone size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                                    <p className="text-sm font-bold text-slate-900">No devices registered</p>
                                    <p className="text-xs text-slate-400 mt-1">The mobile app must register a push token on startup.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-slate-100 bg-slate-50/50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Platform</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Token</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Registered</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {devices.map(d => (
                                                <tr key={d.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <Badge variant={d.platform === 'ios' ? 'secondary' : 'default'} size="sm">
                                                            {d.platform.toUpperCase()}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <code className="text-xs font-mono text-slate-500 truncate block max-w-[220px]">
                                                            {d.token.slice(0, 32)}…
                                                        </code>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <code className="text-xs font-mono text-slate-400">{d.user_id.slice(0, 8)}…</code>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-xs text-slate-400">
                                                        {new Date(d.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

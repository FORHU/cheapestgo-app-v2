'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mail, CheckCircle2, AlertCircle, Clock, RefreshCw, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface EmailLog {
    id:            string;
    booking_id:    string;
    recipient:     string;
    subject:       string;
    email_type:    string;
    status:        'queued' | 'sent' | 'failed';
    error_message?: string;
    created_at:    string;
}

interface LogsResponse {
    logs:       EmailLog[];
    total:      number;
    page:       number;
    totalPages: number;
}

const PAGE_SIZE = 20;

function statusBadge(status: string) {
    if (status === 'sent')   return <Badge variant="success">Sent</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="warning">Queued</Badge>;
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
}

// ─── Send Notification Form ───────────────────────────────────────────────────

function SendForm() {
    const [title, setTitle]     = useState('');
    const [body, setBody]       = useState('');
    const [target, setTarget]   = useState('all');
    const [userId, setUserId]   = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null);

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !body.trim()) return;
        setSending(true);
        setResult(null);
        try {
            await http.post('/admin/communication/send', { title, body, target, userId: target === 'user' ? userId : undefined });
            setResult({ ok: true, msg: 'Notification sent.' });
            setTitle(''); setBody(''); setUserId('');
        } catch (err: unknown) {
            setResult({ ok: false, msg: err instanceof Error ? err.message : 'Failed to send.' });
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
                <Send size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Send Notification</h2>
            </div>

            {result && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {result.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {result.msg}
                </div>
            )}

            <form onSubmit={handleSend} className="space-y-3">
                {/* Target selector */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 w-fit">
                    {(['all', 'user'] as const).map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTarget(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${target === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}
                        >
                            {t === 'all' ? 'All Users' : 'Specific User'}
                        </button>
                    ))}
                </div>

                {target === 'user' && (
                    <Input
                        placeholder="User ID (UUID)"
                        value={userId}
                        onChange={e => setUserId(e.target.value)}
                    />
                )}

                <Input
                    placeholder="Notification title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                />

                <textarea
                    placeholder="Message body"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={3}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white text-sm px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all"
                />

                <Button type="submit" isLoading={sending} className="w-full" size="sm">
                    Send
                </Button>
            </form>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCommunicationPage() {
    const [logs, setLogs]     = useState<EmailLog[]>([]);
    const [total, setTotal]   = useState(0);
    const [page, setPage]     = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const load = useCallback(async (p: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await http.get<LogsResponse>(`/admin/communication?page=${p}&pageSize=${PAGE_SIZE}`);
            setLogs(res.logs ?? []);
            setTotal(res.total ?? 0);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load communication logs.');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page); }, [page, load]);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Communication</h1>
                <p className="text-sm text-slate-500 mt-0.5">Send notifications and view email logs</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <SendForm />
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900">
                            Email Logs {total > 0 && <span className="text-slate-400 font-normal">({total.toLocaleString()})</span>}
                        </h2>
                        <Button variant="outline" size="sm" onClick={() => load(page)}>
                            <RefreshCw size={13} />
                        </Button>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                        {error ? (
                            <div className="p-8 text-center text-sm text-rose-500">{error}</div>
                        ) : loading ? (
                            <div className="p-6 space-y-3">
                                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="p-12 text-center">
                                <Mail size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                                <p className="text-sm font-bold text-slate-900">No email logs yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-100">
                                        <tr>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Recipient</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                                                <td className="px-4 py-3 text-xs text-slate-700 max-w-[180px] truncate" title={log.recipient}>{log.recipient}</td>
                                                <td className="px-4 py-3 text-xs text-slate-600 capitalize">{log.email_type.replace(/_/g, ' ')}</td>
                                                <td className="px-4 py-3">{statusBadge(log.status)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {!loading && !error && totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm text-slate-500">
                            <span>Page {page} of {totalPages}</span>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft size={14} />}>Prev</Button>
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight size={14} />}>Next</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

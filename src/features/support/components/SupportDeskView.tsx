'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Send, Undo2, CheckCircle2, Paperclip, FileText, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/auth/store';
import { readerView } from '@/features/support/lib/translationView';
import {
    agentAttachmentHref, assignConversation, fetchConversationForAgent, fetchDeskStaff, fetchInbox,
    openDeskStream, replyAsAgent, resolveConversation, returnToQueue, uploadAgentAttachment,
    type AgentConversation, type DeskStaff, type InboxFilter, type InboxRow,
} from '@/features/support/api/adminSupport.api';

/**
 * The Support Desk: the queues, and answering.
 *
 * Two rules from the ADRs shape most of what is on screen. Chats are **given** by an admin and
 * never taken (ADR-0041), so there is no "claim" button and the assign control appears only for
 * an admin. And Waiting is ordered by proximity to travel (ADR-0039) — by the server, which is
 * why nothing here re-sorts it: a queue an Agent can reorder is a queue that no longer means
 * what it says.
 */

const FILTERS: { key: InboxFilter; label: string }[] = [
    { key: 'unassigned', label: 'Waiting' },
    { key: 'mine',       label: 'Mine' },
    { key: 'assigned',   label: 'Assigned' },
    { key: 'resolved',   label: 'Resolved' },
];

const URGENCY_TONE: Record<string, string> = {
    travelling_now: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    imminent:       'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    upcoming:       'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
};

export function SupportDeskView() {
    const me      = useAuthStore(s => s.user);
    const isAdmin = (me as { role?: string } | null)?.role === 'admin';

    const [filter, setFilter]       = useState<InboxFilter>('unassigned');
    const [rows, setRows]           = useState<InboxRow[]>([]);
    const [selectedId, setSelected] = useState<string | null>(null);
    const [open, setOpen]           = useState<AgentConversation | null>(null);
    const [staff, setStaff]         = useState<DeskStaff[]>([]);
    const [loading, setLoading]     = useState(true);
    const [busy, setBusy]           = useState(false);
    const [error, setError]         = useState<string | null>(null);

    const loadInbox = useCallback(async (which: InboxFilter) => {
        setLoading(true);
        try {
            setRows(await fetchInbox(which));
            setError(null);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadConversation = useCallback(async (id: string) => {
        try {
            setOpen(await fetchConversationForAgent(id));
        } catch (err) {
            setError((err as Error).message);
        }
    }, []);

    useEffect(() => { void loadInbox(filter); }, [filter, loadInbox]);
    useEffect(() => { if (isAdmin) fetchDeskStaff().then(setStaff).catch(() => setStaff([])); }, [isAdmin]);
    useEffect(() => { if (selectedId) void loadConversation(selectedId); }, [selectedId, loadConversation]);

    // One stream for the whole desk: a message in a chat nobody is looking at is exactly what an
    // Agent needs to hear about. The event names an id; the views refetch.
    useEffect(() => {
        const source = openDeskStream();
        source.addEventListener('support', () => {
            void loadInbox(filter);
            if (selectedId) void loadConversation(selectedId);
        });
        return () => source.close();
    }, [filter, selectedId, loadInbox, loadConversation]);

    const act = async (run: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await run();
            await loadInbox(filter);
            if (selectedId) await loadConversation(selectedId);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-4">
            <section className="flex w-80 shrink-0 flex-col rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1 border-b border-slate-200 p-2 dark:border-slate-700">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => { setFilter(f.key); setSelected(null); setOpen(null); }}
                            className={cn('rounded px-2 py-1 text-xs font-medium transition',
                                filter === f.key
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}
                        >
                            {f.label}
                        </button>
                    ))}
                    <button type="button" onClick={() => void loadInbox(filter)} aria-label="Refresh"
                        className="ml-auto rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    </button>
                </div>

                <ul className="flex-1 overflow-y-auto">
                    {!loading && rows.length === 0 && (
                        <li className="p-4 text-sm text-slate-500">Nothing here.</li>
                    )}
                    {rows.map(row => (
                        <li key={row.id}>
                            <button
                                type="button"
                                onClick={() => setSelected(row.id)}
                                className={cn('w-full border-b border-slate-100 px-3 py-2 text-left transition dark:border-slate-800',
                                    selectedId === row.id ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                        {row.customerEmail ?? 'Customer'}
                                    </span>
                                    <Badge className={cn('shrink-0 text-[10px]', URGENCY_TONE[row.urgency] ?? 'bg-slate-100 text-slate-700')}>
                                        {row.urgency.replace(/_/g, ' ')}
                                    </Badge>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                                    <span className="truncate">{row.reference}</span>
                                    <span>{row.messageCount} msg</span>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-slate-200 dark:border-slate-700">
                {error && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</p>}

                {!open && <p className="p-6 text-sm text-slate-500">Pick a chat to read it.</p>}

                {open && (
                    <>
                        <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                            <div className="mr-auto">
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{open.conversation.reference}</h2>
                                <p className="text-xs text-slate-500">{open.conversation.status.replace(/_/g, ' ')} · {open.conversation.locale}</p>
                            </div>

                            {isAdmin && (
                                // Admins only: a chat is given, never taken (ADR-0041).
                                <select
                                    aria-label="Assign to"
                                    value={open.conversation.assignedAdminId ?? ''}
                                    disabled={busy}
                                    onChange={e => e.target.value && act(() => assignConversation(open.conversation.id, e.target.value))}
                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Unassigned</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                                </select>
                            )}

                            <Button variant="outline" size="sm" disabled={busy}
                                onClick={() => act(() => returnToQueue(open.conversation.id))}>
                                <Undo2 className="mr-1 h-3.5 w-3.5" /> Return
                            </Button>
                            <Button size="sm" disabled={busy}
                                onClick={() => act(() => resolveConversation(open.conversation.id))}>
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolve
                            </Button>
                        </header>

                        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                            {open.messages.map(m => {
                                // The same rule the customer's widget applies, asked from the other
                                // side: an Agent reads the English rendering of a Korean message,
                                // and their own reply as they wrote it.
                                const view = readerView(m, true);
                                const fromCustomer = m.senderType === 'guest';
                                if (m.senderType === 'system') {
                                    return <p key={m.id} className="text-center text-xs italic text-slate-400">{view.primary}</p>;
                                }
                                return (
                                    <div key={m.id} className={cn('flex', fromCustomer ? 'justify-start' : 'justify-end')}>
                                        <div className={cn('max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                                            fromCustomer
                                                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                                                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900')}>
                                            {view.primary}
                                            {view.original && (
                                                // ADR-0033 keeps the author's words authoritative, so
                                                // the Agent can always see what was actually written.
                                                <span className="mt-1 block border-t border-white/20 pt-1 text-[11px] opacity-70">
                                                    {view.original}
                                                </span>
                                            )}
                                            {(m.attachments ?? []).length > 0 && (
                                                <ul className="mt-1.5 space-y-1">
                                                    {m.attachments!.map(f => (
                                                        <li key={f.id}>
                                                            {f.bytesDeleted
                                                                // The row stays so the transcript still shows a
                                                                // file was sent; only the bytes are gone.
                                                                ? <span className="flex items-center gap-1.5 text-xs opacity-70">
                                                                      <FileText className="h-3.5 w-3.5" />
                                                                      <span className="line-through">{f.fileName}</span>
                                                                      <span>· no longer stored</span>
                                                                  </span>
                                                                : <a href={agentAttachmentHref(f.id)} target="_blank" rel="noreferrer"
                                                                     className="flex items-center gap-1.5 text-xs underline underline-offset-2">
                                                                      <FileText className="h-3.5 w-3.5" />
                                                                      <span className="truncate">{f.fileName}</span>
                                                                  </a>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {view.label && view.label !== 'translated' && (
                                                <span className="mt-1 block text-[11px] opacity-70">
                                                    {view.label === 'pending' ? 'translating…' : 'could not be translated'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {open.canWrite
                            ? <ReplyBox
                                  busy={busy}
                                  conversationId={open.conversation.id}
                                  onSend={(body, ids) => act(() => replyAsAgent(open.conversation.id, body, ids))} />
                            : <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-700">
                                  This chat is held by someone else. You can read it; only they can reply.
                              </p>}
                    </>
                )}
            </section>
        </div>
    );
}

function ReplyBox({ busy, conversationId, onSend }: {
    busy: boolean;
    conversationId: string;
    onSend: (body: string, attachmentIds: string[]) => void;
}) {
    const [draft, setDraft] = useState('');
    const [staged, setStaged] = useState<{ id: string; fileName: string }[]>([]);
    const [attaching, setAttaching] = useState(false);

    const send = () => {
        if (!draft.trim()) return;
        onSend(draft.trim(), staged.map(f => f.id));
        setDraft('');
        setStaged([]);
    };

    const attach = async (file: File) => {
        setAttaching(true);
        try {
            const stored = await uploadAgentAttachment(conversationId, file);
            setStaged(prev => [...prev, stored]);
        } catch {
            // The reply still goes without it; the Agent can see the chip never appeared.
        } finally {
            setAttaching(false);
        }
    };

    return (
        <div className="border-t border-slate-200 dark:border-slate-700">
        {staged.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 px-3 pt-2">
                {staged.map(f => (
                    <li key={f.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                        <FileText className="h-3 w-3" />
                        <span className="max-w-[10rem] truncate">{f.fileName}</span>
                        <button type="button" aria-label="Remove" onClick={() => setStaged(p => p.filter(x => x.id !== f.id))}>
                            <X className="h-3 w-3" />
                        </button>
                    </li>
                ))}
            </ul>
        )}
        <div className="flex items-end gap-2 p-3">
            <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={2}
                maxLength={4000}
                aria-label="Reply"
                placeholder="Reply…"
                className="max-h-32 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm
                           outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                <span className="sr-only">Attach a file</span>
                <input type="file" className="hidden"
                       accept="image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf"
                       onChange={e => { const f = e.target.files?.[0]; if (f) void attach(f); e.target.value = ''; }} />
            </label>
            <Button size="sm" disabled={busy || !draft.trim()} onClick={send} aria-label="Send reply">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
        </div>
        </div>
    );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { http } from '@/shared/lib/http';
import { Skeleton } from '@/shared/components/ui/skeleton';

/** Sunday-first, matching `Date.getDay()`. */
const DAYS = [
    { key: 'sun', label: 'Sunday' },
    { key: 'mon', label: 'Monday' },
    { key: 'tue', label: 'Tuesday' },
    { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' },
    { key: 'fri', label: 'Friday' },
    { key: 'sat', label: 'Saturday' },
] as const;

type DayKey = (typeof DAYS)[number]['key'];
interface Window { open: string; close: string }
interface SupportHours {
    timezone: string;
    days: Partial<Record<DayKey, Window | null>>;
}

/** What a day falls back to when it is switched on with nothing set. */
const DEFAULT_WINDOW: Window = { open: '09:00', close: '18:00' };

/**
 * The desk's settings: when the team is available, and nothing else.
 *
 * The schedule gates whether the support widget offers a live chat or tells the visitor
 * when someone will be back, so it is the Agents' own setting rather than an administrative
 * one — which is why it lives here, behind the desk's gate, and not in the back office.
 *
 * The whole week is sent on save, never a patch. A partial update invites the state where
 * half the schedule is what you meant and half is what was already there, with no way to
 * tell which is which.
 */
export default function DeskSettingsPage() {
    const [hours, setHours]   = useState<SupportHours | null>(null);
    const [loading, setLoad]  = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast]   = useState<{ ok: boolean; msg: string } | null>(null);

    useEffect(() => {
        http.get<{ data: { hours: SupportHours } }>('/admin/support/hours')
            .then(r => setHours(r.data.hours))
            .catch((e: unknown) => setToast({
                ok: false,
                msg: e instanceof Error ? e.message : 'Could not load the schedule.',
            }))
            .finally(() => setLoad(false));
    }, []);

    const setDay = useCallback((key: DayKey, next: Window | null) => {
        setHours(h => (h ? { ...h, days: { ...h.days, [key]: next } } : h));
    }, []);

    async function save() {
        if (!hours) return;
        setSaving(true);
        setToast(null);
        try {
            const r = await http.put<{ data: { hours: SupportHours } }>('/admin/support/hours', { hours });
            setHours(r.data.hours);
            setToast({ ok: true, msg: 'Hours saved.' });
        } catch (e: unknown) {
            // The API names the day and the problem — show it rather than a generic failure,
            // because "Tuesday closes before it opens" is the whole of what went wrong.
            setToast({ ok: false, msg: e instanceof Error ? e.message : 'Save failed.' });
        } finally {
            setSaving(false);
            setTimeout(() => setToast(null), 5000);
        }
    }

    if (loading) {
        return (
            <div className="space-y-3 p-4 sm:p-6">
                <Skeleton className="h-6 w-40" />
                {DAYS.map(d => <Skeleton key={d.key} className="h-12 w-full max-w-xl" />)}
            </div>
        );
    }

    if (!hours) {
        return (
            <div className="p-4 sm:p-6">
                <p className="text-sm text-rose-700">{toast?.msg ?? 'The schedule is unavailable.'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 p-4 sm:p-6">
            <header>
                <h2 className="text-xl font-semibold text-slate-900">Support hours</h2>
                <p className="text-sm text-slate-500">
                    When the widget offers a live chat. Outside these hours a visitor is told when
                    someone will be back.
                </p>
            </header>

            <label className="block max-w-xs">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Timezone
                </span>
                <input
                    value={hours.timezone}
                    onChange={e => setHours({ ...hours, timezone: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Asia/Manila"
                />
                <span className="mt-1 block text-xs text-slate-400">
                    An IANA zone. Hours are a promise made in one place&apos;s local time.
                </span>
            </label>

            <div className="max-w-xl space-y-2">
                {DAYS.map(({ key, label }) => {
                    const win = hours.days[key] ?? null;
                    const isOpen = win !== null;
                    return (
                        <div
                            key={key}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                        >
                            <span className="w-24 shrink-0 text-sm font-semibold text-slate-900">{label}</span>
                            <button
                                type="button"
                                onClick={() => setDay(key, isOpen ? null : { ...DEFAULT_WINDOW })}
                                aria-pressed={isOpen}
                                aria-label={`${label} ${isOpen ? 'open' : 'closed'}`}
                                className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
                                    isOpen ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                            >
                                <span
                                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
                                        isOpen ? 'right-1' : 'left-1'
                                    }`}
                                />
                            </button>
                            {isOpen ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={win.open}
                                        onChange={e => setDay(key, { ...win, open: e.target.value })}
                                        aria-label={`${label} opens`}
                                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                                    />
                                    <span className="text-slate-400">to</span>
                                    <input
                                        type="time"
                                        value={win.close}
                                        onChange={e => setDay(key, { ...win, close: e.target.value })}
                                        aria-label={`${label} closes`}
                                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                                    />
                                </div>
                            ) : (
                                <span className="text-sm text-slate-400">Closed</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save hours'}
                </button>
                {toast && (
                    <span
                        role="status"
                        className={`text-sm font-medium ${toast.ok ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                        {toast.msg}
                    </span>
                )}
            </div>
        </div>
    );
}

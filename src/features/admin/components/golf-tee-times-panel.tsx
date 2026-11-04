'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { adminGolfApi } from '@/features/golf/api/golf.api';
import type { GolfCourse, ScheduleDraft, TeeTimeSchedule } from '@/features/golf/types';
import { clockTime } from '@/features/golf/lib/format';

type FieldErrors = Partial<Record<keyof ScheduleDraft, string[]>>;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY = { name: '', days: [] as number[], firstTee: '', lastTee: '', interval: '30', spots: '4', price: '' };

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const labelClass = 'ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400/80';
const errorClass = 'ml-1 text-[10px] font-bold text-rose-500';

/**
 * A course's tee-time schedules (api-v2 `/admin/golf/courses/:id/schedules`). Adding one makes its
 * tee times at once; deleting one removes its future tee times. A published course keeps its last
 * schedule, and a course needs a time zone before it can have any. English only: a staff screen.
 */
export function GolfTeeTimesPanel({ course, onChanged }: { course: GolfCourse; onChanged: () => void }) {
    const [schedules, setSchedules] = useState<TeeTimeSchedule[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            setSchedules(await adminGolfApi.listSchedules(course.id));
        } catch (err) {
            setLoadError(message(err, 'Could not load the schedules.'));
        }
    }, [course.id]);

    useEffect(() => { if (course.timezone) void load(); }, [course.timezone, load]);

    if (!course.timezone) {
        return (
            <p className="text-sm text-slate-600">
                Set this course&apos;s time zone first: tee times are made on its clock. Edit the course and choose one.
            </p>
        );
    }

    const toggleDay = (d: number) =>
        setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort((a, b) => a - b) }));

    async function add(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setFieldErrors({});
        setNotice(null);
        setActionError(null);
        const draft: ScheduleDraft = {
            name:            form.name.trim(),
            daysOfWeek:      form.days,
            firstTee:        form.firstTee,
            lastTee:         form.lastTee,
            intervalMinutes: Number(form.interval),
            spots:           Number(form.spots),
            pricePerPlayer:  Number(form.price),
        };
        try {
            const { created } = await adminGolfApi.addSchedule(course.id, draft);
            setForm(EMPTY);
            setNotice(`${created.toLocaleString()} tee times created.`);
            await load();
            onChanged();
        } catch (err) {
            setFieldErrors((err as { body?: { details?: FieldErrors } }).body?.details ?? {});
            setActionError(message(err, 'Could not add the schedule.'));
        } finally {
            setSaving(false);
        }
    }

    async function remove(s: TeeTimeSchedule) {
        if (!window.confirm(`Delete ${s.name}? Its future tee times are removed too.`)) return;
        setActionError(null);
        setNotice(null);
        try {
            await adminGolfApi.removeSchedule(course.id, s.id);
            await load();
            onChanged();
        } catch (err) {
            setActionError(message(err, 'Could not delete the schedule.'));
        }
    }

    const error = (key: keyof ScheduleDraft) => fieldErrors[key]?.[0];

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">
                Times are on the course&apos;s clock ({course.timezone}); prices are per player in {course.currency}. Tee times are made {course.bookingWindowDays} days ahead.
            </p>

            {loadError && <p role="alert" className="text-sm text-rose-600">{loadError}</p>}
            {actionError && <p role="alert" className="text-sm text-rose-600">{actionError}</p>}
            {notice && <p role="status" className="text-sm text-emerald-600">{notice}</p>}

            {schedules === null && !loadError ? (
                <Skeleton className="h-16 w-full" />
            ) : schedules && schedules.length === 0 ? (
                <p className="text-sm text-slate-600">No schedules yet. Add one below to make tee times.</p>
            ) : schedules && (
                <table className="w-full text-[13px]">
                    <thead className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
                        <tr><th className="py-1.5">Name</th><th>Days</th><th>Times</th><th>Spots</th><th>Price</th><th /></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {schedules.map((s) => (
                            <tr key={s.id}>
                                <td className="py-1.5 font-semibold text-slate-900">{s.name}</td>
                                <td className="text-slate-600">{s.daysOfWeek.map((d) => DAYS[d]).join(', ')}</td>
                                <td className="text-slate-600">{`${clockTime(s.firstTee, 'en')}–${clockTime(s.lastTee, 'en')} every ${s.intervalMinutes} min`}</td>
                                <td className="text-slate-600">{s.spots}</td>
                                <td className="text-slate-600">{`${course.currency} ${s.pricePerPlayer.toLocaleString()}`}</td>
                                <td className="text-right">
                                    <Button variant="ghost" size="sm" aria-label={`Delete ${s.name}`} onClick={() => remove(s)} className="h-8 px-2 text-rose-500 hover:bg-rose-50">
                                        <Trash2 size={14} />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <form noValidate onSubmit={add} className="space-y-3 border-t border-slate-200 pt-4">
                <p className="text-sm font-semibold text-slate-900">Add a schedule</p>
                <Input id="sched-name" label="Name" placeholder="Weekday mornings" value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={error('name')} />
                <fieldset className="space-y-1.5">
                    <legend className={labelClass}>Days</legend>
                    <div className="flex flex-wrap gap-3">
                        {DAYS.map((label, d) => (
                            <label key={label} className="flex items-center gap-1.5 text-sm text-slate-700">
                                <input type="checkbox" checked={form.days.includes(d)} onChange={() => toggleDay(d)} />
                                {label}
                            </label>
                        ))}
                    </div>
                    {error('daysOfWeek') && <p className={errorClass}>{error('daysOfWeek')}</p>}
                </fieldset>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <Input id="sched-first" label="First tee" type="time" value={form.firstTee}
                        onChange={(e) => setForm((f) => ({ ...f, firstTee: e.target.value }))} error={error('firstTee')} />
                    <Input id="sched-last" label="Last tee" type="time" value={form.lastTee}
                        onChange={(e) => setForm((f) => ({ ...f, lastTee: e.target.value }))} error={error('lastTee')} />
                    <Input id="sched-interval" label="Every (minutes)" type="number" min="5" max="300" value={form.interval}
                        onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))} error={error('intervalMinutes')} />
                    <Input id="sched-spots" label="Spots" type="number" min="1" max="4" value={form.spots}
                        onChange={(e) => setForm((f) => ({ ...f, spots: e.target.value }))} error={error('spots')} />
                    <Input id="sched-price" label={`Price per player (${course.currency})`} type="number" min="0" step="0.01" value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} error={error('pricePerPlayer')} />
                </div>
                <div className="flex justify-end">
                    <Button type="submit" size="sm" isLoading={saving}>Add schedule</Button>
                </div>
            </form>
        </div>
    );
}

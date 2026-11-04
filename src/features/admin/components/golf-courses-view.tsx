'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Eye, EyeOff, Flag, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { adminGolfApi } from '@/features/golf/api/golf.api';
import type { GolfCourse, GolfCourseDraft } from '@/features/golf/types';
import { GolfCourseForm, type FieldErrors } from '@/features/admin/components/golf-course-form';
import { GolfExtrasPanel } from '@/features/admin/components/golf-extras-panel';
import { GolfTeeTimesPanel } from '@/features/admin/components/golf-tee-times-panel';

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/**
 * The golf catalogue's back office (api-v2 `/admin/golf`). There is no supplier, so this is the one
 * place a course is written, and it reaches the storefront only when published.
 */
export function GolfCoursesView() {
    const [courses, setCourses]       = useState<GolfCourse[]>([]);
    const [total, setTotal]           = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage]             = useState(1);
    const [search, setSearch]         = useState('');
    const [query, setQuery]           = useState('');
    const [loading, setLoading]       = useState(true);
    const [loadError, setLoadError]   = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busyId, setBusyId]         = useState<string | null>(null);

    const [editing, setEditing]       = useState<GolfCourse | 'new' | null>(null);
    const [teeTimesOf, setTeeTimesOf] = useState<GolfCourse | null>(null);
    const [saving, setSaving]         = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [formError, setFormError]   = useState<string | null>(null);

    const load = useCallback(async (p: number, q: string) => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await adminGolfApi.list(p, q || undefined);
            setCourses(res.data ?? []);
            setTotal(res.total ?? 0);
            setTotalPages(res.totalPages ?? 1);
        } catch (err) {
            setLoadError(message(err, 'Failed to load golf courses.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(page, query); }, [page, query, load]);

    const openEditor = (target: GolfCourse | 'new') => {
        setEditing(target);
        setFieldErrors({});
        setFormError(null);
    };

    async function save(draft: GolfCourseDraft) {
        if (!editing) return;
        setSaving(true);
        setFieldErrors({});
        setFormError(null);
        try {
            if (editing === 'new') await adminGolfApi.create(draft);
            else await adminGolfApi.update(editing.id, draft);
            setEditing(null);
            await load(page, query);
        } catch (err) {
            // The dialog stays open with what was typed; the refusal goes beside its field.
            setFieldErrors((err as { body?: { details?: FieldErrors } }).body?.details ?? {});
            setFormError(message(err, 'Save failed.'));
        } finally {
            setSaving(false);
        }
    }

    async function act(course: GolfCourse, action: () => Promise<unknown>) {
        setBusyId(course.id);
        setActionError(null);
        try {
            await action();
            await load(page, query);
        } catch (err) {
            setActionError(message(err, 'That did not work.'));
        } finally {
            setBusyId(null);
        }
    }

    const toggleStatus = (c: GolfCourse) =>
        act(c, () => adminGolfApi.setStatus(c.id, c.status === 'published' ? 'draft' : 'published'));

    const remove = (c: GolfCourse) => {
        if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
        void act(c, () => adminGolfApi.remove(c.id));
    };

    return (
        <div className="space-y-3.5 px-5 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-base font-semibold text-slate-900">Golf Courses</h1>
                    <p className="mt-0.5 text-xs text-slate-500">{total > 0 ? `${total.toLocaleString()} total` : 'Courses the storefront can show'}</p>
                </div>
                <Button size="sm" onClick={() => openEditor('new')}><Plus size={14} /> Add course</Button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }} className="flex max-w-md items-end gap-2">
                <Input id="golf-search" icon={Search} placeholder="Search name, city or country…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" size="sm" className="shrink-0">Search</Button>
                {query && <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>Clear</Button>}
            </form>

            {actionError && <p role="alert" className="text-sm text-rose-600">{actionError}</p>}

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {loadError ? (
                    <div className="p-8 text-center text-sm text-rose-500">{loadError}</div>
                ) : loading ? (
                    <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : courses.length === 0 ? (
                    <div className="p-16 text-center">
                        <Flag size={36} className="mx-auto mb-3 text-slate-200" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">{query ? 'No courses match' : 'No golf courses yet'}</p>
                    </div>
                ) : (
                    <div className="max-h-[70vh] overflow-auto">
                        <table className="w-full text-[13px]">
                            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                                <tr>
                                    {['Course', 'Location', 'Holes', 'From', 'Status'].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                                    ))}
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {courses.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-1.5">
                                            <div className="flex items-center gap-3">
                                                {c.imageUrls[0] ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={c.imageUrls[0]} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                                                ) : (
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100"><Flag size={14} className="text-slate-400" /></div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-slate-900">{c.name}</p>
                                                    <p className="text-[11px] text-slate-400">/golf/{c.slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-600">{c.city}, {c.country}</td>
                                        <td className="px-3 py-1.5 text-slate-600">{c.holes}</td>
                                        <td className="px-3 py-1.5 text-slate-600">{c.greenFeeFrom != null ? `${c.currency} ${c.greenFeeFrom.toLocaleString()}` : '—'}</td>
                                        <td className="px-3 py-1.5">
                                            <Badge variant={c.status === 'published' ? 'success' : 'secondary'}>{c.status}</Badge>
                                            {c.status === 'draft' && !c.bookable && (
                                                <p className="mt-0.5 text-[11px] text-slate-400">Not bookable: needs a time zone and a schedule</p>
                                            )}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost" size="sm" disabled={busyId === c.id} onClick={() => toggleStatus(c)}
                                                    aria-label={c.status === 'published' ? `Unpublish ${c.name}` : `Publish ${c.name}`}
                                                    className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                                                >
                                                    {c.status === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </Button>
                                                <Button variant="ghost" size="sm" aria-label={`Tee times for ${c.name}`} onClick={() => setTeeTimesOf(c)} className="h-8 px-2 text-slate-600 hover:bg-slate-100"><Clock size={14} /></Button>
                                                <Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} onClick={() => openEditor(c)} className="h-8 px-2 text-blue-600 hover:bg-blue-50"><Pencil size={14} /></Button>
                                                <Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} disabled={busyId === c.id} onClick={() => remove(c)} className="h-8 px-2 text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {!loading && !loadError && totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft size={14} />}>Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight size={14} />}>Next</Button>
                    </div>
                </div>
            )}

            <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-lg">{editing === 'new' ? 'New golf course' : `Edit ${editing?.name ?? ''}`}</DialogTitle>
                    </DialogHeader>
                    {formError && <p role="alert" className="mb-3 text-sm text-rose-600">{formError}</p>}
                    {editing && (
                        <GolfCourseForm
                            key={editing === 'new' ? 'new' : editing.id}
                            course={editing === 'new' ? undefined : editing}
                            saving={saving}
                            errors={fieldErrors}
                            onSubmit={save}
                            onCancel={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={teeTimesOf !== null} onOpenChange={(open) => { if (!open) setTeeTimesOf(null); }}>
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-lg">{`Tee times — ${teeTimesOf?.name ?? ''}`}</DialogTitle>
                    </DialogHeader>
                    {/* Reloading the list keeps each row's schedule count and bookability current. */}
                    {teeTimesOf && (
                        <div key={teeTimesOf.id} className="space-y-6">
                            <GolfTeeTimesPanel course={teeTimesOf} onChanged={() => void load(page, query)} />
                            <GolfExtrasPanel course={teeTimesOf} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { adminGolfApi } from '@/features/golf/api/golf.api';
import { EXTRA_NAMES_EN, EXTRA_UNITS_EN } from '@/features/golf/lib/extras';
import { GOLF_EXTRAS, type GolfCourse, type GolfExtraCode, type GolfExtraOffer } from '@/features/golf/types';

type Rows = Record<GolfExtraCode, { offered: boolean; price: string }>;

const toRows = (offers: GolfExtraOffer[]): Rows => Object.fromEntries(GOLF_EXTRAS.map((code) => {
    const offer = offers.find((o) => o.code === code);
    return [code, { offered: Boolean(offer), price: offer ? String(offer.price) : '' }];
})) as Rows;

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/**
 * What customers can add to a tee time at this course, at a price per item (api-v2
 * `/admin/golf/courses/:id/extras`). Saving replaces the whole set; a booking keeps the prices it was
 * made at. English only: a staff screen.
 */
export function GolfExtrasPanel({ course }: { course: GolfCourse }) {
    const [rows, setRows] = useState<Rows | null>(null);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        adminGolfApi.listExtras(course.id)
            .then((offers) => { if (!cancelled) setRows(toRows(offers)); })
            .catch((err) => { if (!cancelled) setError(message(err, 'Could not load the extras.')); });
        return () => { cancelled = true; };
    }, [course.id]);

    const update = (code: GolfExtraCode, change: Partial<Rows[GolfExtraCode]>) => {
        setNotice(null);
        setRows((r) => r && { ...r, [code]: { ...r[code], ...change } });
    };

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!rows) return;
        setNotice(null);
        const offered = GOLF_EXTRAS.filter((code) => rows[code].offered);
        // An empty box would otherwise save as free.
        if (offered.some((code) => rows[code].price.trim() === '')) {
            setError('Give each extra you offer a price.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const saved = await adminGolfApi.setExtras(course.id, offered.map((code) => ({ code, price: Number(rows[code].price) })));
            setRows(toRows(saved));
            setNotice('Extras saved. Bookings already made keep their prices.');
        } catch (err) {
            setError(message(err, 'Could not save the extras.'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={save} className="space-y-4 border-t border-slate-200 pt-5">
            <div>
                <h3 className="text-sm font-bold text-slate-900">Extras</h3>
                <p className="text-xs text-slate-500">
                    What customers can add at checkout, up to one per player. Prices are per item in {course.currency}, and the team arranges them with the course.
                </p>
            </div>

            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
            {notice && <p role="status" className="text-sm text-emerald-600">{notice}</p>}

            {rows === null && !error ? (
                <Skeleton className="h-16 w-full" />
            ) : rows && (
                <>
                    <div className="space-y-2">
                        {GOLF_EXTRAS.map((code) => (
                            <div key={code} className="flex items-center gap-3">
                                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={rows[code].offered}
                                        onChange={(e) => update(code, { offered: e.target.checked })}
                                    />
                                    {EXTRA_NAMES_EN[code]}
                                </label>
                                <div className="w-40">
                                    <Input
                                        aria-label={`${EXTRA_NAMES_EN[code]} price, ${EXTRA_UNITS_EN[code]}, in ${course.currency}`}
                                        placeholder={EXTRA_UNITS_EN[code]}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        disabled={!rows[code].offered}
                                        value={rows[code].price}
                                        onChange={(e) => update(code, { price: e.target.value })}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" size="sm" isLoading={saving}>Save extras</Button>
                    </div>
                </>
            )}
        </form>
    );
}

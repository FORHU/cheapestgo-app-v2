'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { slugify } from '@/features/golf/lib/slugify';
import { GOLF_AMENITIES, GOLF_HOLES, type GolfAmenity, type GolfCourse, type GolfCourseDraft } from '@/features/golf/types';

/** api-v2's refusals, by field: a 422's `details`, or a 409's for a taken slug. */
export type FieldErrors = Partial<Record<keyof GolfCourseDraft, string[]>>;

interface Props {
    /** The course being edited; absent for a new one. */
    course?:  GolfCourse;
    saving:   boolean;
    errors:   FieldErrors;
    onSubmit: (draft: GolfCourseDraft) => void;
    onCancel: () => void;
}

interface FormState {
    name: string; country: string; city: string; slug: string; address: string; description: string;
    holes: string; par: string; greenFeeFrom: string; currency: string; imageUrls: string; amenities: GolfAmenity[];
}

const fromCourse = (c?: GolfCourse): FormState => ({
    name:         c?.name ?? '',
    country:      c?.country ?? '',
    city:         c?.city ?? '',
    slug:         c?.slug ?? '',
    address:      c?.address ?? '',
    description:  c?.description ?? '',
    holes:        String(c?.holes ?? 18),
    par:          c?.par != null ? String(c.par) : '',
    greenFeeFrom: c?.greenFeeFrom != null ? String(c.greenFeeFrom) : '',
    currency:     c?.currency ?? 'USD',
    imageUrls:    (c?.imageUrls ?? []).join('\n'),
    amenities:    c?.amenities ?? [],
});

/** The form's strings as api-v2 takes them. It checks everything again; this only shapes it. */
const toDraft = (f: FormState): GolfCourseDraft => ({
    slug:         f.slug.trim(),
    name:         f.name.trim(),
    country:      f.country.trim(),
    city:         f.city.trim(),
    address:      f.address.trim() || null,
    description:  f.description.trim(),
    holes:        Number(f.holes),
    par:          f.par.trim() ? Number(f.par) : null,
    greenFeeFrom: f.greenFeeFrom.trim() ? Number(f.greenFeeFrom) : null,
    currency:     f.currency.trim().toUpperCase(),
    imageUrls:    f.imageUrls.split('\n').map((u) => u.trim()).filter(Boolean),
    amenities:    f.amenities,
});

const boxClass   = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:border-blue-500 focus-visible:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white';
const labelClass = 'ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400/80';
const errorClass = 'ml-1 text-[10px] font-bold text-rose-500';

/** Create or edit one golf course. English only: it is a staff screen. */
export function GolfCourseForm({ course, saving, errors, onSubmit, onCancel }: Props) {
    const amenityLabel = useTranslations('golf.amenities');
    const [form, setForm] = useState<FormState>(() => fromCourse(course));
    // A new course's slug follows its name and city until someone types one. An existing course
    // keeps the slug its links already use.
    const [slugTyped, setSlugTyped] = useState(Boolean(course));

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => {
            const next = { ...f, [key]: value };
            if (!slugTyped && (key === 'name' || key === 'city')) next.slug = slugify(next.name, next.city);
            return next;
        });

    const error = (key: keyof GolfCourseDraft) => errors[key]?.[0];

    const toggle = (a: GolfAmenity) =>
        set('amenities', form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]);

    return (
        <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(toDraft(form)); }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input id="golf-name" label="Name *" value={form.name} onChange={(e) => set('name', e.target.value)} error={error('name')} />
                <Input
                    id="golf-slug" label="Slug" placeholder="made from the name and city" value={form.slug}
                    onChange={(e) => { setSlugTyped(true); set('slug', e.target.value); }} error={error('slug')}
                />
                <Input id="golf-city" label="City *" value={form.city} onChange={(e) => set('city', e.target.value)} error={error('city')} />
                <Input id="golf-country" label="Country *" value={form.country} onChange={(e) => set('country', e.target.value)} error={error('country')} />
                <Input id="golf-address" label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} error={error('address')} />
                <div className="space-y-1.5">
                    <label htmlFor="golf-holes" className={labelClass}>Holes *</label>
                    <select id="golf-holes" value={form.holes} onChange={(e) => set('holes', e.target.value)} className={`${boxClass} h-11`}>
                        {GOLF_HOLES.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {error('holes') && <p className={errorClass}>{error('holes')}</p>}
                </div>
                <Input id="golf-par" label="Par" type="number" value={form.par} onChange={(e) => set('par', e.target.value)} error={error('par')} />
                <Input
                    id="golf-fee" label="Green fee from" type="number" min="0" step="0.01" value={form.greenFeeFrom}
                    onChange={(e) => set('greenFeeFrom', e.target.value)} error={error('greenFeeFrom')}
                />
                <Input id="golf-currency" label="Currency" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value)} error={error('currency')} />
            </div>

            <div className="space-y-1.5">
                <label htmlFor="golf-images" className={labelClass}>Image URLs — one per line, the first is the cover</label>
                <textarea id="golf-images" rows={3} value={form.imageUrls} onChange={(e) => set('imageUrls', e.target.value)} className={boxClass} />
                {error('imageUrls') && <p className={errorClass}>{error('imageUrls')}</p>}
            </div>

            <div className="space-y-1.5">
                <label htmlFor="golf-description" className={labelClass}>Description — a blank line starts a new paragraph</label>
                <textarea id="golf-description" rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} className={boxClass} />
                {error('description') && <p className={errorClass}>{error('description')}</p>}
            </div>

            <fieldset className="space-y-2">
                <legend className={labelClass}>Amenities</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {GOLF_AMENITIES.map((a) => (
                        <label key={a} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                            <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggle(a)} />
                            {amenityLabel(a)}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
                <Button type="submit" size="sm" isLoading={saving}>{course ? 'Save' : 'Create'}</Button>
            </div>
        </form>
    );
}

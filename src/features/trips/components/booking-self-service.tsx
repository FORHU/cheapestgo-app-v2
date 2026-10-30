'use client';

/**
 * The two things a traveller can do to a booking after paying for it, short of
 * cancelling: change what they have asked the property for, and send the confirmation
 * to someone else.
 *
 * Both were in v1 and neither reached v2, so a v2 booking could be made and then only
 * looked at. They live together because they are the same shape — a small form against
 * one booking — and they share the panel the rest of the booking detail is built from
 * (`DetailPanel`).
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Mail, MessageSquarePlus } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { http } from '@/shared/lib/http';
import { cn } from '@/shared/lib/cn';
import { ACTION, CHIP, DetailPanel, MUTED } from './booking-card-parts';

/** The card's own primary action — the gradient pill — for a form's one button. */
const SUBMIT = cn(ACTION, CHIP, 'disabled:pointer-events-none disabled:opacity-60');

/** The message of an error the API reported, or a fallback the reader can act on. */
const messageOf = (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback;

// ─── Special requests ─────────────────────────────────────────────────────────

export function SpecialRequestsForm({ booking }: {
    booking: { booking_id?: string; id: string; holder_first_name?: string; holder_last_name?: string; holder_email?: string; special_requests?: string };
}) {
    const t = useTranslations();
    const [remarks, setRemarks] = useState(booking.special_requests ?? '');
    const [saving, setSaving]   = useState(false);
    const [error, setError]     = useState<string | null>(null);
    const [saved, setSaved]     = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true); setError(null); setSaved(false);
        try {
            await http.post('/bookings/amend', {
                bookingId: booking.booking_id ?? booking.id,
                firstName: booking.holder_first_name ?? '',
                lastName:  booking.holder_last_name ?? '',
                email:     booking.holder_email ?? '',
                remarks:   remarks.trim(),
            });
            setSaved(true);
        } catch (err) {
            setError(messageOf(err, t('trips.requestsForm.saveError')));
        } finally {
            setSaving(false);
        }
    }

    return (
        <DetailPanel title={t('trips.requestsForm.title')} icon={MessageSquarePlus}>
            <form onSubmit={submit} className="space-y-3 py-1">
                <textarea
                    value={remarks}
                    onChange={(e) => { setRemarks(e.target.value); setSaved(false); }}
                    rows={4}
                    maxLength={1000}
                    placeholder={t('trips.requestsForm.placeholder')}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:outline-none dark:border-white/10 dark:bg-white/5 dark:placeholder:text-slate-500"
                />
                {/* The property decides, not us — promising an accepted request is how a
                    guest arrives expecting a cot that was never confirmed. */}
                <p className={cn('text-[12px]', MUTED)}>{t('documents.voucher.requestsNotGuaranteed')}</p>
                {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
                {saved && (
                    <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={15} /> {t('trips.requestsForm.saved')}
                    </p>
                )}
                <button type="submit" disabled={saving} className={SUBMIT}>{t('trips.requestsForm.submit')}</button>
            </form>
        </DetailPanel>
    );
}

// ─── Share the confirmation ───────────────────────────────────────────────────

export function ShareBookingForm({ bookingId, defaultEmail }: { bookingId: string; defaultEmail?: string }) {
    const t = useTranslations();
    const [email, setEmail]   = useState(defaultEmail ?? '');
    const [sending, setSending] = useState(false);
    const [error, setError]   = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSending(true); setError(null); setSentTo(null);
        try {
            await http.post(`/bookings/${bookingId}/share`, { email: email.trim() });
            setSentTo(email.trim());
        } catch (err) {
            setError(messageOf(err, t('trips.shareForm.sendError')));
        } finally {
            setSending(false);
        }
    }

    return (
        <DetailPanel title={t('trips.shareForm.title')} icon={Mail}>
            <form onSubmit={submit} className="space-y-3 py-1">
                <p className={cn('text-[13px]', MUTED)}>{t('trips.shareForm.blurb')}</p>
                <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setSentTo(null); }}
                    placeholder={t('auth.emailPlaceholder')}
                    aria-label={t('trips.shareForm.sendTo')}
                />
                {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
                {sentTo && (
                    <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={15} /> {t('trips.shareForm.sent', { email: sentTo })}
                    </p>
                )}
                <button type="submit" disabled={sending} className={SUBMIT}>{t('trips.shareForm.submit')}</button>
            </form>
        </DetailPanel>
    );
}

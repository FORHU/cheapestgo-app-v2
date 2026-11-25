'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { money } from '@/features/golf/lib/format';
import {
    FAMILY_MEMBERSHIP_ID, golfServiceDateIsValid, golfServiceDetail, golfServiceFamilyMembersIsValid,
    golfServiceLines, golfServiceLineTotal, golfServicePartySizeIsValid,
    type GolfServiceDetail, type GolfServiceLine, type SelectedGolfService,
} from '@/features/golf/lib/golf-services-pricing';
import { golfMockApi } from '@/features/golf-api-demo/api/golfMockApi.client';
import { GOLF_SERVICE_CATEGORIES } from '@/features/golf-api-demo/types';
import type { MockService } from '@/features/golf-api-demo/types';

const STEP_INPUT = 'w-20 text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white';
const TEXT_INPUT = 'flex-1 text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white';
const LABEL = 'text-[11px] font-medium text-slate-500 dark:text-slate-400 w-24 shrink-0';
const ADD_BUTTON = 'inline-flex h-8 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-500 hover:text-blue-500 dark:border-white/15 dark:text-slate-300';
const PRIMARY_BUTTON = 'inline-flex h-7 items-center justify-center rounded-full bg-blue-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700';
const REMOVE_BUTTON = 'inline-flex h-7 items-center justify-center rounded-full border border-rose-200 px-3 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-400 dark:hover:bg-rose-400/10';
const DESTRUCTIVE_BUTTON = 'inline-flex h-7 items-center justify-center rounded-full bg-rose-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700';

const DEFAULT_SELECTION = (serviceId: string): SelectedGolfService => ({
    serviceId, quantity: 1, preferredDate: '', partySize: undefined, notes: '',
    // The full package by default, so leaving these untouched keeps the original $2,000 price.
    ...(serviceId === FAMILY_MEMBERSHIP_ID ? { adults: 2, juniors: 3 } : {}),
});

type ServiceStatus = 'configuring' | 'confirmed' | 'editing';

interface ServiceEntry {
    status:    ServiceStatus;
    /** The form's current values. Equal to `confirmed` except while actively editing. */
    draft:     SelectedGolfService;
    /** The committed configuration — null only before the first Confirm. The invoice/total and
     *  the eventual booking submission read this, never `draft`, so a half-finished edit can
     *  never leak into either. */
    confirmed: SelectedGolfService | null;
}

/** "2 hours" / "2 × $15.00" / "15 guests" — the same detail shown on the invoice, recapped here once a service is confirmed. */
function formatDetail(detail: GolfServiceDetail, t: (key: string, values?: Record<string, number>) => string, locale: string): string | null {
    switch (detail.kind) {
        case 'product':   return `${detail.quantity} × ${money(detail.unitPrice, detail.currency, locale)}`;
        case 'unitCount': return t(`unitLabel.${detail.unitNoun}`, { count: detail.quantity });
        case 'guests':    return t('unitLabel.guest', { count: detail.partySize });
        case 'familyMembers': return `${t('unitLabel.adult', { count: detail.adults })}, ${t('unitLabel.junior', { count: detail.juniors })}`;
        case 'none':      return null;
    }
}

/**
 * api-v2's Golf Services catalog (lessons, club fitting, equipment, tournaments, memberships,
 * simulation, corporate events) — the same `/api/v1/golf/services` module and `golfMockApi`
 * client the admin demo page uses, reused here rather than duplicated.
 *
 * Each service moves through `configuring` (just added, fields open) → `confirmed` (collapsed,
 * Edit/Remove) → optionally `editing` (fields reopen from a copy of the confirmed configuration,
 * Save Changes/Cancel) → back to `confirmed`. Only a `confirmed` configuration is ever reported
 * upward via `onSelectionChange` — `GolfBookView` reads the derived `GolfServiceLine[]` to drive
 * the booking summary's invoice/total, and is the one place that actually calls
 * `golfMockApi.bookService`, once the tee time's own hold is taken — the same moment extras lock
 * in. Confirming here is pure local state: it never calls the API by itself. Nothing here is
 * added to `load.quote.total` or sent to Stripe: see GolfBookView for how the real and simulated
 * totals are kept honestly separate.
 */
export function GolfServicesPicker({ currency, onSelectionChange }: { currency: string; onSelectionChange: (lines: GolfServiceLine[]) => void }) {
    const t = useTranslations('golf.booking.services');
    const locale = useLocale();

    const [services, setServices] = useState<MockService[] | null>(null);
    const [rateUnavailable, setRateUnavailable] = useState(false);
    const [entries, setEntries] = useState<Record<string, ServiceEntry>>({});
    const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
    /** Services for which Confirm/Save Changes was tried while the preferred date and/or
     *  participant count was missing or invalid — gates the warnings so neither shows before the
     *  customer has actually tried. */
    const [confirmAttemptedFor, setConfirmAttemptedFor] = useState<Set<string>>(new Set());

    // Re-fetches the catalog, already converted into `currency`, whenever the header's currency
    // changes — selections live in their own state below and are untouched by this. Never resets
    // `services` to null first: the previous prices stay on screen until the new ones arrive,
    // instead of flashing the loading skeleton on every currency change.
    useEffect(() => {
        golfMockApi.listServices({ currency })
            .then((r) => { setServices(r.data.services); setRateUnavailable(Boolean(r.data.rateUnavailable)); })
            .catch(() => { setServices((s) => s ?? []); setRateUnavailable(true); });
    }, [currency]);

    const confirmedSelections = useMemo(() => {
        const out: Record<string, SelectedGolfService> = {};
        for (const [id, entry] of Object.entries(entries)) if (entry.confirmed) out[id] = entry.confirmed;
        return out;
    }, [entries]);

    useEffect(() => {
        onSelectionChange(services ? golfServiceLines(services, confirmedSelections) : []);
        // onSelectionChange is a fresh closure from the parent every render; only the catalog and
        // the confirmed selections themselves should re-trigger this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [services, confirmedSelections]);

    if (services !== null && services.length === 0) return null;

    function select(service: MockService) {
        setEntries((s) => ({ ...s, [service.id]: { status: 'configuring', draft: DEFAULT_SELECTION(service.id), confirmed: null } }));
    }

    function updateDraft(serviceId: string, patch: Partial<SelectedGolfService>) {
        setEntries((s) => (s[serviceId] ? { ...s, [serviceId]: { ...s[serviceId], draft: { ...s[serviceId].draft, ...patch } } } : s));
    }

    function confirmEntry(serviceId: string) {
        setEntries((s) => (s[serviceId] ? { ...s, [serviceId]: { ...s[serviceId], status: 'confirmed', confirmed: { ...s[serviceId].draft } } } : s));
    }

    /** Confirm / Save Changes go through here: a missing or invalid required date or participant
     *  count blocks the commit and surfaces the relevant warning(s) instead, rather than silently
     *  confirming an incomplete configuration — api-v2 would refuse it anyway, but the customer
     *  should never get that far. */
    function tryConfirm(service: MockService, serviceId: string) {
        const draft = entries[serviceId]?.draft;
        if (!draft || !canConfirm(service, draft)) {
            setConfirmAttemptedFor((s) => new Set(s).add(serviceId));
            return;
        }
        confirmEntry(serviceId);
    }

    function canConfirm(service: MockService, selection: SelectedGolfService): boolean {
        return golfServiceDateIsValid(service, selection) && golfServicePartySizeIsValid(service, selection) && golfServiceFamilyMembersIsValid(service, selection);
    }

    function startEdit(serviceId: string) {
        setEntries((s) => {
            const e = s[serviceId];
            if (!e?.confirmed) return s;
            return { ...s, [serviceId]: { ...e, status: 'editing', draft: { ...e.confirmed } } };
        });
    }

    function cancelEdit(serviceId: string) {
        setEntries((s) => {
            const e = s[serviceId];
            if (!e?.confirmed) return s;
            return { ...s, [serviceId]: { ...e, status: 'confirmed', draft: { ...e.confirmed } } };
        });
    }

    function removeEntry(serviceId: string) {
        setEntries((s) => {
            const next = { ...s };
            delete next[serviceId];
            return next;
        });
        setConfirmingRemoveId(null);
    }

    const actionLabel: Record<MockService['bookingMode'], string> = {
        product: t('actionBuy'), appointment: t('actionBook'), inquiry: t('actionRequest'),
    };

    return (
        <section aria-labelledby="golf-services-title" className="rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900">
            <h2 id="golf-services-title" className="text-base font-bold text-slate-900 dark:text-slate-50">{t('heading')}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('hint')}</p>
            {rateUnavailable && currency !== 'USD' && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">{t('rateUnavailableNote')}</p>
            )}

            {services === null ? (
                <div className="mt-3 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-9 w-full animate-pulse rounded-md bg-slate-100 dark:bg-white/5" />)}
                </div>
            ) : (
                <div className="mt-3 space-y-4">
                    {GOLF_SERVICE_CATEGORIES.map((category) => {
                        const items = services.filter((s) => s.category === category);
                        if (items.length === 0) return null;
                        return (
                            <div key={category}>
                                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                    {t(`categories.${category}`)}
                                </p>
                                <ul className="space-y-2">
                                    {items.map((service) => {
                                        const entry = entries[service.id];
                                        const isSelected = entry !== undefined;
                                        const isConfiguring = entry?.status === 'configuring' || entry?.status === 'editing';
                                        const isConfirmed = entry?.status === 'confirmed';
                                        const isRemoving = confirmingRemoveId === service.id;
                                        const draftTotal = entry && isConfiguring ? golfServiceLineTotal(service, entry.draft) : null;
                                        const confirmedTotal = entry?.confirmed ? golfServiceLineTotal(service, entry.confirmed) : null;
                                        const confirmedDetail = entry?.confirmed ? formatDetail(golfServiceDetail(service, entry.confirmed), t, locale) : null;

                                        return (
                                            <li
                                                key={service.id}
                                                className={isSelected
                                                    ? 'rounded-xl border-2 border-blue-500 bg-blue-50/60 p-3 dark:border-blue-400 dark:bg-blue-400/10'
                                                    : 'rounded-xl border border-slate-100 p-3 dark:border-white/10'}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                                                            {isConfirmed && <Check size={14} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />}
                                                            {service.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{service.description}</p>
                                                        <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                            {service.price != null ? `${money(service.price, service.currency, locale)} · ${service.unit}` : t('quote')}
                                                        </p>
                                                    </div>
                                                    {!isSelected && (
                                                        <button type="button" onClick={() => select(service)} className={ADD_BUTTON}>
                                                            {actionLabel[service.bookingMode]}
                                                        </button>
                                                    )}
                                                </div>

                                                {isRemoving && (
                                                    <div className="mt-3 space-y-2 border-t border-blue-200/60 pt-3 dark:border-blue-400/20">
                                                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{t('removeConfirmQuestion')}</p>
                                                        <div className="flex gap-2">
                                                            <button type="button" onClick={() => setConfirmingRemoveId(null)} className={ADD_BUTTON}>{t('keepService')}</button>
                                                            <button type="button" onClick={() => removeEntry(service.id)} className={DESTRUCTIVE_BUTTON}>{t('removeService')}</button>
                                                        </div>
                                                    </div>
                                                )}

                                                {!isRemoving && isConfirmed && entry.confirmed && (
                                                    <div className="mt-3 space-y-1 border-t border-blue-200/60 pt-3 dark:border-blue-400/20">
                                                        <div className="flex items-center gap-2">
                                                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                                                {t('confirmed')}
                                                            </span>
                                                            {confirmedDetail && <span className="text-xs text-slate-600 dark:text-slate-300">{confirmedDetail}</span>}
                                                        </div>
                                                        {entry.confirmed.preferredDate && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('preferredDate')}: {entry.confirmed.preferredDate}</p>
                                                        )}
                                                        {entry.confirmed.notes && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('notes')}: {entry.confirmed.notes}</p>
                                                        )}
                                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                            {confirmedTotal != null ? `${t('subtotal')}: ${money(confirmedTotal, service.currency, locale)}` : t('quotePending')}
                                                        </p>
                                                        <div className="flex gap-2 pt-1">
                                                            <button type="button" onClick={() => startEdit(service.id)} className={ADD_BUTTON}>{t('editButton')}</button>
                                                            <button type="button" onClick={() => setConfirmingRemoveId(service.id)} className={REMOVE_BUTTON}>{t('remove')}</button>
                                                        </div>
                                                    </div>
                                                )}

                                                {!isRemoving && isConfiguring && entry && (() => {
                                                    const selection = entry.draft;
                                                    const quantityLabel = service.bookingMode === 'product' ? t('quantity')
                                                        : service.bookingMode === 'appointment' ? (service.unit === 'per hour' ? t('hours') : t('sessions'))
                                                        : service.unit === 'per team' ? t('teams')
                                                        : service.unit === 'per year' ? t('years')
                                                        : t('entries');
                                                    const n = (label: string) => `${label} — ${service.name}`;
                                                    return (
                                                        <div className="mt-3 space-y-2 border-t border-blue-200/60 pt-3 dark:border-blue-400/20">
                                                            {service.id !== FAMILY_MEMBERSHIP_ID && (service.bookingMode === 'product' || service.bookingMode === 'appointment' || (service.bookingMode === 'inquiry' && service.price != null)) && (
                                                                <div className="flex items-center gap-2">
                                                                    <label className={LABEL} htmlFor={`qty-${service.id}`}>{quantityLabel}</label>
                                                                    <input id={`qty-${service.id}`} aria-label={n(quantityLabel)} type="number" min={1} max={20} value={selection.quantity}
                                                                        onChange={(e) => updateDraft(service.id, { quantity: Number(e.target.value) || 0 })}
                                                                        className={STEP_INPUT} />
                                                                </div>
                                                            )}
                                                            {(service.bookingMode === 'appointment' || service.bookingMode === 'inquiry') && (() => {
                                                                const dateInvalid = confirmAttemptedFor.has(service.id) && !golfServiceDateIsValid(service, selection);
                                                                return (
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className={LABEL} htmlFor={`date-${service.id}`}>{t('preferredDate')}</label>
                                                                            <input id={`date-${service.id}`} aria-label={n(t('preferredDate'))} aria-invalid={dateInvalid} type="date" value={selection.preferredDate ?? ''}
                                                                                onChange={(e) => updateDraft(service.id, { preferredDate: e.target.value })}
                                                                                className={dateInvalid ? `${STEP_INPUT} border-rose-500 dark:border-rose-400` : STEP_INPUT} />
                                                                        </div>
                                                                        {dateInvalid && (
                                                                            <p role="alert" className="mt-1 ml-[6.5rem] text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                                                                {service.category === 'membership' ? t('preferredDateRequiredMembership') : t('preferredDateRequired')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            {service.bookingMode === 'inquiry' && service.category !== 'membership' && (() => {
                                                                const partySizeInvalid = confirmAttemptedFor.has(service.id) && !golfServicePartySizeIsValid(service, selection);
                                                                return (
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className={LABEL} htmlFor={`party-${service.id}`}>{t('partySize')}</label>
                                                                            <input id={`party-${service.id}`} aria-label={n(t('partySize'))} aria-invalid={partySizeInvalid} type="number" min={1} max={500} value={selection.partySize ?? ''}
                                                                                onChange={(e) => updateDraft(service.id, { partySize: e.target.value ? Number(e.target.value) : undefined })}
                                                                                className={partySizeInvalid ? `${STEP_INPUT} border-rose-500 dark:border-rose-400` : STEP_INPUT} />
                                                                        </div>
                                                                        {partySizeInvalid && (
                                                                            <p role="alert" className="mt-1 ml-[6.5rem] text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                                                                {t('partySizeRequired')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            {service.id === FAMILY_MEMBERSHIP_ID && (() => {
                                                                const familyInvalid = confirmAttemptedFor.has(service.id) && !golfServiceFamilyMembersIsValid(service, selection);
                                                                return (
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className={LABEL} htmlFor={`adults-${service.id}`}>{t('numberOfAdults')}</label>
                                                                            <input id={`adults-${service.id}`} aria-label={n(t('numberOfAdults'))} aria-invalid={familyInvalid} type="number" min={1} value={selection.adults ?? 2}
                                                                                onChange={(e) => updateDraft(service.id, { adults: Number(e.target.value) || 0 })}
                                                                                className={familyInvalid ? `${STEP_INPUT} border-rose-500 dark:border-rose-400` : STEP_INPUT} />
                                                                        </div>
                                                                        <div className="mt-2 flex items-center gap-2">
                                                                            <label className={LABEL} htmlFor={`juniors-${service.id}`}>{t('numberOfJuniors')}</label>
                                                                            <input id={`juniors-${service.id}`} aria-label={n(t('numberOfJuniors'))} aria-invalid={familyInvalid} type="number" min={0} value={selection.juniors ?? 3}
                                                                                onChange={(e) => updateDraft(service.id, { juniors: Number(e.target.value) || 0 })}
                                                                                className={familyInvalid ? `${STEP_INPUT} border-rose-500 dark:border-rose-400` : STEP_INPUT} />
                                                                        </div>
                                                                        {familyInvalid && (
                                                                            <p role="alert" className="mt-1 ml-[6.5rem] text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                                                                {t('familyMembersInvalid')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            <div className="flex items-center gap-2">
                                                                <label className={LABEL} htmlFor={`notes-${service.id}`}>{t('notes')}</label>
                                                                <input id={`notes-${service.id}`} aria-label={n(t('notes'))} type="text" value={selection.notes ?? ''}
                                                                    onChange={(e) => updateDraft(service.id, { notes: e.target.value })}
                                                                    placeholder={t('notesPlaceholder')}
                                                                    className={TEXT_INPUT} />
                                                            </div>
                                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                                {draftTotal != null ? `${t('subtotal')}: ${money(draftTotal, service.currency, locale)}` : t('quotePending')}
                                                            </p>
                                                            <div className="flex gap-2 pt-1">
                                                                {entry.status === 'configuring' ? (
                                                                    <button type="button" onClick={() => tryConfirm(service, service.id)}
                                                                        aria-disabled={!canConfirm(service, selection)}
                                                                        className={canConfirm(service, selection) ? PRIMARY_BUTTON : `${PRIMARY_BUTTON} cursor-not-allowed opacity-50`}>
                                                                        {t('confirmButton')}
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <button type="button" onClick={() => tryConfirm(service, service.id)}
                                                                            aria-disabled={!canConfirm(service, selection)}
                                                                            className={canConfirm(service, selection) ? PRIMARY_BUTTON : `${PRIMARY_BUTTON} cursor-not-allowed opacity-50`}>
                                                                            {t('saveChanges')}
                                                                        </button>
                                                                        <button type="button" onClick={() => cancelEdit(service.id)} className={ADD_BUTTON}>{t('cancel')}</button>
                                                                    </>
                                                                )}
                                                                {entry.status === 'configuring' && (
                                                                    <button type="button" onClick={() => setConfirmingRemoveId(service.id)} className={REMOVE_BUTTON}>{t('remove')}</button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

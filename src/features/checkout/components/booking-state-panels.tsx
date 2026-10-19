'use client';

/**
 * What the checkout says when it is not in the happy path.
 *
 * Until now every one of these was a red sentence in the same box with the same single button:
 * a room that had sold out, a price that moved, a supplier that did not answer, a booking that
 * was still being made. Each of them has a different thing the traveller should do next —
 * and, above all, a different answer to the question they are actually asking, which is
 * "have I been charged?". These panels exist to answer that one honestly:
 *
 *   price moved       not yet — here is the new figure, and a choice
 *   room gone         no — and retrying cannot help
 *   supplier down     no — nothing is wrong, try again
 *   settling          no, and you will not be charged twice — keep this open
 *   needs review      held, not taken — we will email you either way
 *   failed (released) no — the hold has been released
 *   failed (unknown)  we cannot tell you — look at your trips before trying again
 *
 * The last row is the one worth care. "You have not been charged" is only ever said when the
 * server said the hold was released; otherwise the panel says it does not know.
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Palette } from '../lib/palette';
import { ACCENT, DANGER, GREEN } from '../lib/palette';

// ─── Shared ───────────────────────────────────────────────────────────────────

/** An amount in its currency, whole units where the currency has no minor unit. */
function money(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString()}`;
    }
}

function Panel({
    palette, tone, role, icon: Icon, title, children,
}: {
    palette:  Palette;
    tone:     string;
    role:     'alert' | 'status' | 'note';
    icon:     typeof AlertTriangle;
    title:    string;
    children: React.ReactNode;
}) {
    return (
        <section
            role={role}
            style={{
                background: palette.surface, borderRadius: 12, padding: 'clamp(18px,2.6vw,28px)',
                border: `1.5px solid ${tone}`, marginBottom: 20, color: palette.text,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Icon size={22} strokeWidth={1.9} color={tone} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: palette.title }}>{title}</h2>
                    {children}
                </div>
            </div>
        </section>
    );
}

function Body({ palette, children }: { palette: Palette; children: React.ReactNode }) {
    return <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: palette.soft }}>{children}</p>;
}

function Actions({ children }: { children: React.ReactNode }) {
    return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>{children}</div>;
}

function Button({
    palette, onClick, children, kind = 'primary', disabled,
}: {
    palette: Palette; onClick: () => void; children: React.ReactNode; kind?: 'primary' | 'quiet'; disabled?: boolean;
}) {
    const primary = kind === 'primary';
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '11px 20px', borderRadius: 999, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
                border: primary ? 'none' : `1.5px solid ${palette.cardLine}`,
                background: primary ? palette.title : 'transparent',
                color: primary ? palette.bg : palette.title,
            }}
        >
            {children}
        </button>
    );
}

// ─── Price moved ──────────────────────────────────────────────────────────────

export function PriceMovedPanel({
    change, palette, refreshing, onAccept, onChooseAnother,
}: {
    /** Absent while the new figure is still being fetched. */
    change?:        { previous: number; current: number; direction: 'up' | 'down'; currency: string };
    palette:        Palette;
    refreshing?:    boolean;
    onAccept:       () => void;
    onChooseAnother: () => void;
}) {
    const t = useTranslations('checkout');
    const waiting = refreshing || !change;

    return (
        <Panel palette={palette} tone={ACCENT} role="alert" icon={AlertTriangle} title={t('priceMoved.title')}>
            {change && (
                <>
                    <Body palette={palette}>{change.direction === 'up' ? t('priceMoved.up') : t('priceMoved.down')}</Body>
                    <div style={{ display: 'flex', gap: 28, marginTop: 14, fontSize: 14 }}>
                        <div>
                            <div style={{ color: palette.muted, fontSize: 12 }}>{t('priceMoved.was')}</div>
                            <div style={{ textDecoration: 'line-through', color: palette.soft }}>{money(change.previous, change.currency)}</div>
                        </div>
                        <div>
                            <div style={{ color: palette.muted, fontSize: 12 }}>{t('priceMoved.now')}</div>
                            <div style={{ fontWeight: 700, color: palette.title }}>{money(change.current, change.currency)}</div>
                        </div>
                    </div>
                </>
            )}
            {waiting && <Body palette={palette}>{t('priceMoved.refreshing')}</Body>}
            <Actions>
                <Button palette={palette} onClick={onAccept} disabled={waiting}>{t('priceMoved.accept')}</Button>
                <Button palette={palette} kind="quiet" onClick={onChooseAnother}>{t('priceMoved.chooseAnother')}</Button>
            </Actions>
        </Panel>
    );
}

// ─── Room gone / not payable online ───────────────────────────────────────────

export function RoomUnavailablePanel({
    kind, palette, onChooseAnother,
}: {
    kind: 'unavailable' | 'not_payable_online';
    palette: Palette;
    onChooseAnother: () => void;
}) {
    const t = useTranslations('checkout');
    const ns = kind === 'unavailable' ? 'unavailable' : 'notPayableOnline';

    return (
        <Panel palette={palette} tone={DANGER} role="alert" icon={AlertTriangle} title={t(`${ns}.title`)}>
            <Body palette={palette}>{t(`${ns}.description`)}</Body>
            <Actions>
                <Button palette={palette} onClick={onChooseAnother}>{t(`${ns}.chooseAnother`)}</Button>
            </Actions>
        </Panel>
    );
}

// ─── Supplier did not answer ──────────────────────────────────────────────────

export function SupplierDownPanel({
    palette, onRetry, busy,
}: { palette: Palette; onRetry: () => void; busy?: boolean }) {
    const t = useTranslations('checkout');
    return (
        <Panel palette={palette} tone={ACCENT} role="alert" icon={Info} title={t('supplierDown.title')}>
            <Body palette={palette}>{t('supplierDown.description')}</Body>
            <Actions>
                <Button palette={palette} onClick={onRetry} disabled={busy}>{t('supplierDown.retry')}</Button>
            </Actions>
        </Panel>
    );
}

// ─── Booking in progress / awaiting review ────────────────────────────────────

export function SettlingPanel({
    phase, reference, palette, onViewTrips, kind = 'hotel',
}: {
    phase:      'pending' | 'needs_review';
    reference?: string;
    palette:    Palette;
    onViewTrips: () => void;
    /**
     * Whose confirmation is awaited. A flight under review is never told its card was not
     * charged: one whose booking could not be recorded after capture is under review too.
     */
    kind?:      'hotel' | 'flight';
}) {
    const t = useTranslations('checkout');
    const review = phase === 'needs_review';
    const ns = kind === 'flight' ? 'flight.' : '';

    return (
        <Panel
            palette={palette} tone={review ? ACCENT : GREEN} role="status" icon={Clock}
            title={review ? t(`${ns}needsReview.title`) : t('settling.title')}
        >
            <Body palette={palette}>{review ? t(`${ns}needsReview.description`) : t(`${ns}settling.description`)}</Body>
            <Body palette={palette}>{t('settling.doNotPayAgain')}</Body>
            {reference && (
                <Body palette={palette}>
                    {t('bookingReference')}: <strong style={{ color: palette.title, userSelect: 'all' }}>{reference}</strong>
                </Body>
            )}
            <Actions>
                <Button palette={palette} kind="quiet" onClick={onViewTrips}>{t('settling.checkTrips')}</Button>
            </Actions>
        </Panel>
    );
}

// ─── Failed ───────────────────────────────────────────────────────────────────

export function BookingFailedPanel({
    released, message, palette, onTryAgain,
}: {
    /** The server said the authorisation was voided. Never inferred. */
    released:   boolean;
    message:    string;
    palette:    Palette;
    onTryAgain: () => void;
}) {
    const t = useTranslations('checkout');
    return (
        <Panel palette={palette} tone={DANGER} role="alert" icon={AlertTriangle} title={t('failed.title')}>
            <Body palette={palette}>{message}</Body>
            <Body palette={palette}>{released ? t('failed.released') : t('failed.unknown')}</Body>
            <Actions>
                <Button palette={palette} onClick={onTryAgain}>{t('failed.tryAgain')}</Button>
            </Actions>
        </Panel>
    );
}

// ─── Several rooms ────────────────────────────────────────────────────────────

/**
 * The search builds one occupancy for the whole party and the booking sends one room, so a
 * multi-room search would book a single room for everyone without a word. Better said.
 */
export function MultiRoomNotice({ palette }: { palette: Palette }) {
    const t = useTranslations('checkout');
    return (
        <Panel palette={palette} tone={palette.cardLine} role="note" icon={CheckCircle2} title={t('multiRoom.title')}>
            <Body palette={palette}>{t('multiRoom.description')}</Body>
        </Panel>
    );
}

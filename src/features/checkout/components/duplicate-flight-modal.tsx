'use client';

/**
 * The traveller already holds a flight leaving the same airport on the same day.
 *
 * `/flights/book` answers `DUPLICATE_BOOKING` for this (ADR-0011): a warning about a booking the
 * traveller may have forgotten, not a fault in what they typed. It used to land in the form's red
 * error box, where it read as one more thing to fix, and it stayed on screen until the next
 * submit. As a dialog it stops the flow, says which booking, and goes away when they close it.
 *
 * Rendered into `document.body`: the checkout slides its steps in with a transform, and a
 * `position: fixed` element inside a transformed ancestor is fixed to that ancestor, not the screen.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarClock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@/shared/lib/palette';
import { ACCENT, ACCENT_FILL, type Palette } from '../lib/palette';

export interface DuplicateFlight {
    /** The airport both flights leave from, as its IATA code. */
    route: string;
    /** The day both leave, `YYYY-MM-DD`. */
    departureDate: string;
    /** The booking already held, when the server named it. */
    existingBookingId?: string;
}

/** `YYYY-MM-DD` in the page's language, read as a calendar day so no time zone can move it. */
function dayLabel(iso: string, locale: string): string {
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(date);
}

export function DuplicateFlightModal({
    duplicate, palette, onClose, returnFocusRef,
}: {
    duplicate: DuplicateFlight;
    palette:   Palette;
    onClose:   () => void;
    /** Where focus goes once the dialog closes. Without it, whatever had focus when it opened. */
    returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
    const t = useTranslations('checkout');
    const locale = useLocale();
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    // Read through a ref, so a fresh callback from the page does not re-run the setup below
    // (and bounce focus) on every render while the dialog is open.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    // Once per opening: Escape closes, Tab stays inside, the page behind does not scroll, and
    // focus goes back (to `returnFocusRef`, or whatever had it) once the dialog is gone.
    useEffect(() => {
        const returnTo = returnFocusRef?.current ?? (document.activeElement as HTMLElement | null);
        closeRef.current?.focus();
        const { overflow } = document.body.style;
        document.body.style.overflow = 'hidden';

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const items = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
            returnTo?.focus?.();
        };
    }, [returnFocusRef]);

    const action: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 22px', borderRadius: 999, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
    };

    // z-110: over the phone's bottom nav (100) and the sheet it opens (101-102), so the dialog
    // never depends on landing later in the document to win a tie with them.
    return createPortal(
        <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="duplicate-flight-title"
                aria-describedby="duplicate-flight-body"
                className="w-full rounded-t-3xl p-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-7"
                style={{ background: palette.menuBg, border: `1px solid ${palette.cardLine}`, color: palette.text }}
            >
                <span
                    aria-hidden
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 48, height: 48, background: `${ACCENT}1f` }}
                >
                    <CalendarClock size={24} strokeWidth={1.9} color={ACCENT} />
                </span>

                <h2 id="duplicate-flight-title" style={{ margin: '16px 0 0', fontSize: 19, fontWeight: 700, lineHeight: 1.3, color: palette.title }}>
                    {t('flight.duplicateTitle')}
                </h2>
                <div id="duplicate-flight-body">
                    <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: palette.soft }}>
                        {t('flight.duplicateBody', {
                            route: duplicate.route,
                            date: dayLabel(duplicate.departureDate, locale),
                        })}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: palette.soft }}>
                        {t('flight.duplicateHint')}
                    </p>
                </div>

                {/* Close is the main action: the traveller has been told, and dismissing is how
                    they say so. Seeing the booking is the other way out, and a link, since it
                    leaves the page. Stacked on a phone with Close nearest the thumb. */}
                <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                    {duplicate.existingBookingId && (
                        <Link
                            href={`/trips/${duplicate.existingBookingId}`}
                            style={{ ...action, border: `1.5px solid ${palette.cardLine}`, background: 'transparent', color: palette.title }}
                        >
                            {t('viewExistingBooking')}
                        </Link>
                    )}
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        style={{ ...action, border: 'none', background: ACCENT_FILL, boxShadow: BRAND.gradientShadow, color: '#fff' }}
                    >
                        {t('flight.duplicateClose')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

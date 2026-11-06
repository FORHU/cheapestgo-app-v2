'use client';

/**
 * The traveller already holds a flight leaving the same airport on the same day.
 *
 * `/flights/book` answers `DUPLICATE_BOOKING` for this (ADR-0011): a warning about a booking the
 * traveller may have forgotten, not a fault in what they typed. It used to land in the form's red
 * error box, where it read as one more thing to fix, and it stayed on screen until the next
 * submit. As a dialog it stops the flow, says which booking, and goes away when they close it.
 */

import { useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarClock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@/shared/lib/palette';
import { ACCENT, ACCENT_FILL, type Palette } from '../lib/palette';
import { CheckoutDialog, DIALOG_ACTION as action, DIALOG_FOCUS_RING } from './checkout-dialog';

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
    const closeRef = useRef<HTMLButtonElement>(null);

    return (
        <CheckoutDialog
            palette={palette}
            labelledBy="duplicate-flight-title"
            describedBy="duplicate-flight-body"
            onClose={onClose}
            initialFocusRef={closeRef}
            returnFocusRef={returnFocusRef}
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
                        className={DIALOG_FOCUS_RING}
                        style={{ ...action, border: `1.5px solid ${palette.cardLine}`, background: 'transparent', color: palette.title }}
                    >
                        {t('viewExistingBooking')}
                    </Link>
                )}
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    className={DIALOG_FOCUS_RING}
                    style={{ ...action, border: 'none', background: ACCENT_FILL, boxShadow: BRAND.gradientShadow, color: '#fff' }}
                >
                    {t('flight.duplicateClose')}
                </button>
            </div>
        </CheckoutDialog>
    );
}

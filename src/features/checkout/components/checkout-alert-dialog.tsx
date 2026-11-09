'use client';

/**
 * A warning that stops the checkout: a fare that sold out or changed, a refusal, a card declined,
 * a booking already held for those dates.
 *
 * These used to be a red sentence in a box at the head of the form. It was easy to scroll past,
 * read as one more field to fix, and stayed until the next submit. As a dialog it is seen,
 * announced, and gone once the traveller closes it — leaving them on the step they carry on
 * from. Field-level errors are not this: they stay beside the field they are about.
 */

import { useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@/shared/lib/palette';
import { ACCENT_FILL, DANGER, type Palette } from '../lib/palette';
import { CheckoutDialog, DIALOG_ACTION, DIALOG_FOCUS_RING } from './checkout-dialog';

export interface CheckoutAlert {
    title:   string;
    message: string;
    /** The other way out, besides closing: a new search, the booking already held. */
    action?: { label: string; onClick: () => void } | { label: string; href: string };
}

export function CheckoutAlertDialog({
    alert, palette, onClose, returnFocusRef,
}: {
    alert:   CheckoutAlert;
    palette: Palette;
    onClose: () => void;
    /** Where focus goes once the dialog closes. Without it, whatever had focus when it opened. */
    returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
    const t = useTranslations('checkout');
    const id = useId();
    const closeRef = useRef<HTMLButtonElement>(null);
    const { action } = alert;
    const secondary: React.CSSProperties = {
        ...DIALOG_ACTION, border: `1.5px solid ${palette.cardLine}`, background: 'transparent', color: palette.title,
    };

    return (
        <CheckoutDialog
            palette={palette}
            labelledBy={`${id}-title`}
            describedBy={`${id}-body`}
            onClose={onClose}
            initialFocusRef={closeRef}
            returnFocusRef={returnFocusRef}
        >
            <span
                aria-hidden
                className="flex items-center justify-center rounded-full"
                style={{ width: 48, height: 48, background: `${DANGER}1f` }}
            >
                <AlertTriangle size={24} strokeWidth={1.9} color={DANGER} />
            </span>

            <h2 id={`${id}-title`} style={{ margin: '16px 0 0', fontSize: 19, fontWeight: 700, lineHeight: 1.3, color: palette.title }}>
                {alert.title}
            </h2>
            <p id={`${id}-body`} style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: palette.soft }}>
                {alert.message}
            </p>

            {/* Close is the main action: the traveller has been told, and the step behind is
                where they carry on. Stacked on a phone with Close nearest the thumb. */}
            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                {action && 'href' in action && (
                    <Link href={action.href} className={DIALOG_FOCUS_RING} style={secondary}>
                        {action.label}
                    </Link>
                )}
                {action && 'onClick' in action && (
                    <button type="button" onClick={action.onClick} className={DIALOG_FOCUS_RING} style={secondary}>
                        {action.label}
                    </button>
                )}
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    className={DIALOG_FOCUS_RING}
                    style={{ ...DIALOG_ACTION, border: 'none', background: ACCENT_FILL, boxShadow: BRAND.gradientShadow, color: '#fff' }}
                >
                    {t('alert.close')}
                </button>
            </div>
        </CheckoutDialog>
    );
}

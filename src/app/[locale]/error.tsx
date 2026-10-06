'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { StateScreen, stateActionClass, stateSecondaryClass } from '@/shared/components/StateScreen';

/**
 * Where a render that threw lands.
 *
 * There was no boundary at all until 2026-10-05, so an error anywhere under `[locale]`
 * fell through to Next's own page: a stack trace in development, and in production a bare
 * white screen with no way back and nothing in our design. A traveller mid-booking saw a
 * blank browser tab.
 *
 * `reset` re-renders the segment without a full reload, which is the right first move for
 * the transient kind — a dropped fetch, a supplier that blinked. Home is the second,
 * because a reset that keeps failing needs somewhere else to go.
 */
export default function LocaleError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations('errors.page');

    useEffect(() => {
        // The digest is the only handle on the server-side stack, which the browser is
        // deliberately never shown; without logging it, a production report is unmatchable.
        console.error('[error-boundary]', error.digest ?? '(no digest)', error.message);
    }, [error]);

    return (
        <StateScreen
            full
            icon={AlertTriangle}
            title={t('title')}
            lines={[t('body')]}
            actions={
                <>
                    <button type="button" onClick={reset} className={stateActionClass}>
                        {t('tryAgain')}
                    </button>
                    <Link href="/" className={stateSecondaryClass}>
                        {t('goHome')}
                    </Link>
                </>
            }
        />
    );
}

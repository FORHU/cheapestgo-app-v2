'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import './globals.css';

/**
 * The last boundary: a throw in the root layout itself.
 *
 * Next replaces the whole document here, so this file renders its own `<html>` and `<body>`
 * and sits outside every provider — no next-intl, no ThemeProvider. The copy is therefore
 * English rather than translated, and the reload is a plain anchor rather than the
 * locale-aware `Link`: both are deliberate, because the one thing this page must never do
 * is throw while reporting a throw.
 *
 * `StateScreen` works here because v2's dark mode is a class on `<html>` and its styling is
 * Tailwind variants rather than React context. The class is carried below so the screen
 * matches the theme the traveller was already in.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[global-error]', error.digest ?? '(no digest)', error.message);
    }, [error]);

    return (
        // `suppressHydrationWarning`: the theme class is written by a script before React
        // hydrates, so the server's empty className never matches the client's.
        <html lang="en" suppressHydrationWarning>
            <body>
                <StateScreen
                    full
                    icon={AlertTriangle}
                    title="Something went wrong"
                    lines={[
                        'The page could not be loaded. Reloading usually clears it.',
                        'If it keeps happening, your booking is safe — nothing is charged until you confirm.',
                    ]}
                    actions={
                        <button type="button" onClick={reset} className={stateActionClass}>
                            Reload
                        </button>
                    }
                />
            </body>
        </html>
    );
}

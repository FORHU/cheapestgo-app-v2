import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/**
 * A page with nothing on it but a reason — an error, an empty result, a dead link.
 *
 * v2 says these one way: no panel, no coloured card, no emoji. A circular chip inverted
 * against the surface, a quiet title, a line or two of explanation, and a pill. It is the
 * language `StatusScreen` already speaks on the search map, lifted out so the rest of the
 * app can speak it too — the flight search's error was a red-bordered box carried over
 * from v1, and next to the rest of v2 it reads as a different product's page.
 *
 * Styled with Tailwind's `dark:` variants rather than the palette function the map uses,
 * because dark mode here is a class on `<html>` and that keeps this usable where React
 * context is not: `global-error.tsx` renders its own document, outside every provider,
 * and an error screen that throws because it wanted a ThemeProvider is no error screen.
 *
 * The values below are `railCardPalette`'s, by hand — surface `#1A1A1A`/white, title
 * `#111111`/white, muted `#6B7280`/white-60, and the chip inverting the surface.
 */

export interface StateScreenProps {
    icon: LucideIcon;
    title: string;
    /** One or two short lines. Anything longer belongs somewhere a person can act on it. */
    lines?: string[];
    /**
     * Buttons, as nodes rather than data: a link here has to be the caller's `Link` — the
     * locale-aware one inside the app, a plain anchor in `global-error` where next-intl
     * is not mounted. Style them with `stateActionClass` / `stateSecondaryClass`.
     */
    actions?: React.ReactNode;
    /** Ring the chip while something is still happening. */
    busy?: boolean;
    /** Fill the viewport, for a whole page. Otherwise it fills its container. */
    full?: boolean;
    className?: string;
}

/** The primary pill — the chip's colours, inverted against the surface. */
export const stateActionClass =
    'inline-flex h-[62px] items-center justify-center rounded-full px-[52px] text-[17px] font-medium '
    + 'bg-[#1A1A1A] text-white dark:bg-white dark:text-[#111111] '
    + 'shadow-[0_6px_20px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-85 cursor-pointer';

/** The second choice, which should not compete with the first. */
export const stateSecondaryClass =
    'inline-flex h-[62px] items-center justify-center rounded-full px-[52px] text-[17px] font-medium '
    + 'border border-black/[0.06] text-[#111111] dark:border-white/[0.08] dark:text-white '
    + 'transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer';

export function StateScreen({
    icon: Icon, title, lines = [], actions, busy = false, full = false, className,
}: StateScreenProps) {
    return (
        <div
            role={busy ? undefined : 'alert'}
            className={cn(
                'flex flex-col items-center justify-center px-6 text-center',
                'bg-white dark:bg-[#1A1A1A]',
                full ? 'min-h-screen' : 'h-full w-full py-20',
                className,
            )}
        >
            <div className="relative flex size-16 items-center justify-center rounded-full bg-[#1A1A1A] dark:bg-white">
                {busy && (
                    <span
                        aria-hidden="true"
                        className="absolute inset-[5px] animate-spin rounded-full border-2 border-white/20 border-t-white dark:border-[#111111]/20 dark:border-t-[#111111]"
                        style={{ animationDuration: '0.9s' }}
                    />
                )}
                <Icon size={24} className="text-white dark:text-[#111111]" />
            </div>

            <p className="mt-5 text-[19px] font-medium text-[#111111] dark:text-white">{title}</p>

            {lines.map((line, i) => (
                <p
                    key={line}
                    className={cn(
                        'max-w-sm text-[13px] leading-[1.4] text-[#6B7280] dark:text-white/60',
                        i === 0 ? 'mt-2.5' : 'mt-1.5',
                    )}
                >
                    {line}
                </p>
            ))}

            {actions && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
        </div>
    );
}

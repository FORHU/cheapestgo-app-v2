'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useTheme } from '@/shared/components/ThemeContext';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { LocaleSelector } from '@/shared/components/common/LocaleSelector';
import { SELECTOR_TONES, type SelectorVariant } from '@/shared/components/common/selector-tone';
import { LogoWordmark } from './logo-wordmark';
import { useBrandName } from '@/shared/components/BrandProvider';
import SignInDropdown from '@/shared/auth/SignInDropdown';

/**
 * The landing page's own header: transparent over the dark canvas, carrying the
 * wordmark, the locale and currency menus, and sign in.
 *
 * Deliberately not the app-wide `<Header />`, which is themed and sticky.
 *
 * The controls drop below 760px, where the search bar takes the whole viewport.
 *
 * `tone` is the same choice the menus make (`SELECTOR_TONES`). `onDark` is the
 * landing page's. `default` is the same bar on a page that follows the theme —
 * the bookings page, on the results pages' flat ground — where it also has to
 * carry the theme switch, since it stands in for the only header that had one.
 */
function LandingHeaderContent({ tone }: { tone: SelectorVariant }) {
    const user = useAuthStore((s) => s.user);
    const tAll = useTranslations();
    const brand = useBrandName();
    const themed = tone === 'default';

    return (
        <header
            className={cn(
                themed
                    // Sticky on the page's own ground (`.flat-ground-strip`, globals.css): a
                    // list scrolls under it, and a transparent bar would print the
                    // cards through the logo.
                    ? 'flat-ground-strip sticky top-0 z-30'
                    // Fixed, not in flow: the Journey's scroll track has to start at the very top of the
                    // page so the first wheel notch on the hero snaps to the next section, and the
                    // navbar has to stay on screen through every stage rather than scrolling away. The
                    // soft scrim keeps its white controls legible over the lighter sky/daylight stages.
                    : 'fixed inset-x-0 top-0 z-[5] bg-linear-to-b from-[#020617]/55 to-transparent',
            )}
        >
            <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 py-[18px]">
                <Link href="/" aria-label={`${brand} home`} className="flex shrink-0 items-center">
                    <LogoWordmark height={44} tone={tone} />
                </Link>

                {/* On the landing page, dark whatever the app theme is, both menus take
                    the `onDark` tone rather than the themed one. */}
                <div className="hidden items-center gap-3 min-[761px]:flex">
                    {/* Shown signed out too: /trips sends a guest to sign in and back.
                        Drawn in the menus' trigger tone so it sits with them. */}
                    <Link
                        href="/trips"
                        className={cn('rounded-lg px-2 py-1 text-xs font-medium transition-colors', SELECTOR_TONES[tone].trigger)}
                    >
                        {tAll('nav.bookings')}
                    </Link>
                    <LocaleSelector variant={tone} />
                    <CurrencySelector variant={tone} />
                    {themed && <ThemeSwitch />}

                    {/* Signed in, it is the app header's round profile button and menu, as in v1.
                        Signed out, v1's gradient, blue-600 → cyan-500, like every button on this page. */}
                    {user ? (
                        <div className="ml-1">
                            <SignInDropdown tone={tone} />
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="ml-1 rounded-full bg-linear-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-[filter] duration-150 hover:brightness-110"
                        >
                            {tAll('nav.signIn')}
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}

/**
 * Light / dark, in the menus' trigger tone.
 *
 * The icon is picked by `dark:` rather than from the theme in JS: the server render
 * starts light whatever the page is, and the icon should be right from first paint.
 * Its own component so the landing page, which has no theme to switch, never asks
 * for one.
 */
function ThemeSwitch() {
    const tAll = useTranslations();
    const { theme, toggleTheme } = useTheme();
    const label = theme === 'dark' ? tAll('theme.switchToLight') : tAll('theme.switchToDark');
    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={label}
            title={label}
            className={cn('rounded-lg p-1.5 transition-colors', SELECTOR_TONES.default.trigger)}
        >
            <Moon size={16} className="dark:hidden" aria-hidden />
            <Sun size={16} className="hidden dark:block" aria-hidden />
        </button>
    );
}

/**
 * CurrencySelector reads useSearchParams, which bails out of prerendering, so the
 * landing page cannot export without a boundary around it: without this, building
 * /en fails with "useSearchParams() should be wrapped in a suspense boundary".
 * `shared/components/header.tsx` wraps the app-wide header the same way.
 */
export function LandingHeader({ tone = 'onDark' }: { tone?: SelectorVariant }) {
    return (
        <Suspense fallback={null}>
            <LandingHeaderContent tone={tone} />
        </Suspense>
    );
}

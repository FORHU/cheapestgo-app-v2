'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/shared/stores/auth.store';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { LocaleSelector } from '@/shared/components/common/LocaleSelector';
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
 */
function LandingHeaderContent() {
    const user = useAuthStore((s) => s.user);
    const tAll = useTranslations();
    const brand = useBrandName();

    return (
        // Fixed, not in flow: the Journey's scroll track has to start at the very top of the
        // page so the first wheel notch on the hero snaps to the next section, and the
        // navbar has to stay on screen through every stage rather than scrolling away. The
        // soft scrim keeps its white controls legible over the lighter sky/daylight stages.
        <header className="fixed inset-x-0 top-0 z-[5] bg-linear-to-b from-[#020617]/55 to-transparent">
            <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 py-[18px]">
                <Link href="/" aria-label={`${brand} home`} className="flex shrink-0 items-center">
                    <LogoWordmark height={44} />
                </Link>

                {/* This page is dark whatever the app theme is, so both menus take
                    the `onDark` tone rather than the themed one. */}
                <div className="hidden items-center gap-3 min-[761px]:flex">
                    {/* Shown signed out too: /trips sends a guest to sign in and back.
                        Drawn in the menus' `onDark` trigger tone so it sits with them. */}
                    <Link
                        href="/trips"
                        className="rounded-lg px-2 py-1 text-xs font-medium text-[#94a3b8] transition-colors hover:bg-white/[0.07] hover:text-[#f8fafc]"
                    >
                        {tAll('nav.bookings')}
                    </Link>
                    <LocaleSelector variant="onDark" />
                    <CurrencySelector variant="onDark" />

                    {/* Signed in, it is the app header's round profile button and menu, as in v1.
                        Signed out, v1's gradient, blue-600 → cyan-500, like every button on this page. */}
                    {user ? (
                        <div className="ml-1">
                            <SignInDropdown />
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
 * CurrencySelector reads useSearchParams, which bails out of prerendering, so the
 * landing page cannot export without a boundary around it: without this, building
 * /en fails with "useSearchParams() should be wrapped in a suspense boundary".
 * `shared/components/header.tsx` wraps the app-wide header the same way.
 */
export function LandingHeader() {
    return (
        <Suspense fallback={null}>
            <LandingHeaderContent />
        </Suspense>
    );
}

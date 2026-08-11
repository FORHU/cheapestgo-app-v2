'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { LocaleSelector } from '@/shared/components/common/LocaleSelector';
import { LogoWordmark } from './logo-wordmark';

/**
 * The landing page's own header: transparent over the dark canvas, carrying the
 * wordmark, the locale and currency menus, and sign in.
 *
 * Deliberately not the app-wide `<Header />`, which is themed and sticky.
 *
 * The controls drop below 760px, where the search bar takes the whole viewport.
 */
export function LandingHeader() {
    const user = useAuthStore((s) => s.user);

    return (
        <header className="relative z-[5]">
            <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 py-[18px]">
                <Link href="/" aria-label="CheapestGo home" className="flex shrink-0 items-center">
                    <LogoWordmark height={24} />
                </Link>

                {/* This page is dark whatever the app theme is, so both menus take
                    the `onDark` tone rather than the themed one. */}
                <div className="hidden items-center gap-3 min-[761px]:flex">
                    <LocaleSelector variant="onDark" />
                    <CurrencySelector variant="onDark" />

                    <Link
                        href={user ? '/account' : '/login'}
                        className="ml-1 rounded-full border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-[#e2e8f0] transition-colors duration-150 hover:text-[#f8fafc]"
                    >
                        {user ? 'Account' : 'Sign in'}
                    </Link>
                </div>
            </div>
        </header>
    );
}

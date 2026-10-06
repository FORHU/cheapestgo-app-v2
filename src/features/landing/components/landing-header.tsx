'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/shared/stores/auth.store';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { LocaleSelector } from '@/shared/components/common/LocaleSelector';
import { LogoWordmark } from './logo-wordmark';
import { BRAND_NAME } from '@/shared/lib/brand';

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
    const tAll = useTranslations();

    return (
        <header className="relative z-[5]">
            <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 py-[18px]">
                <Link href="/" aria-label={`${BRAND_NAME} home`} className="flex shrink-0 items-center">
                    <LogoWordmark height={24} />
                </Link>

                {/* This page is dark whatever the app theme is, so both menus take
                    the `onDark` tone rather than the themed one. */}
                <div className="hidden items-center gap-3 min-[761px]:flex">
                    <LocaleSelector variant="onDark" />
                    <CurrencySelector variant="onDark" />

                    {/* v1's gradient, blue-600 → cyan-500, like every button on this page. */}
                    <Link
                        href={user ? '/account' : '/login'}
                        className="ml-1 rounded-full bg-linear-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-[filter] duration-150 hover:brightness-110"
                    >
                        {user ? tAll('nav.account') : tAll('nav.signIn')}
                    </Link>
                </div>
            </div>
        </header>
    );
}

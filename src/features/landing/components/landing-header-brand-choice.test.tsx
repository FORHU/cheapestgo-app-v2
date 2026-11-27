/**
 * Whether the header invites a visitor to choose a language and a currency.
 *
 * AirangGo sells to Korea in won. Its header carried a "KR" menu and a "KRW" menu, offered to
 * people who are in Korea paying in won — two controls spent agreeing with the visitor.
 *
 * What is asserted here is the brand rule, not the look: this governs four separate bars
 * (landing, app, hotel search, flight search) and one of them quietly keeping its selectors
 * is exactly the kind of drift nothing else would catch.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { brandProfile } from '@/shared/lib/brand';

const brand = vi.hoisted(() => ({ name: 'CheapestGo' }));

// The real helpers, driven by the brand this test is pretending to be — so the rule under
// test is the one that ships, not a stub of it.
vi.mock('@/shared/components/BrandProvider', async () => {
    const { brandWordmark, brandProfile: profile } = await import('@/shared/lib/brand');
    return {
        useBrandName:     () => brand.name,
        useBrandWordmark: () => brandWordmark(brand.name),
        useBrandProfile:  () => profile(brand.name),
    };
});
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
    usePathname: () => '/',
    useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/shared/components/ThemeContext', () => ({
    useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));
// Stood in for, so their presence is what is measured rather than their contents.
vi.mock('@/shared/components/common/LocaleSelector', () => ({
    LocaleSelector: () => <div>locale-selector</div>,
}));
vi.mock('@/shared/components/common/CurrencySelector', () => ({
    CurrencySelector: () => <div>currency-selector</div>,
}));

import { LandingHeader } from './landing-header';

beforeEach(() => { brand.name = 'CheapestGo'; });

describe('the brand rule itself', () => {
    it('CheapestGo sells in several countries and currencies, so it asks', () => {
        expect(brandProfile('CheapestGo').offersLocaleAndCurrency).toBe(true);
    });

    it('AirangGo sells to one, so it does not', () => {
        expect(brandProfile('AirangGo').offersLocaleAndCurrency).toBe(false);
    });

    /**
     * The Korean deployment is still started with the pre-rebrand `NEXT_PUBLIC_BRAND_NAME`
     * until it is rebuilt, so the rule has to recognise the old name — otherwise it would not
     * apply to the very deployment it was written for.
     */
    it('applies under the pre-rebrand name too', () => {
        expect(brandProfile('GeomeeGo').offersLocaleAndCurrency).toBe(false);
    });

    /** A brand nobody has heard of keeps the controls, as every brand did before this existed. */
    it('leaves an unknown brand asking', () => {
        expect(brandProfile('SomethingElse').offersLocaleAndCurrency).toBe(true);
    });
});

describe('the landing header', () => {
    it('offers both on CheapestGo', () => {
        renderWithIntl(<LandingHeader />);

        expect(screen.getByText('locale-selector')).toBeInTheDocument();
        expect(screen.getByText('currency-selector')).toBeInTheDocument();
    });

    it('offers neither on AirangGo', () => {
        brand.name = 'AirangGo';

        renderWithIntl(<LandingHeader />);

        expect(screen.queryByText('locale-selector')).not.toBeInTheDocument();
        expect(screen.queryByText('currency-selector')).not.toBeInTheDocument();
    });

    /** The rest of the header is untouched — this removes two controls, not a row. */
    it('keeps the rest of the header on AirangGo', () => {
        brand.name = 'AirangGo';

        renderWithIntl(<LandingHeader />);

        expect(screen.getByRole('link', { name: /trips|bookings|예약/i })).toBeInTheDocument();
    });
});

'use client';

import { useTranslations } from 'next-intl';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, List, LogIn, Map as MapIcon, MapPinned, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth.store';
import SignInDropdown from '@/shared/auth/SignInDropdown';
import { SearchBar } from './search-bar';
import { StayEditor, type Stay } from './stay-editor';
import { ACCENT, ICON_BTN, sortPalette } from './search-chrome';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { LocaleSelector } from '@/shared/components/common/LocaleSelector';

/**
 * The search page's toolbar, for both of its views.
 *
 * It was drawn twice — once floating over the map, once sticky above the
 * results — and the two copies had already drifted: different control sizes, a
 * hardcoded bar fill on one side, a palette that inverted on one and not the
 * other. The map's is the one that survived, because it is the one the design
 * is drawn against; the list view now takes the same bar at the same sizes.
 *
 * Three things still differ between the views, and each is a prop rather than a
 * branch inside here:
 *
 *   tone           the map inverts against the basemap, the list follows the
 *                  app theme — see `uiTone` in the search page
 *   barBackground  the list bar sits on the card surface so it reads as the
 *                  same plate as the cards below it, not the map's `bar` tone
 *   className      where the bar lands — floating over the map, or sticky in
 *                  the page flow. This component never positions itself.
 *
 * The controls the map alone carries — filters and nearby places — arrive as
 * optional objects. Presence is what decides whether they are drawn, so a
 * caller cannot ask for a Filters button without the handler behind it.
 */
export interface SearchTopBarProps {
    /** Which palette to draw from. Not the app theme — see the note above. */
    tone: 'light' | 'dark';
    /** Overrides the palette's own `bar` fill. */
    barBackground?: string;
    /** Positioning, from the caller. */
    className?: string;

    onBack: () => void;

    summary: string;
    searching: boolean;
    proximity?: { lat: number; lng: number };
    onSearchSubmit: (name: string, coords?: { lat: number; lng: number }) => void;

    /** The stay being searched — dates and guests — editable from the bar. */
    stay?: Stay & { onApply: (next: Stay) => void };

    /** The app theme, for the toggle's own label and glyph. */
    theme: 'light' | 'dark';
    onToggleTheme: () => void;

    /** The view showing now. The toggle offers the other one. */
    view: 'map' | 'list';
    onViewChange: (v: 'map' | 'list') => void;

    /**
     * `mobileOnly` drops the button at `lg`, for a view that has a filter
     * sidebar of its own once there is room for one — the list's appears at
     * exactly that width, and two ways into the same filters is one too many.
     * `activeCount` drives the dot; omit it where the count is not the bar's
     * to know.
     */
    filters?: { open: boolean; activeCount?: number; onToggle: () => void; mobileOnly?: boolean };
    pois?: { on: boolean; onToggle: () => void };

    /**
     * Currency and language, drawn on the bar itself.
     *
     * A flag rather than the optional objects above because neither control
     * needs anything from this bar: both own their own value — the store for
     * currency, a cookie for locale — so there is no handler to withhold and
     * nothing for a caller to get half-right. Both views pass it: this page
     * renders no app header of its own in either mode, so this bar is the
     * only place these two are reachable from at all.
     *
     * Both take the bar's palette rather than a variant, since this tone is the
     * app theme inverted — see `SelectorChrome`.
     */
    showRegionControls?: boolean;
}

export function SearchTopBar({
    tone, barBackground, className,
    onBack,
    summary, searching, proximity, onSearchSubmit, stay,
    theme, onToggleTheme,
    view, onViewChange,
    filters, pois,
    showRegionControls = false,
}: SearchTopBarProps) {
    const tAll = useTranslations();
    const { chrome, rest, lit } = barStyles(tone);

    return (
        <div
            // Two rows below `lg`, one from there up.
            //
            // A phone has no width for all of it on one line: back, the field,
            // dates and six controls left the field at 0px, with the controls
            // running out past the bar's own right edge. So under `lg` the bar
            // wraps — the field gets the first row to itself, between back and
            // dates, and the controls take the second (see the cluster below).
            // A tablet wraps too: its 40px controls plus the labelled view and
            // sign-in pills still crushed the field to under 120px on one row.
            //
            // From `lg` it is one row at a fixed 60px with 8px of padding. `xl`
            // keeps the 32px inset the desktop bar has been drawn with — wider
            // than the 60px leaves room for, so the bar renders at 64px there.
            className={cn(
                'flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-[16px] p-2',
                'md:gap-x-2 md:rounded-[20px]',
                'lg:h-[60px] lg:flex-nowrap',
                'xl:p-8',
                className,
            )}
            style={{
                background: barBackground ?? chrome.bar,
                boxShadow: chrome.shadow,
            }}
        >
            {/* Back — leaves the search, from either view. */}
            <button
                onClick={onBack}
                aria-label={tAll('common.goBack')}
                className={ICON_BTN}
                style={rest}>
                <ArrowLeft size={16} className="md:size-[17px]" style={{ color: chrome.text }} />
            </button>

            {/* Search */}
            <SearchBar
                summary={summary}
                searching={searching}
                theme={tone}
                proximity={proximity}
                onSubmit={onSearchSubmit}
            />

            {/* Dates and guests, beside the place they belong to. */}
            {stay && <StayEditor tone={tone} {...stay} />}

            {/* Everything the bar acts with, in one cluster at its right
                corner — filters, nearby places, theme, view.

                They used to run on from the search field and stop wherever
                that left off, mid-bar, with the count badge alone holding
                the corner. The badge now sits over the card rail it counts
                (see the search page), so the controls take the end of the
                bar and the slack falls between them and the field.

                Below `lg` the cluster is the bar's whole second row
                (`basis-full` is what wraps it there). The spacer splits that
                row in two: the map's own tools — filters, nearby places — on
                the left under back, and what the session is set to — currency,
                language, theme, view — on the right under dates. */}
            <div className="flex basis-full items-center gap-1.5 md:gap-2 lg:ml-auto lg:basis-auto lg:shrink-0">
                {filters && <BarFiltersButton tone={tone} barBackground={barBackground} {...filters} />}

                {/* Nearby places. Takes the blue chip while on — the same "this one
                    is lit" the rail cards and the filter panel use — rather than a
                    colour of its own. Only ever
                    useful once a stay is picked, since that is what the discs are
                    drawn around, but the toggle stays put so it does not appear and
                    disappear under the thumb.

                    A pin on a map, not the compass it used to be: a compass reads
                    as orientation or "locate me", and what this switches is a set
                    of places pinned around the stay. */}
                {pois && (
                    <button
                        onClick={pois.onToggle}
                        aria-pressed={pois.on}
                        aria-label={pois.on ? 'Hide nearby places' : 'Show nearby places'}
                        title={pois.on ? 'Hide nearby places' : 'Show nearby places'}
                        className={cn(ICON_BTN, 'transition-colors')}
                        style={pois.on ? lit : rest}>
                        <MapPinned size={16} className="md:size-[17px]" />
                    </button>
                )}

                <span aria-hidden="true" className="flex-1 lg:hidden" />

                {/* Currency and language.

                    Ahead of the theme and view toggles because those two act on
                    the page in front of you, while these two set what the whole
                    session is priced and written in — the same order the app
                    header runs them in.

                    Drawn as the same icon circle as the buttons either side of
                    them: the active symbol and the active flag carry the state,
                    so the codes beside them ("USD", "EN") were the only labels
                    on a bar of glyphs and the only two controls with a
                    different silhouette. The value each one holds is in its
                    `aria-label` for anyone not reading the glyph. */}
                {showRegionControls && (
                    <>
                        <CurrencySelector chrome={chrome} iconOnly />
                        <LocaleSelector chrome={chrome} iconOnly />
                    </>
                )}

                <BarThemeButton tone={tone} theme={theme} onToggle={onToggleTheme} />

                {/* View toggle — a circle on a phone, the labelled pill above it.
                    One button rather than one per view: they were mirrors of each
                    other, and mirrors are what drift.

                    The pill stands at the icon buttons' own height — 40px on
                    desktop — with its width following the label. */}
                <button
                    onClick={() => onViewChange(view === 'map' ? 'list' : 'map')}
                    aria-label={view === 'map' ? 'List view' : 'Map view'}
                    className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full cursor-pointer transition-opacity hover:opacity-80 md:h-10 md:w-auto md:px-4"
                    style={{ ...rest, fontSize: 13, fontWeight: 600 }}>
                    {view === 'map'
                        ? <List size={15} className="md:size-[15px]" />
                        : <MapIcon size={15} className="md:size-[15px]" />}
                    <span className="hidden md:inline">{view === 'map' ? tAll('search.listView') : tAll('search.mapView')}</span>
                </button>

                <BarAccountButton tone={tone} />
            </div>
        </div>
    );
}

// ─── Parts shared with the flight results bar ─────────────────────────────────

/**
 * The palette, plus the two looks a bar control takes: at rest, and the inverted
 * chip a toggle takes while it is on. Exported with the controls below so the
 * flight results bar (`flight-search-top-bar.tsx`) draws from the same tokens
 * rather than a copy of them.
 */
export function barStyles(tone: 'light' | 'dark') {
    const chrome = sortPalette(tone);
    const rest = { background: chrome.surface, border: `1px solid ${chrome.border}`, color: chrome.text };
    // "On" is the brand gradient, the same as a selected sort or a card's price chip.
    const lit  = { background: ACCENT, border: '1px solid transparent', color: '#FFFFFF' };
    return { chrome, rest, lit };
}

/**
 * Filters. Lit while the panel is open or anything is set, so a narrowed list is
 * legible from the toolbar without opening it; the dot then says there is a count
 * behind the icon, which a 28px circle has no room to print.
 */
export function BarFiltersButton({
    tone, barBackground, open, activeCount, onToggle, mobileOnly,
}: NonNullable<SearchTopBarProps['filters']> & { tone: 'light' | 'dark'; barBackground?: string }) {
    const tAll = useTranslations();
    const { chrome, rest, lit } = barStyles(tone);
    return (
        <button
            onClick={onToggle}
            aria-expanded={open}
            aria-label={tAll('flights.results.filters')}
            title={tAll('flights.results.filters')}
            className={cn(ICON_BTN, 'relative transition-colors', mobileOnly && 'lg:hidden')}
            style={open || (activeCount ?? 0) > 0 ? lit : rest}>
            <SlidersHorizontal size={16} className="md:size-[17px]" />
            {(activeCount ?? 0) > 0 && !open && (
                <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 rounded-full"
                    // Rings against the bar it sits on, which the caller
                    // may have overridden out from under the palette.
                    style={{ width: 7, height: 7, background: ACCENT, border: `1.5px solid ${barBackground ?? chrome.bar}` }}
                />
            )}
        </button>
    );
}

/** Theme. Labelled and drawn for the theme it switches to. */
export function BarThemeButton({ tone, theme, onToggle }: { tone: 'light' | 'dark'; theme: 'light' | 'dark'; onToggle: () => void }) {
    const { chrome, rest } = barStyles(tone);
    return (
        <button
            onClick={onToggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className={ICON_BTN}
            style={rest}>
            {theme === 'dark'
                ? <Sun size={16} className="md:size-[17px]" style={{ color: chrome.text }} />
                : <Moon size={16} className="md:size-[17px]" style={{ color: chrome.text }} />}
        </button>
    );
}

/**
 * The account control, at the bar's far corner as it is in the app header — the
 * only one these pages have, since the bar stands in for that header.
 *
 * Signed out, it is a Sign in chip that comes back to this exact search: the
 * `redirect` it carries is the path and query on screen, which the login page
 * returns to (`returnPath` in use-auth.ts). Signed in, it is the header's own
 * avatar menu — account settings and sign out — rather than a second copy of it.
 *
 * Nothing is drawn until the session check on load has answered, only the space
 * it will take: otherwise a signed-in traveller sees "Sign in" flash up on every
 * page before their avatar replaces it.
 *
 * Not on a phone. The bar has no width left there — the route was down to "C…" —
 * and the bottom nav's sheet already carries sign-in and the account, which is
 * also why the app header drops its own below desktop.
 */
export function BarAccountButton({ tone }: { tone: 'light' | 'dark' }) {
    return (
        <div className="hidden shrink-0 md:block">
            <Suspense fallback={<span aria-hidden className="block h-10 w-[92px]" />}>
                <BarAccountButtonInner tone={tone} />
            </Suspense>
        </div>
    );
}

function BarAccountButtonInner({ tone }: { tone: 'light' | 'dark' }) {
    const tAll = useTranslations();
    const { chrome, lit } = barStyles(tone);
    const user = useAuthStore((s) => s.user);
    const checking = useAuthStore((s) => s.isLoading);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    // The store only knows the session after hydration; the server render never does.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted || (checking && !user)) {
        return <span aria-hidden className="block h-10 w-[92px]" />;
    }

    // The bar's palette, not the app theme: this bar is the theme inverted against the basemap,
    // on a page whose root is hardcoded `dark`, so the dropdown's own `dark:` skin drew white
    // text on near-white glass over a light map. Same hand-off as the currency and language
    // menus beside it.
    if (user) return <SignInDropdown chrome={chrome} />;

    const query = searchParams?.toString();
    const redirect = pathname + (query ? `?${query}` : '');
    return (
        <Link
            href={`/login?redirect=${encodeURIComponent(redirect)}`}
            aria-label={tAll('nav.signIn')}
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 transition-opacity hover:opacity-85"
            style={{ ...lit, fontSize: 13, fontWeight: 600 }}>
            <LogIn size={15} />
            <span className="whitespace-nowrap">{tAll('nav.signIn')}</span>
        </Link>
    );
}

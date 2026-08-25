'use client';

import React from 'react';
import { ArrowLeft, Compass, List, Map as MapIcon, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { SearchBar } from './search-bar';
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
    summary, searching, proximity, onSearchSubmit,
    theme, onToggleTheme,
    view, onViewChange,
    filters, pois,
    showRegionControls = false,
}: SearchTopBarProps) {
    const chrome = sortPalette(tone);

    /** A control at rest, and the inverted chip a toggle takes while it is on. */
    const rest = { background: chrome.surface, border: `1px solid ${chrome.border}`, color: chrome.text };
    const lit  = { background: chrome.text, border: `1px solid ${chrome.text}`, color: chrome.surface };

    return (
        <div
            // Desktop takes 8px of padding on a height that follows its content.
            // The 60px it used to be fixed at was taller than the tallest
            // control plus any padding, so the padding never showed — it was
            // 20px of dead space either way. The phone keeps its own fixed 48px,
            // where the bar is already as tight as it goes.
            className={cn(
                'flex h-12 items-center gap-1.5 rounded-[16px] px-2',
                'md:h-auto md:gap-2 md:rounded-[20px] md:p-2',
                className,
            )}
            style={{
                background: barBackground ?? chrome.bar,
                border: `1px solid ${chrome.border}`,
                boxShadow: chrome.shadow,
            }}
        >
            {/* Back — leaves the search, from either view. */}
            <button
                onClick={onBack}
                aria-label="Go back"
                className={ICON_BTN}
                style={rest}>
                <ArrowLeft size={13} className="md:size-[15px]" style={{ color: chrome.text }} />
            </button>

            {/* Search */}
            <SearchBar
                summary={summary}
                searching={searching}
                theme={tone}
                proximity={proximity}
                onSubmit={onSearchSubmit}
            />

            {/* Everything the bar acts with, in one cluster at its right
                corner — filters, nearby places, theme, view.

                They used to run on from the search field and stop wherever
                that left off, mid-bar, with the count badge alone holding
                the corner. The badge now sits over the card rail it counts
                (see the search page), so the controls take the end of the
                bar and the slack falls between them and the field. */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
                {/* Filters. Lit while the panel is open or anything is set, so a
                    narrowed map is legible from the toolbar without opening it; the
                    dot then says there is a count behind the icon, which a 28px
                    circle has no room to print. */}
                {filters && (
                    <button
                        onClick={filters.onToggle}
                        aria-expanded={filters.open}
                        aria-label="Filters"
                        title="Filters"
                        className={cn(ICON_BTN, 'relative transition-colors', filters.mobileOnly && 'lg:hidden')}
                        style={filters.open || (filters.activeCount ?? 0) > 0 ? lit : rest}>
                        <SlidersHorizontal size={13} className="md:size-[15px]" />
                        {(filters.activeCount ?? 0) > 0 && !filters.open && (
                            <span
                                aria-hidden="true"
                                className="absolute -top-0.5 -right-0.5 rounded-full"
                                // Rings against the bar it sits on, which the caller
                                // may have overridden out from under the palette.
                                style={{ width: 7, height: 7, background: ACCENT, border: `1.5px solid ${barBackground ?? chrome.bar}` }}
                            />
                        )}
                    </button>
                )}

                {/* Nearby places. Takes the inverted chip while on — the same "this
                    one is lit" the rail cards and the filter panel use — rather than
                    a colour of its own, so the bar keeps to two tones. Only ever
                    useful once a stay is picked, since that is what the discs are
                    drawn around, but the toggle stays put so it does not appear and
                    disappear under the thumb. */}
                {pois && (
                    <button
                        onClick={pois.onToggle}
                        aria-pressed={pois.on}
                        aria-label={pois.on ? 'Hide nearby places' : 'Show nearby places'}
                        title={pois.on ? 'Hide nearby places' : 'Show nearby places'}
                        className={cn(ICON_BTN, 'transition-colors')}
                        style={pois.on ? lit : rest}>
                        <Compass size={13} className="md:size-[15px]" />
                    </button>
                )}

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

                {/* Theme */}
                <button
                    onClick={onToggleTheme}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    className={ICON_BTN}
                    style={rest}>
                    {theme === 'dark'
                        ? <Sun size={13} className="md:size-[15px]" style={{ color: chrome.text }} />
                        : <Moon size={13} className="md:size-[15px]" style={{ color: chrome.text }} />}
                </button>

                {/* View toggle — a circle on a phone, the labelled pill above it.
                    One button rather than one per view: they were mirrors of each
                    other, and mirrors are what drift.

                    The pill stands at the icon buttons' own height rather than the
                    40px it used to: it is the only labelled control on the bar, and
                    at 40 beside a row of 28px circles it read as a different tier of
                    control instead of the last item in the same row. Width still
                    follows the label. */}
                <button
                    onClick={() => onViewChange(view === 'map' ? 'list' : 'map')}
                    aria-label={view === 'map' ? 'List view' : 'Map view'}
                    className="flex h-6 w-6 shrink-0 items-center justify-center gap-2 rounded-full cursor-pointer transition-opacity hover:opacity-80 md:h-7 md:w-auto md:px-3.5"
                    style={{ ...rest, fontSize: 13, fontWeight: 600 }}>
                    {view === 'map'
                        ? <List size={13} className="md:size-[15px]" />
                        : <MapIcon size={13} className="md:size-[15px]" />}
                    <span className="hidden md:inline">{view === 'map' ? 'List View' : 'Map View'}</span>
                </button>
            </div>
        </div>
    );
}

/**
 * The Boarding Pass's state, and how it is derived.
 *
 * Kept apart from the component on purpose: this is the part that makes a claim to
 * the visitor, so it has to be testable without dragging in next-intl's navigation
 * or a DOM. The component renders it; this decides what is true.
 */

/**
 * What the Journey has gathered so far.
 *
 * Every field is pre-filled from the page's own data so the pass is alive for a visitor
 * who only scrolls, and every field is replaced the moment that visitor types their own.
 * That is the whole contract: suggestion until touched, then theirs.
 */
export interface PassState {
    destination: string;
    countryCode: string;
    nights: number;
    /** IATA pair once the flights stage has something to say. */
    route: string | null;
    /** What the AI proposed, in the visitor's own terms. */
    aiNote: string | null;
    /** True once the visitor has edited anything — changes the wording, not the layout. */
    touched: boolean;
    /**
     * The dates the visitor actually picked, ISO, or null when they have not picked any.
     *
     * The button has to run the trip the pass describes. Sending the default dates while
     * the card advertised the visitor's own nights would open a search for a different
     * stay than the one it was quoting.
     */
    checkIn: string | null;
    checkOut: string | null;
}

/**
 * Build the pass from whatever the search store currently holds.
 *
 * Pure, and separate from the component, because every line here is a claim the card
 * makes to the visitor and the button then acts on. The first version hardcoded the
 * nights and hardcoded the route to null, so two of the three rows could never be true
 * however the visitor used the page — which is the sort of thing that is invisible until
 * someone asks whether the card actually works.
 */
export function buildPassState(input: {
    chosen: { title: string; countryCode?: string } | null;
    dates: { checkIn: Date | null; checkOut: Date | null } | null;
    firstFlight: {
        origin: { code?: string; title: string } | null;
        destination: { code?: string; title: string } | null;
    } | null;
    aiNote: string | null;
    /** Shown before the visitor has chosen anything of their own. */
    suggested: { city: string; countryCode: string; nights: number };
    /** Date → "YYYY-MM-DD", injected so this stays free of date-library choices. */
    toIso: (d: Date) => string;
}): PassState {
    const { chosen, dates, firstFlight, aiNote, suggested, toIso } = input;

    const nights =
        dates?.checkIn && dates?.checkOut
            ? Math.max(1, Math.round((dates.checkOut.getTime() - dates.checkIn.getTime()) / 86_400_000))
            : suggested.nights;

    // Airport code when there is one — "MNL → NRT" says more in less room than two city
    // names, and this card has very little room.
    const from = firstFlight?.origin?.code || firstFlight?.origin?.title || null;
    const to = firstFlight?.destination?.code || firstFlight?.destination?.title || null;

    return {
        destination: chosen?.title ?? suggested.city,
        countryCode: chosen?.countryCode ?? suggested.countryCode,
        nights,
        route: from && to ? `${from} → ${to}` : null,
        aiNote,
        touched: Boolean(chosen || aiNote || (from && to) || dates?.checkIn),
        checkIn: dates?.checkIn ? toIso(dates.checkIn) : null,
        checkOut: dates?.checkOut ? toIso(dates.checkOut) : null,
    };
}
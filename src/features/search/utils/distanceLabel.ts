/**
 * "33 km from Tokyo" — the line that was missing from a search result.
 *
 * A Tokyo search reaches Hachioji, 33 km out and genuinely Tokyo, and the card said only
 * "Hachioji, Tokyo" and a price. Whether that hotel is a bargain or useless depends entirely on
 * how far out it is, and nothing on screen said. See ADR-0051.
 *
 * **Whether to show it is not decided here.** api-v2 sends `distanceKm` only when the hotel is
 * far for the rung the traveller picked — a city search speaks above 15 km, a district above 5,
 * a landmark above 1 — so a card with no distance is a central one, not a field that failed to
 * load. This formats what arrives and nothing more, so the two cards that render it cannot
 * disagree about the rule.
 */
export function distanceLabel(
    km: number | null | undefined,
    anchor: string | null | undefined,
): string | null {
    if (km == null || !Number.isFinite(km) || km <= 0) return null;
    // Unanchored, the number is unreadable: "33 km" from what? The traveller picked somewhere
    // with a name, and CONTEXT.md's `Search Anchor` says to use it or say nothing.
    const from = (anchor ?? '').trim();
    if (!from) return null;

    const n = km < 10 ? km.toFixed(1) : String(Math.round(km));
    return `${n} km from ${from}`;
}

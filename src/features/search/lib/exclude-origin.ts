/**
 * Destination suggestions without the airport already picked as the origin — a
 * flight cannot be booked from an airport to itself, so offering it is a dead end.
 *
 * The origin arrives as its label: "Clark (CRK)" as a pick leaves it, or a bare
 * "CRK" from a deep link. Matched on the code where there is one, so another
 * airport in the same city (NRT from HND) stays on offer; on the title otherwise.
 */
export function excludeOrigin<T extends { title: string; code?: string }>(
    suggestions: T[],
    origin: string | null | undefined,
): T[] {
    const place = origin?.trim();
    if (!place) return suggestions;
    const code = /\(([A-Z]{3})\)$/.exec(place)?.[1] ?? (/^[A-Z]{3}$/.test(place) ? place : undefined);
    return suggestions.filter((s) => (code ? s.code !== code : s.title !== place));
}

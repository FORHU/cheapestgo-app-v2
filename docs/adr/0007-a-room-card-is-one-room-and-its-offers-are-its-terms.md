# A Room Card Is One Room, and Its Offers Are Its Terms

**Date:** 2026-11-04
**Status:** Accepted

## Context

On 2026-11-04 a Seoul property showed two room cards that no reader could tell apart: same
photograph, same beds, both headed "Deluxe Twin room", differing only in whether `(twin beds)` had
survived into the title. It was reported as a rendering fault. It was not one — the two were
different offers at different prices on different cancellation terms — but the UI was separating
them by the one difference that did not matter and burying the two that did.

The mechanism is that TGX hangs variant text in parentheses on the room name rather than in fields,
and sends more than one. `splitRoomName` in `room-selection.tsx` strips only the last, so:

| Supplier name | heading (the grouping key) | bed row |
|---|---|---|
| `Deluxe Twin room (twin beds) (bed type is subject to availability)` | `Deluxe Twin room (twin beds)` | Bed Type Is Subject To Availability |
| `Deluxe Twin room (twin beds)` | `Deluxe Twin room` | Twin Beds |

Two headings, two cards — and the first card's title promised twin beds while its own bullet said
the bed type was not guaranteed.

The obvious fix, stripping every parenthetical, was measured against 24 live Seoul properties and
is wrong. The qualifiers are three different kinds of thing:

- **Bed configuration** — `full double bed` (28), `twin beds` (15), `bunk bed`, `2 full double
  beds`, `queen size bed`. A traveller chooses by these.
- **Room features** — `shared bathroom` (5), `smoking`, `kitchen`. Identity, emphatically: merging
  a shared-bathroom room into its private-bathroom sibling sells someone the wrong thing.
- **A term of the offer** — `bed type is subject to availability` (28), and only this one. It
  describes what is promised, not what the room is.

The same measurement showed the problem repeats one level down. Within a single card, two chips read
`Room only` at different prices, because a chip is built from price and board alone. In the upper
price band a card can hold up to 13 offers; nearly all are genuinely distinct on
`board × refundability × cancellation deadline` — 8 offers, 8 distinct signatures — but some are
not. `ROYAL HOTEL SEOUL Myeongdong`'s premier twin sells `Room only, non-refundable` at both ₩40,406
and ₩41,759: identical terms, ₩1,353 apart.

## Decision

**A card is a Room. The options inside it are Offers, which differ only in terms.** Both words are
defined in [CONTEXT.md](../../CONTEXT.md).

1. **Room identity** is the supplier's name with the rate suffix removed and the *offer
   qualifiers* removed — `bed type is subject to availability` and anything equivalent. They are
   matched **per comma-separated item**, never per parenthetical: ROYAL Hotel Seoul packs the
   guarantee in with another qualifier, `(bed type is subject to availability, lounge access)`
   against `(lounge access)`, and matching the parenthetical whole missed every case like it.
   The last remaining parenthetical is then lifted onto the room's detail line, as it already was.
   Two names that reduce to the same string are one card.

2. **Offers are de-duplicated on their term-signature** — board, refundability, cancellation
   deadline — keeping the cheapest. An offer identical in terms to a cheaper one is strictly worse,
   and showing it reproduces the defect this ADR exists to remove.

3. **A chip carries whatever varies within its card** — board, cancellation, offer qualifiers and
   the room's own parenthetical, each included only where it actually differs. No two chips in a
   card can read alike, because anything that differs is by definition displayed. The cancellation
   gets its own terse wording for this: `cancellationSummary` writes a sentence for the card body
   and will not fit beside a price.

   This is also what makes rule 1 safe. One heading already covered rooms the supplier separates
   only in the parenthetical, long before this ADR — ROYAL Hotel Seoul files `no window` and `2
   full double beds` under one "Standard room", and 11 cards in a 24-property sample hide a
   difference that way. Naming it on the chip fixes that; splitting them into separate cards would
   have been the larger change, and would have re-created the complaint this started from.

## Alternatives considered

**Strip every parenthetical and let the heading alone decide.** One rule, no special cases.
Rejected because the qualifier is often the only thing separating two real products — `shared
bathroom`, `smoking`, `kitchen`, `no window` — and a card silently covering both sells the wrong
one. Rule 3 keeps them on one card *and* names them, which is the same economy without the
mis-sale.

**Group on `normalizeRoomName` and show only the cheapest offer.** The tidiest-looking option, and
the one a future reader is most likely to reach for. Rejected because it silently withdraws
inventory: at Seoul Dalbit Dongdaemun the same double room sells at ₱2,425 non-refundable or ₱3,173
refundable, and keeping the cheaper one removes the refundable room from sale without saying so.

**Treat an absent bed qualifier as matching any bed**, so `Deluxe Family room` merges with `Deluxe
Family room (twin beds)`. Tempting — the two differ by refundability and price in exactly the
pattern this ADR describes, so they probably are one room. Rejected because "probably" is doing the
work: if a hotel genuinely sells an unspecified-bed room alongside a twin, we would present them as
one and a traveller could arrive to a bed they did not pick. Those stay as separate cards.

**Rows instead of chips.** Scales past 11 offers without wrapping and has room to spell a
cancellation date out in full. Deferred, not rejected: most cards hold two to four offers, and the
labelling rule above removes the ambiguity without a new component. Revisit if the long tail proves
unreadable in practice.

## Consequences

The guarantee qualifier is now a named concept with exactly one member. A supplier phrase that means
the same thing in different words will not be recognised and its rooms will split again — the list
needs widening as such phrases are seen, and a room pair that looks duplicated is the first place to
look.

De-duplicating on term-signature means an offer can disappear from the UI while remaining bookable
at the supplier. That is intended, and only ever removes the dearer of two identical-termed offers.

One thing this does not address: `Stanford Hotel Myeongdong`'s family room runs ₩52,075 to ₩56,198
and then jumps to **₩322,888** for terms indistinguishable from the ₩52,441 offer. Six times the
price for no stated difference. It survives de-duplication because its deadline differs by seven
hours. Whether that is an unstated inclusion or supplier junk is unknown, and until someone finds
out it will sit in the chip row looking like a bug.

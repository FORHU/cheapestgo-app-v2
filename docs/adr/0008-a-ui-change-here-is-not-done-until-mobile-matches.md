# A UI change here is not done until mobile matches

**Status:** accepted · 2026-11-10

The Flutter app (`cheapest-go-mobile`) now takes its appearance from V2 at the mobile
breakpoint: same sections, same components, same strings, same bottom bar. V2's UI moves about
twice a day — 129 commits across `src/features` and `src/shared/components` in the 60 days to
2026-11-10 — so a one-time port would have been stale before it shipped. Rather than let the
two drift and periodically re-sync, a V2 pull request that touches a mirrored screen is not
complete until the matching Flutter screen changes with it.

A checked-in manifest lists the paths that have Flutter counterparts. CI fails a pull request
touching one of them unless it links a mobile pull request or carries an explicit exemption
label. The manifest is also the authoritative answer to "is this screen mirrored?".

## Considered Options

Pinning mobile to a V2 tag and reconciling once per mobile release was the safer option and was
rejected deliberately: it accepts a known-stale app between releases, and the reconciliation
diff grows faster than anyone schedules time to read it. Best-effort with no mechanism was
rejected because at this commit rate the gap compounds silently and surfaces as a complaint.

## Order of merging

The gate requires a *linked* mobile pull request, not a merged one, and that is load-bearing
rather than lax. Mobile regenerates its tokens and copy from a pinned V2 commit, so a mobile
pull request carrying a change that has not landed here yet cannot verify itself against this
repository's default branch. Read the other way round, the two block each other forever.

So: this pull request merges once the mobile one exists and is approved, and the mobile pull
request then bumps its pin to the resulting merge commit and lands. The products disagree for
the minutes in between, which is the price of not deadlocking.

## Consequences

Web velocity now pays for mobile consistency. A change to a mirrored screen needs a Dart change
and a Dart reviewer, and a web merge can be blocked by the mobile repository. That is the
intended cost, not an accident of the tooling.

The exemption label is the pressure valve, and it must stay visible — an exemption is a recorded
decision to let the two diverge, and a growing list of them is the signal that this ADR is no
longer being honoured and should be revisited rather than quietly ignored.

Mobile's own glossary carries the vocabulary: **Design Source**, **Design Parity** and **Token
Authority** in `cheapest-go-mobile/CONTEXT.md`. Note **Token Authority** in particular — where a
screen here contradicts `palette.ts`, mobile implements the token and raises the screen as a
defect, so this ADR will generate bug reports against V2's own styling.

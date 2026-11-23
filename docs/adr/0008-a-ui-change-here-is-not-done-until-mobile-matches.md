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

## The gate

Built in #32. The manifest is `mirrored-screens.json` at the repository root, and
`.github/workflows/mirrored-screens.yml` runs `scripts/mirrored-screens.ts` on every pull
request — again whenever its description or labels change, so fixing a red check never takes a
new commit. Branch protection should require its job, **Mobile parity (ADR-0008)**.

**Linking** means the mobile pull request's full URL in this pull request's description:
`https://github.com/FORHU/cheapest-go-mobile/pull/<number>`. Not `FORHU/cheapest-go-mobile#123`,
which reads the same whether 123 is an issue or a pull request — and linking the mobile *issue*
is the likeliest way to get this wrong. A link inside an HTML comment does not count, so a
template's example cannot satisfy the check. Approval is not checked: the mobile pull request is
approved after this one is opened, and a check that went red waiting for it would never be
re-run.

**The exemption label is `mobile-parity-exempt`**, for a change that does not reach what the
screen shows or does: a refactor, a test, a renamed import. The check still passes, with a
warning naming the screens it leaves diverging. `is:pr label:mobile-parity-exempt` lists every
use, and that list is the signal the next section asks someone to watch.

**A screen is added in the slice that brings it to parity, never before.** An entry blocks web
pull requests until mobile follows, so an entry for unfinished mobile work blocks the web team
on work that does not exist yet. Each names the screen, the paths here that make it up, and the
Flutter files that mirror it. Patterns are written from the repository root: `*` stays within
one folder, `**` crosses any number, and everything else is literal, so `[locale]` and
`(dashboard)` are those folders rather than glob character classes. The check fails when a
pattern matches no file, so a screen that moves cannot leave its entry guarding nothing.

**It gates paths, so it covers a screen's own files.** A shared file that every screen imports
would block every pull request. Copy and tokens reach mobile another way — through its pinned
V2 commit (mobile's ADR-0002) — and are not this check's business.

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

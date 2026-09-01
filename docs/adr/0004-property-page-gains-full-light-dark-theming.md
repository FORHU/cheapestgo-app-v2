# Property Page Gains Full Light/Dark Theming

**Date:** 2026-08-27
**Status:** Accepted

## Context

The property page (`src/app/[locale]/property/[id]/page.tsx`) hardcodes dark colors throughout — `PropertyDescription`'s own comment explains why: *"the property page hardcodes dark... the section would otherwise come up light under a light theme, on a black ground, with cream text around it."* `RoomSelection` and `PropertyDescription` both already accept a `tone` prop and default to the app's `useTheme()` context when it's omitted — the property page is the one caller that overrides it to `"dark"` unconditionally. The page's own Hero, photo gallery, lightbox, review cards, bottom booking bar, and the nearby-places map style (`mapbox://styles/mapbox/dark-v11`) are not theme-aware at all — colors are inline hex/rgba literals.

A theme toggle was requested on the banner, aligned with the back button.

## Decision

Give the property page real light/dark support rather than a toggle that only looks functional. `RoomSelection` and `PropertyDescription` switch from a hardcoded `tone="dark"` to `tone={theme}`, and the page's own hardcoded sections (Hero, gallery, lightbox, reviews, bottom bar) get a palette function of their own, following the same pattern those two components already use. The nearby-places map switches its Mapbox style with the theme too.

## Consequences

- This reverses the page's previous fixed-dark, immersive design in favor of app-wide theme consistency.
- Meaningfully larger than a single button: every hardcoded color on the page (~29 literals in the page file alone) needs a light-mode counterpart.
- `RoomSelection`/`PropertyDescription` need no structural change — only the `tone` prop they're called with.

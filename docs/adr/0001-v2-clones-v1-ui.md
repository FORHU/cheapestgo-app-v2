# ADR 0001 — V2 Adopts V1's Full UI and Feature Set

**Date:** 2026-07-01  
**Status:** Accepted

## Context

V2 (`cheapestgo-app-v2`) was started with a cleaner feature-based architecture but shipped with a simplified UI that diverged from V1 (`cheapest-go-app`). Both apps are the same product (CheapestGo), targeting the same users. The visual and feature gap created unnecessary maintenance burden: changes made to V1's UI were not reflected in V2.

## Decision

V2 will be a pixel-perfect clone of V1's UI and feature set. This includes:

- **CSS system**: Tailwind v4 (`@theme` syntax, fluid typography, oklch color space), not Tailwind v3
- **i18n**: next-intl with cookie-based locale switching (en, ko, ja, cn) — same `src/i18n/request.ts` pattern as V1
- **Landing page**: All sections — Hero, RecentlyViewed, YourRecentSearches, TopCitiesSection, TopDestinationsSection, DealsSection (streamed), PopularDestinations, HowItWorks, AppBanner
- **Providers**: QueryProvider, ThemeProvider, PWAInstallProvider, NextIntlClientProvider — same nesting order as V1
- **Floating UI**: GlobalSparkle, MobileBottomNav, ScrollToTop, AuthModal, InstallPWAPrompt
- **All pages**: Every route in V1 is replicated in V2 with identical visual treatment

V2-unique AI features (ChatWonder, Voice Layer) are deferred — not deleted permanently.

## Alternatives Considered

1. **Visual parity only** — keep V2's simpler feature set, just match colors/fonts. Rejected: sections like RecentlyViewed and Deals are core UX, not decoration.
2. **Port V2 AI features to V1 instead** — rejected: V2's architecture is cleaner and is the intended long-term home.
3. **Hardcode English in ported components** — rejected: user wants full next-intl setup to support KRW/language toggle visible in V1's navbar.

## Consequences

- V2 must upgrade Tailwind v3 → v4 (breaking change to CSS syntax — no `tailwind.config.ts`, all config moves to `globals.css` `@theme` block)
- All V1 component ports must adapt import paths to V2's `src/shared/` and `src/features/` conventions
- next-intl requires `src/i18n/request.ts` and `src/locales/*.json` to be copied from V1
- V2's `src/shared/stores/` must be expanded to match V1's full store surface (`useSearchStore`, `useRecentSearches`, `useUserCurrency`, auth stores, checkout store)

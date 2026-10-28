# Brand Preview on Non-Production Deployments

**Date:** 2026-10-13
**Status:** Accepted

## Context

v1's [ADR-0005](../../../cheapest-go-app/docs/adr/0005-geomeego-white-label-deployment.md) serves each
brand from its own deployment, with the brand a build-time constant (`NEXT_PUBLIC_BRAND_NAME`), and
explicitly rejects choosing the brand per request: every brand conditional becomes a runtime branch,
and one failure takes both brands down together.

v2 is not finished, and it is deployed so the work can be looked at. Under that rule the only way to
see AirangGo on a deployed v2 was a second build per branch with a different env var — locally, a
separate dist directory and a second dev server (see `distDir` in `next.config.ts`). Reviewing both
brands meant standing up two deployments of work that was not ready for either.

v2 also honoured only the brand *name*. The tab icon, share card and Organization record were
CheapestGo's whatever the brand, so an AirangGo build named itself AirangGo in the header and
`cheapestgo.com` in its structured data.

## Decision

A deployment may let the visitor choose between CheapestGo and AirangGo — **only when it opts in**.

- **The gate.** `brandPreviewEnabled()`: `BRAND_PREVIEW=1`/`true`, or a local `next dev`. Anything
  else, including production, is off. Off, nothing below has any effect: the brand is the build's.
- **How it is chosen.** `?brand_preview=airanggo` (or `cheapestgo`, or `default` to clear). The
  middleware stores the pick in an `HttpOnly` cookie and redirects to the same URL without the
  parameter. A host on a brand's own domain (`v2.airanggo.com`) implies that brand when nothing was
  picked. Precedence: pick, then host, then the build.
- **What is accepted.** An allowlist of the two brands, never a free string — the value is printed
  into titles, copy and the privacy policy.
- **Where it is read.** The server resolves the brand once per request (`getBrandName()`), feeds it to
  metadata and to the translated copy (`applyBrand`), and hands it to client components through
  `BrandProvider`, so the header cannot disagree with the tab title. `DEPLOYMENT_BRAND_NAME` is what
  the build was made for and is the fallback, not "the brand being shown".
- **What a brand carries.** `brandProfile()` — origin, tab icon, share logo — so AirangGo stops
  borrowing CheapestGo's.
- **A control.** `BrandPreviewSwitcher`, rendered only when the gate is on.

## Consequences

- **Production is unchanged**, and the property worth testing is that: with the flag unset a
  `?brand_preview=` link and a forged cookie are both ignored (`middleware.brandPreview.test.ts`).
  Production pages also keep not reading the request at all.
- **It is display-only.** api-v2 attributes a booking, an email and an invoice to the brand it was
  itself started with. A booking made while previewing AirangGo against a CheapestGo API is still a
  CheapestGo booking. Do not point a previewing deployment at a production API.
- **The locale lock is separate.** `NEXT_PUBLIC_LOCALE=ko` is also build-time and is not switched by
  the preview, so a previewed AirangGo is browsable in every language.
- **Promoting a preview build to production** carries `BRAND_PREVIEW` with it on hosts that do not
  rebuild on promotion. Scope the variable to the Preview environment, and rebuild for production.
- **Contact details are still CheapestGo's.** `support@cheapestgo.com` in the header, footer and About
  page is configuration, not brand name, and is unchanged — see `applyBrand`.
- This does not reopen ADR-0005 for production. Independent rollback and a brand that cannot be
  switched by a link are still what production gets.

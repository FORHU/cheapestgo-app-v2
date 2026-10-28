# ADR 0006 — The Staff Host Is a Security Boundary

**Date:** 2026-10-26
**Status:** Accepted

## Context

Staff screens live at `/admin`, a path on the public storefront. `src/middleware.ts` already keeps that
tree outside the **Locale Segment** and checks for a session cookie before rendering it, and `CONTEXT.md`
already calls it "staff-facing". So the separation exists — but only as a path.

A path cannot be firewalled. There is no way to put an IP allowlist, a VPN or an identity proxy in front
of `cheapestgo.com/admin` without putting it in front of `cheapestgo.com`, and the storefront must stay
open to the world. Everything protecting the destructive surface — refunds, user bans, Stripe, supplier
configuration — is therefore application code reached over the open internet.

The existing position is explicit, and this ADR reverses it. `[locale]/support/login/page.tsx` states:

> Same credentials, same session, same cookie — what differs is where you land and what you are told if
> you do not belong here. **Not a security boundary.** Nothing is granted by arriving through this URL
> rather than the other one: the roles decide, and they decide identically at both doors.

That was right for a second path. It is the wrong answer for a second host.

## Decision

Staff work from their own hostname, and that hostname is a boundary.

- **Both staff populations live there.** **Admins** and **Support Agents** share one host, because
  `/admin/support` and the ported desk both sit in the `/admin` tree. The roles still decide authority
  *inside* it — the host decides who may reach it at all.
- **Its own origin, therefore its own session.** A **Customer** session on the storefront confers nothing
  on the staff host. Staff sign in there separately.
- **The session cookie is renamed `__Host-access_token`.** The `__Host-` prefix is enforced by the browser:
  a cookie carrying it is rejected unless it is `Secure`, `Path=/`, and has **no `Domain` attribute**. Host
  scoping stops being a convention a later edit can quietly undo — adding `domain=.cheapestgo.com` makes
  the cookie visibly fail to set rather than silently widening it to every subdomain. `sameSite: 'strict'`
  is unchanged.
- **The API is same-origin on the staff host.** `sameSite: 'strict'` blocks a cross-site call, so
  `/api/v2` is proxied under the staff host rather than reached on the storefront's.
- **Google sign-in is kept.** The OAuth callback carries the intended return origin in `state`, validated
  against an **allowlist** of known hosts, replacing the single baked `config.SITE_URL`. The allowlist is
  the part that matters: an unvalidated return origin would trade a subdomain boundary for an open redirect.
- **The storefront returns 404 for `/admin`.** Without this the host is cosmetic — two doors into one room,
  and the firewall in front of one of them proves nothing.

## Alternatives Considered

**Share the session across subdomains** (`domain=.cheapestgo.com`, `sameSite` relaxed to `lax`). One
sign-in for everything. Rejected: it widens the session to every present and future subdomain, and
relaxing `sameSite` weakens CSRF posture for *customer* sessions to buy staff convenience. The blast
radius of a single subdomain takeover becomes every logged-in account.

**Leave admin on the main domain.** Zero work. Rejected: it keeps the destructive surface on the public
host, which is the entire problem.

**Password-only staff login**, to dodge OAuth's single baked return URL. Rejected once the allowlisted
`state` approach was understood — it solved a real problem the wrong way, and staff expect Google sign-in.

## Consequences

- **Staff sign in twice** — once as themselves on the storefront if they use it, once on the staff host.
  Deliberate: it is what makes a stolen customer session worthless for admin.
- **The network rule applies to both populations.** An office-IP allowlist that is right for Admins also
  constrains Support Agents answering tickets from home. The boundary is per-host, not per-role, so this
  has to be decided for the stricter of the two.
- **`__Host-` requires HTTPS everywhere, including local development**, or the cookie will not set. Local
  work needs HTTPS or a development-only cookie name.
- **The claim in `[locale]/support/login/page.tsx` is now wrong** and must be corrected, or the next
  reader will trust a comment that says the opposite of what the system does.
- **The staff host carries `noindex`**, HSTS, `X-Frame-Options: DENY` and a strict CSP. It is reachable by
  staff, not by crawlers.

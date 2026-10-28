/**
 * What each role may reach, in one place.
 *
 * The guards here read `users.role`; they do not decide it. api-v2 is the authority and
 * re-checks on every call — this module only keeps the front end from rendering a screen
 * its viewer is about to be refused, and from scattering the literal `'admin'` across
 * twenty files where "what can a Support Agent see?" can only be answered by reading all
 * of them.
 *
 * Every function refuses a value it does not recognise, so a role invented in a newer
 * deployment, or a typo in a hand-written UPDATE, loses access rather than gaining it.
 */

export const ROLES = ['user', 'admin', 'support_agent'] as const;

export type Role = (typeof ROLES)[number];

/** Narrow an unvalidated value — a store field, an API response — to a known role. */
export function isRole(value: unknown): value is Role {
    return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** May reach the back office: bookings, revenue, Stripe, settings, everyone's data. */
export function canAdminister(role: string | null | undefined): boolean {
    return role === 'admin';
}

/**
 * May staff the Support Desk: answer tickets, set the hours, look a booking up read-only.
 *
 * True for admins as well. An admin answering a ticket is an Agent too — the desk is a
 * narrower workspace, not a place administrators are shut out of.
 */
export function canStaffSupport(role: string | null | undefined): boolean {
    return role === 'admin' || role === 'support_agent';
}

/**
 * Where signing in should put someone, or null to let the caller decide.
 *
 * Null is for customers, where wherever they came from is a better answer than anything a
 * role can supply.
 *
 * The invariant worth keeping: a destination handed out here must sit inside a gate that
 * admits that role. An Agent was previously sent to `/admin/support`, which is behind the
 * back office's admin-only gate — so signing in redirected them to a page that immediately
 * redirected them out again.
 */
export function landingFor(role: string | null | undefined): string | null {
    if (canAdminister(role)) return '/admin/overview';
    if (canStaffSupport(role)) return '/admin/desk';
    return null;
}

import { describe, it, expect } from 'vitest';
import { canAdminister, canStaffSupport, isRole, landingFor, ROLES } from '@/shared/auth/roles';

/**
 * Who may reach which part of the back office.
 *
 * Pinned because the gap here was invisible and total: `/admin`'s only layout required
 * `admin`, `landingFor` sent a Support Agent to `/admin/support` inside it, and the page
 * there carried a comment saying Agents could reach it. Every piece looked deliberate, and
 * the result was that an Agent signing in was redirected to an inbox and then bounced
 * straight back out to the storefront. The front end's `User.role` did not even include
 * `support_agent`, so the type system agreed the person could not exist.
 *
 * These tests are the cheap part. They would have caught all of it.
 */
describe('role predicates', () => {
    it('admits only an admin to the back office', () => {
        expect(canAdminister('admin')).toBe(true);
        expect(canAdminister('support_agent')).toBe(false);
        expect(canAdminister('user')).toBe(false);
    });

    it('admits both staff roles to the support desk', () => {
        // An admin answering a ticket is an Agent too — the desk is a narrower workspace,
        // not a place administrators are shut out of.
        expect(canStaffSupport('admin')).toBe(true);
        expect(canStaffSupport('support_agent')).toBe(true);
    });

    it('refuses a customer, an unknown role and an absent one', () => {
        for (const value of ['user', 'superuser', '', null, undefined]) {
            expect(canStaffSupport(value)).toBe(false);
            expect(canAdminister(value)).toBe(false);
        }
    });

    it('recognises exactly the three roles the database carries', () => {
        expect([...ROLES]).toEqual(['user', 'admin', 'support_agent']);
        expect(isRole('support_agent')).toBe(true);
        expect(isRole('agent')).toBe(false);
    });
});

describe('where signing in puts staff', () => {
    it('sends a Support Agent to the desk, not into the back office', () => {
        // `/admin/support` is inside the (dashboard) group, whose layout requires `admin`.
        // Landing an Agent there is landing them on a redirect back to the storefront.
        expect(landingFor('support_agent')).toBe('/admin/desk');
    });

    it('sends an admin to the overview', () => {
        expect(landingFor('admin')).toBe('/admin/overview');
    });

    it('leaves a customer alone — they were already going somewhere', () => {
        expect(landingFor('user')).toBeNull();
        expect(landingFor(undefined)).toBeNull();
    });

    it('never lands staff anywhere their own gate would refuse them', () => {
        // The invariant the bug broke: the destination a role is given must be inside a
        // gate that admits that role.
        const gateFor = (path: string) =>
            path.startsWith('/admin/desk') ? canStaffSupport : canAdminister;

        for (const role of ROLES) {
            const landing = landingFor(role);
            if (!landing) continue;
            expect(gateFor(landing)(role), `${role} → ${landing}`).toBe(true);
        }
    });
});

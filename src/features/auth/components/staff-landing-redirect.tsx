'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/shared/auth/store';
import { landingFor } from '@/shared/auth/roles';

export { landingFor };

/**
 * Skip the form for someone already signed in as staff.
 *
 * Renders nothing. It exists so the staff door can be a Server Component — v2 reads the
 * session in the browser, so the check cannot happen where the page is built.
 *
 * A customer who lands here is deliberately left alone rather than bounced: they may be
 * about to sign in as themselves, and this door works for that too.
 */
export function StaffLandingRedirect() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const isLoading = useAuthStore((s) => s.isLoading);

    useEffect(() => {
        if (isLoading || !user) return;

        // Only when the back office is reachable from the host being viewed.
        //
        // `landingFor` returns a path, and `/admin` exists on the staff host alone — the
        // storefront 404s it (`src/middleware.ts`). Sending an Admin there from the
        // storefront's sign-in page lands them on that 404, which is what happened when the
        // Google callback returned to the storefront and this component followed it.
        //
        // Nothing is bounced across to the staff host either. The two are separate origins
        // with separate sessions by design (ADR-0006), and staff signing in on the storefront
        // are customers there — an Admin booking a hotel should not be yanked to the console.
        const staffHost = process.env.NEXT_PUBLIC_STAFF_HOST?.trim().toLowerCase();
        if (staffHost && window.location.hostname.toLowerCase() !== staffHost) return;

        const landing = landingFor(user.role);
        if (landing) router.replace(landing);
    }, [user, isLoading, router]);

    return null;
}

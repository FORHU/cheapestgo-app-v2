'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/shared/auth/store';

/** Where signing in puts staff. Null for a customer — they were already going somewhere. */
export function landingFor(role: string | null | undefined): string | null {
    if (role === 'admin') return '/admin/overview';
    if (role === 'support_agent') return '/admin/support';
    return null;
}

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
        const landing = landingFor(user.role);
        if (landing) router.replace(landing);
    }, [user, isLoading, router]);

    return null;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/store';
import { canAdminister } from '@/shared/auth/roles';
import { AdminSidebar } from '@/features/admin/components/admin-sidebar';
import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * The back office, for Admins only.
 *
 * A route group rather than the whole of `/admin`, because the Support Desk is a sibling
 * under the same prefix with a wider gate: a Support Agent belongs at `/admin/desk` and
 * nowhere else in here. Grouping changes no URL — `/admin/overview` is still
 * `/admin/overview` — it only stops this gate from running for the desk.
 */
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();

    // Once auth resolves, anyone who is not an Admin leaves. A Support Agent is sent to the
    // desk rather than the storefront: they are staff, they are signed in, and dropping them
    // on the marketing site is how you lose the inbox.
    useEffect(() => {
        if (isLoading) return;
        if (canAdminister(user?.role)) return;
        router.replace(user?.role === 'support_agent' ? '/admin/desk' : '/');
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="space-y-3 w-64">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
        );
    }

    if (!canAdminister(user?.role)) {
        // Still rendering (redirect in flight) — show nothing
        return null;
    }

    return (
        <div className="min-h-screen flex bg-slate-50">
            <AdminSidebar />
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}

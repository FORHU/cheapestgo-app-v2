'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/store';
import { AdminSidebar } from '@/features/admin/components/admin-sidebar';
import { Skeleton } from '@/shared/components/ui/skeleton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();

    // Redirect non-admins once auth resolves
    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'admin')) {
            router.replace('/');
        }
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

    if (!user || user.role !== 'admin') {
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

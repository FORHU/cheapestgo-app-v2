'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Headphones } from 'lucide-react';
import { useAuthStore } from '@/shared/auth/store';
import { canStaffSupport } from '@/shared/auth/roles';
import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * The Support Desk.
 *
 * A sibling of the `(dashboard)` group rather than a page inside it, so it gets its own
 * chrome while staying under `/admin` — which means the middleware's session guard already
 * covers it and there is no prefix list to remember to extend.
 *
 * The gate is repeated here rather than inherited: a layout in another route group does not
 * run for this one, and "it is under /admin" only proves a cookie exists. It is also wider
 * than the dashboard's on purpose — this is the one place in the back office a Support Agent
 * belongs, and until it existed an Agent signing in was redirected to `/admin/support` and
 * then bounced straight back out to the storefront by the dashboard's admin-only gate.
 *
 * No sidebar. The desk has two screens, so they sit in the header — a sidebar listing the
 * back-office sections an Agent may not open is worse than no sidebar at all.
 */
const TABS = [
    { href: '/admin/desk',          label: 'Inbox' },
    { href: '/admin/desk/settings', label: 'Hours' },
] as const;

export default function DeskLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (isLoading) return;
        if (canStaffSupport(user?.role)) return;
        router.replace('/');
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-64 space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
        );
    }

    if (!canStaffSupport(user?.role)) return null;

    // Named here rather than left to the view: a hard refresh onto the desk leaves the
    // client store empty for a moment, and an Agent greeted as nobody on their own console
    // reads as a broken page.
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
                        <Headphones size={16} />
                    </span>
                    <h1 className="text-sm font-bold tracking-tight text-slate-900">Support Desk</h1>
                    <nav aria-label="Support desk" className="ml-2 flex items-center gap-1">
                        {TABS.map(tab => {
                            const current = pathname === tab.href;
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    aria-current={current ? 'page' : undefined}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        current
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                {name && (
                    <span className="truncate text-xs font-semibold text-slate-500">{name}</span>
                )}
            </header>
            <main className="flex-1 overflow-auto">{children}</main>
        </div>
    );
}

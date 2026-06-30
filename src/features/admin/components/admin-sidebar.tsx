'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    BookOpen,
    Users,
    Tag,
    PlaneTakeoff,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';

const NAV_ITEMS = [
    { href: '/admin/overview',  label: 'Overview',   icon: LayoutDashboard },
    { href: '/admin/bookings',  label: 'Bookings',   icon: BookOpen },
    { href: '/admin/customers', label: 'Customers',  icon: Users },
    { href: '/admin/deals',     label: 'Deals',      icon: Tag },
] as const;

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-60 shrink-0 min-h-screen bg-slate-900 flex flex-col">
            {/* Logo */}
            <div className="h-14 flex items-center px-5 border-b border-white/5">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <PlaneTakeoff size={16} className="text-blue-400" />
                    <span className="text-sm font-bold text-white tracking-tight">
                        Cheapest<span className="text-blue-400">Go</span>
                        <span className="ml-1.5 text-[9px] uppercase tracking-widest text-slate-500 font-semibold">
                            Admin
                        </span>
                    </span>
                </Link>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                                isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            )}
                        >
                            <Icon size={16} className="shrink-0" />
                            <span className="flex-1">{label}</span>
                            {isActive && <ChevronRight size={14} className="opacity-60" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-white/5">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                    Back to app
                </Link>
            </div>
        </aside>
    );
}

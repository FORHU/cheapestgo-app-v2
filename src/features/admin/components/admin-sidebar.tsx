'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    BookOpen,
    Users,
    Tag,
    MessageCircle,
    PlaneTakeoff,
    ChevronRight,
    Shield,
    Building2,
    Banknote,
    MapPin,
    Bookmark,
    Mail,
    BarChart3,
    Bell,
    Star,
    Settings,
    CreditCard,
    Plane,
    Globe,
    Smartphone,
    Clock,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/**
 * Every back-office page, grouped.
 *
 * This listed five of the twenty-one pages that exist under `/admin`, so the other sixteen
 * were reachable only by typing the URL — they read as "not migrated yet" when they had all
 * been built. The grouping is v1's, because that is the behaviour staff already know; the
 * look is this sidebar's own.
 *
 * A page added under `/admin` belongs in a group here, or it is invisible again.
 */
const NAV_GROUPS = [
    {
        title: 'Menu',
        items: [
            { href: '/admin/overview',     label: 'Overview',     icon: LayoutDashboard },
            { href: '/admin/bookings',     label: 'Bookings',     icon: BookOpen },
            { href: '/admin/customers',    label: 'Customers',    icon: Users },
            { href: '/admin/users',        label: 'Users',        icon: Shield },
            { href: '/admin/suppliers',    label: 'Suppliers',    icon: Building2 },
            { href: '/admin/revenue',      label: 'Revenue',      icon: Banknote },
        ],
    },
    {
        title: 'Content',
        items: [
            { href: '/admin/destinations', label: 'Destinations', icon: MapPin },
            { href: '/admin/deals',        label: 'Deals',        icon: Tag },
            { href: '/admin/saved-trips',  label: 'Saved Trips',  icon: Bookmark },
            { href: '/admin/reviews',      label: 'Reviews',      icon: Star },
        ],
    },
    {
        title: 'General',
        items: [
            { href: '/admin/support',      label: 'Support',      icon: MessageCircle },
            { href: '/admin/communication',label: 'Communication',icon: Mail },
            { href: '/admin/analytics',    label: 'Analytics',    icon: BarChart3 },
            { href: '/admin/price-alerts', label: 'Price Alerts', icon: Bell },
            { href: '/admin/settings',     label: 'Settings',     icon: Settings },
        ],
    },
    {
        title: 'Integrations',
        items: [
            { href: '/admin/stripe',       label: 'Stripe',       icon: CreditCard },
            { href: '/admin/duffel',       label: 'Duffel',       icon: Plane },
            { href: '/admin/travelgatex',  label: 'TravelgateX',  icon: Globe },
            { href: '/admin/mobile',       label: 'Mobile App',   icon: Smartphone },
            { href: '/admin/crons',        label: 'Crons',        icon: Clock },
        ],
    },
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

            {/* Nav — scrolls on its own so the logo and footer stay put on a short window */}
            <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
                {NAV_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-px">
                        <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {group.title}
                        </p>
                        {group.items.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname === href || pathname.startsWith(`${href}/`);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors group',
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
                    </div>
                ))}
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

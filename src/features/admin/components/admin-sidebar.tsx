'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Menu,
    X,
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
    Flag,
    CalendarCheck,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { adminGolfApi } from '@/features/golf/api/golf.api';

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
            { href: '/admin/golf/bookings', label: 'Golf Bookings', icon: CalendarCheck },
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
            { href: '/admin/golf',         label: 'Golf Courses', icon: Flag },
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

/** The most specific link wins: on `/admin/golf/bookings`, Golf Bookings is lit and Golf Courses is not. */
function activeHref(pathname: string): string | undefined {
    return NAV_GROUPS
        .flatMap((group) => group.items.map((item): string => item.href))
        .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
        .sort((a, b) => b.length - a.length)[0];
}

/** Fired on `window` by whatever has just answered a golf request, so the count comes down at once. */
export const GOLF_BOOKINGS_CHANGED = 'golf-bookings-changed';
/** How often an open back office looks for new requests. */
const GOLF_POLL_MS = 60_000;

/**
 * How many golf requests are waiting for an answer. A request nobody answers is declined at its
 * deadline, so this is drawn on the link for anyone in the back office to see. Zero for someone who
 * may not read them: the list is admin-only, and a support agent has nothing to do about it.
 */
function useGolfRequestsWaiting(pathname: string): number {
    const [waiting, setWaiting] = useState(0);
    useEffect(() => {
        let cancelled = false;
        const ask = () => {
            adminGolfApi.listBookings('waiting', 1)
                .then((res) => { if (!cancelled) setWaiting(res.total ?? 0); })
                .catch(() => { if (!cancelled) setWaiting(0); });
        };
        ask();
        const id = window.setInterval(ask, GOLF_POLL_MS);
        window.addEventListener(GOLF_BOOKINGS_CHANGED, ask);
        return () => {
            cancelled = true;
            window.clearInterval(id);
            window.removeEventListener(GOLF_BOOKINGS_CHANGED, ask);
        };
    }, [pathname]);
    return waiting;
}

function AdminWordmark() {
    return (
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <PlaneTakeoff size={16} className="text-blue-400" />
            <span className="text-sm font-bold text-white tracking-tight">
                Cheapest<span className="text-blue-400">Go</span>
                <span className="ml-1.5 text-[9px] uppercase tracking-widest text-slate-500 font-semibold">
                    Admin
                </span>
            </span>
        </Link>
    );
}

/**
 * The back office's navigation: a column beside the page from `lg`, a drawer below it.
 *
 * It was a 240px column at every width, which on a phone left the page about 120px — no
 * back-office screen could be read, let alone worked, on one. Below `lg` the column is a
 * drawer instead, opened from a bar across the top: over a scrim, closed by the scrim, its
 * own close button, Escape, or following a link. The drawer is always in the document and
 * only moved off-screen, so the links are the same links at every width.
 */
export function AdminSidebar() {
    const pathname = usePathname();
    const active = activeHref(pathname);
    const golfWaiting = useGolfRequestsWaiting(pathname);

    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLButtonElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    // A link followed is a page reached: the drawer has done its job.
    useEffect(() => { setOpen(false); }, [pathname]);

    // Focus goes into the drawer when it opens and back to the menu button when Escape closes it.
    useEffect(() => {
        if (!open) return;
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setOpen(false);
            menuRef.current?.focus();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <>
            {/* The bar the drawer opens from — below `lg` only, where there is no column. */}
            <div className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-slate-900 px-2 lg:hidden">
                <button
                    ref={menuRef}
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Open menu"
                    aria-expanded={open}
                    aria-controls="admin-sidebar"
                    className="flex size-10 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                    <Menu size={20} />
                </button>
                <AdminWordmark />
            </div>

            {open && (
                <div
                    aria-hidden="true"
                    data-testid="admin-sidebar-scrim"
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
                />
            )}

            <aside
                id="admin-sidebar"
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-slate-900 transition-transform duration-200 ease-out',
                    open ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
                    'lg:static lg:z-auto lg:min-h-screen lg:shrink-0 lg:translate-x-0 lg:shadow-none lg:transition-none',
                )}
            >
                {/* Logo */}
                <div className="h-14 flex items-center justify-between px-5 border-b border-white/5">
                    <AdminWordmark />
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={() => { setOpen(false); menuRef.current?.focus(); }}
                        aria-label="Close menu"
                        className="-mr-3 flex size-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Nav — scrolls on its own so the logo and footer stay put on a short window */}
                <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.title} className="space-y-px">
                            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                {group.title}
                            </p>
                            {group.items.map(({ href, label, icon: Icon }) => {
                                const isActive = active === href;
                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        className={cn(
                                            // Taller rows in the drawer, where a thumb picks them; the column keeps its 1.5.
                                            'flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13px] font-medium transition-colors group lg:py-1.5',
                                            isActive
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        )}
                                    >
                                        <Icon size={16} className="shrink-0" />
                                        <span className="flex-1">{label}</span>{' '}
                                        {href === '/admin/golf/bookings' && golfWaiting > 0 && (
                                            <span
                                                aria-label={`${golfWaiting} waiting`}
                                                className="min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[11px] leading-5 font-semibold text-white"
                                            >
                                                {golfWaiting}
                                            </span>
                                        )}
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
        </>
    );
}

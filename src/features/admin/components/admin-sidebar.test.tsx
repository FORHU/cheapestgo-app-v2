/**
 * The sidebar lists every back-office page.
 *
 * It listed five of twenty-one, so the rest were reachable only by typing the URL and read as
 * unmigrated work. Comparing against the filesystem rather than a second hand-written list,
 * because a list that has to be updated alongside the sidebar is the same bug one step away.
 */

import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { AdminSidebar, GOLF_BOOKINGS_CHANGED } from '@/features/admin/components/admin-sidebar';

const nav = vi.hoisted(() => ({ pathname: '/admin/overview' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
const golf = vi.hoisted(() => ({ listBookings: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => ({ adminGolfApi: golf }));

beforeEach(() => {
    golf.listBookings.mockReset();
    golf.listBookings.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
});

/** Every page under the (dashboard) group, at any depth. A dynamic segment is reached from its list, not the sidebar. */
function pagesOnDisk(dir = path.join(process.cwd(), 'src/app/admin/(dashboard)'), route = '/admin'): string[] {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('['))
        .flatMap(d => {
            const child = path.join(dir, d.name);
            const here = `${route}/${d.name}`;
            return [...(fs.existsSync(path.join(child, 'page.tsx')) ? [here] : []), ...pagesOnDisk(child, here)];
        })
        .sort();
}

describe('AdminSidebar', () => {
    it('links every page under (dashboard)', () => {
        render(<AdminSidebar />);

        const linked = screen
            .getAllByRole('link')
            .map(a => a.getAttribute('href') ?? '')
            .filter(h => h.startsWith('/admin/'))
            .sort();

        expect(linked).toEqual(pagesOnDisk());
    });

    it('lights only the most specific link, so a page under another page does not light both', () => {
        nav.pathname = '/admin/golf/bookings';
        render(<AdminSidebar />);
        const lit = (name: string) => screen.getByRole('link', { name }).className.includes('bg-blue-600');
        expect(lit('Golf Bookings')).toBe(true);
        expect(lit('Golf Courses')).toBe(false);
        nav.pathname = '/admin/overview';
    });

    it('still lights a link for a page beneath it', () => {
        nav.pathname = '/admin/golf/some-course';
        render(<AdminSidebar />);
        expect(screen.getByRole('link', { name: 'Golf Courses' }).className).toContain('bg-blue-600');
        nav.pathname = '/admin/overview';
    });

    it('groups them rather than listing twenty-one in a row', () => {
        render(<AdminSidebar />);
        for (const title of ['Menu', 'Content', 'General', 'Integrations']) {
            expect(screen.getByText(title)).toBeInTheDocument();
        }
    });

    /**
     * A golf request nobody answers is declined at its deadline, and no feed in the back office shows
     * them, so the count is the signal anyone already in the back office sees.
     */
    describe('golf requests waiting', () => {
        it('counts them on the link', async () => {
            golf.listBookings.mockResolvedValue({ data: [], total: 3, page: 1, pageSize: 25, totalPages: 1 });
            render(<AdminSidebar />);
            expect(await screen.findByRole('link', { name: 'Golf Bookings 3 waiting' })).toHaveAttribute('href', '/admin/golf/bookings');
            expect(golf.listBookings).toHaveBeenCalledWith('waiting', 1);
        });

        it('shows nothing when none are waiting', async () => {
            render(<AdminSidebar />);
            await waitFor(() => expect(golf.listBookings).toHaveBeenCalled());
            expect(screen.getByRole('link', { name: 'Golf Bookings' })).toBeInTheDocument();
        });

        it('shows nothing for someone who may not read them', async () => {
            golf.listBookings.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
            render(<AdminSidebar />);
            await waitFor(() => expect(golf.listBookings).toHaveBeenCalled());
            expect(screen.getByRole('link', { name: 'Golf Bookings' })).toBeInTheDocument();
        });

        it('asks again on moving to another page, so answering one brings the count down', async () => {
            const { rerender } = render(<AdminSidebar />);
            await waitFor(() => expect(golf.listBookings).toHaveBeenCalledTimes(1));
            nav.pathname = '/admin/customers';
            rerender(<AdminSidebar />);
            await waitFor(() => expect(golf.listBookings).toHaveBeenCalledTimes(2));
            nav.pathname = '/admin/overview';
        });

        it('asks again when a request has just been answered on this page', async () => {
            render(<AdminSidebar />);
            await waitFor(() => expect(golf.listBookings).toHaveBeenCalledTimes(1));
            window.dispatchEvent(new Event(GOLF_BOOKINGS_CHANGED));
            await waitFor(() => expect(golf.listBookings).toHaveBeenCalledTimes(2));
        });

        it('keeps asking while the back office is left open, so a new request shows up', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            try {
                render(<AdminSidebar />);
                await vi.waitFor(() => expect(golf.listBookings).toHaveBeenCalledTimes(1));
                await vi.advanceTimersByTimeAsync(60_000);
                expect(golf.listBookings).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });
    });
});

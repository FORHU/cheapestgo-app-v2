import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import type { GolfCourse } from '@/features/golf/types';

const adminGolfApi = vi.hoisted(() => ({
    list: vi.fn(), create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), remove: vi.fn(),
    listSchedules: vi.fn(), addSchedule: vi.fn(), removeSchedule: vi.fn(), listExtras: vi.fn(), setExtras: vi.fn(),
}));
vi.mock('@/features/golf/api/golf.api', () => ({ adminGolfApi }));

import { GolfCoursesView } from '@/features/admin/components/golf-courses-view';

const course = (over: Partial<GolfCourse>): GolfCourse => ({
    id: 'c1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 85, currency: 'USD', imageUrls: [], amenities: [],
    status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Manila', bookingWindowDays: 60, freeCancelHours: 48,
    scheduleCount: 1, bookable: true, ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    adminGolfApi.list.mockResolvedValue({
        data: [course({}), course({ id: 'c2', slug: 'sky72', name: 'Sky72', status: 'draft', timezone: null, scheduleCount: 0, bookable: false })],
        total: 2, page: 1, pageSize: 20, totalPages: 1,
    });
    adminGolfApi.listSchedules.mockResolvedValue([]);
    adminGolfApi.listExtras.mockResolvedValue([]);
});

describe('GolfCoursesView', () => {
    it('says which drafts cannot be published yet, and why', async () => {
        renderWithIntl(<GolfCoursesView />);
        const sky = (await screen.findByText('Sky72')).closest('tr')!;
        expect(within(sky).getByText('Not bookable: needs a time zone and a schedule')).toBeInTheDocument();
        const wack = screen.getByText('Wack Wack').closest('tr')!;
        expect(within(wack).queryByText(/Not bookable/)).toBeNull();
    });

    it("opens a course's tee times", async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfCoursesView />);
        await user.click(await screen.findByRole('button', { name: 'Tee times for Wack Wack' }));
        expect(await screen.findByText('Tee times — Wack Wack')).toBeInTheDocument();
        expect(adminGolfApi.listSchedules).toHaveBeenCalledWith('c1');
    });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import type { GolfCourse, TeeTimeSchedule } from '@/features/golf/types';

const adminGolfApi = vi.hoisted(() => ({ listSchedules: vi.fn(), addSchedule: vi.fn(), removeSchedule: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => ({ adminGolfApi }));

import { GolfTeeTimesPanel } from '@/features/admin/components/golf-tee-times-panel';

/** A course's tee-time schedules, as an admin keeps them. */

const course: GolfCourse = {
    id: 'c1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 85, currency: 'USD', imageUrls: [], amenities: [],
    status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Manila', bookingWindowDays: 60,
    scheduleCount: 1, bookable: true,
};

const weekdays: TeeTimeSchedule = {
    id: 's1', courseId: 'c1', name: 'Weekday mornings', daysOfWeek: [1, 2, 3, 4, 5], firstTee: '06:30', lastTee: '11:00',
    intervalMinutes: 8, spots: 4, pricePerPlayer: 85, createdAt: '',
};

beforeEach(() => {
    vi.clearAllMocks();
    adminGolfApi.listSchedules.mockResolvedValue([weekdays]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('GolfTeeTimesPanel', () => {
    it("asks for the course's time zone before anything else", () => {
        renderWithIntl(<GolfTeeTimesPanel course={{ ...course, timezone: null }} onChanged={vi.fn()} />);
        expect(screen.getByText(/Set this course's time zone first/)).toBeInTheDocument();
        expect(adminGolfApi.listSchedules).not.toHaveBeenCalled();
    });

    it('lists each schedule with its days, times, spots and price', async () => {
        renderWithIntl(<GolfTeeTimesPanel course={course} onChanged={vi.fn()} />);
        const row = (await screen.findByText('Weekday mornings')).closest('tr')!;
        expect(within(row).getByText('Mon, Tue, Wed, Thu, Fri')).toBeInTheDocument();
        expect(within(row).getByText('06:30–11:00 every 8 min')).toBeInTheDocument();
        expect(within(row).getByText('USD 85')).toBeInTheDocument();
    });

    it('adds a schedule, says how many tee times it made, and tells the list', async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn();
        adminGolfApi.addSchedule.mockResolvedValue({ schedule: { ...weekdays, id: 's2', name: 'Weekend' }, created: 42 });
        renderWithIntl(<GolfTeeTimesPanel course={course} onChanged={onChanged} />);
        await screen.findByText('Weekday mornings');

        await user.type(screen.getByLabelText('Name'), 'Weekend');
        await user.click(screen.getByLabelText('Sat'));
        await user.click(screen.getByLabelText('Sun'));
        await user.type(screen.getByLabelText('First tee'), '07:00');
        await user.type(screen.getByLabelText('Last tee'), '12:00');
        await user.clear(screen.getByLabelText('Every (minutes)'));
        await user.type(screen.getByLabelText('Every (minutes)'), '10');
        await user.type(screen.getByLabelText('Price per player (USD)'), '120');
        await user.click(screen.getByRole('button', { name: 'Add schedule' }));

        expect(adminGolfApi.addSchedule).toHaveBeenCalledWith('c1', {
            name: 'Weekend', daysOfWeek: [0, 6], firstTee: '07:00', lastTee: '12:00', intervalMinutes: 10, spots: 4, pricePerPlayer: 120,
        });
        expect(await screen.findByText('42 tee times created.')).toBeInTheDocument();
        expect(onChanged).toHaveBeenCalled();
    });

    it("shows the server's complaint beside the field it is about", async () => {
        const user = userEvent.setup();
        adminGolfApi.addSchedule.mockRejectedValue(Object.assign(new Error('Invalid request data'), {
            body: { details: { lastTee: ['Must not be before the first tee'] } },
        }));
        renderWithIntl(<GolfTeeTimesPanel course={course} onChanged={vi.fn()} />);
        await screen.findByText('Weekday mornings');
        await user.click(screen.getByRole('button', { name: 'Add schedule' }));
        expect(await screen.findByText('Must not be before the first tee')).toBeInTheDocument();
    });

    it("explains why a published course's last schedule stays", async () => {
        const user = userEvent.setup();
        adminGolfApi.removeSchedule.mockRejectedValue(new Error('This is the last tee-time schedule of a published course. Unpublish the course before deleting it.'));
        renderWithIntl(<GolfTeeTimesPanel course={course} onChanged={vi.fn()} />);
        await user.click(await screen.findByRole('button', { name: 'Delete Weekday mornings' }));
        expect(await screen.findByText(/Unpublish the course before deleting it/)).toBeInTheDocument();
    });

    it('deletes a schedule and tells the list', async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn();
        adminGolfApi.removeSchedule.mockResolvedValue({ success: true });
        renderWithIntl(<GolfTeeTimesPanel course={course} onChanged={onChanged} />);
        await user.click(await screen.findByRole('button', { name: 'Delete Weekday mornings' }));
        await waitFor(() => expect(adminGolfApi.removeSchedule).toHaveBeenCalledWith('c1', 's1'));
        expect(onChanged).toHaveBeenCalled();
    });
});

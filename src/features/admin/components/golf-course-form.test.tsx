import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { GolfCourseForm } from '@/features/admin/components/golf-course-form';
import type { GolfCourse } from '@/features/golf/types';

const existing: GolfCourse = {
    id: '1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 85, currency: 'USD', imageUrls: [], amenities: ['cart'],
    status: 'draft', createdAt: '', updatedAt: '', timezone: 'Asia/Manila', bookingWindowDays: 60, freeCancelHours: 72, scheduleCount: 1, bookable: true,
};

const form = (props: Partial<React.ComponentProps<typeof GolfCourseForm>> = {}) =>
    renderWithIntl(<GolfCourseForm saving={false} errors={{}} onSubmit={vi.fn()} onCancel={vi.fn()} {...props} />);

// Typing through the whole form takes most of the default five seconds, and more on a busy machine.
describe('GolfCourseForm', { timeout: 20_000 }, () => {
    it('makes the slug from name and city until someone types their own', async () => {
        const user = userEvent.setup();
        form();
        await user.type(screen.getByLabelText('Name *'), 'Wack Wack');
        await user.type(screen.getByLabelText('City *'), 'Mandaluyong');
        expect(screen.getByLabelText('Slug')).toHaveValue('wack-wack-mandaluyong');

        await user.clear(screen.getByLabelText('Slug'));
        await user.type(screen.getByLabelText('Slug'), 'wack-east');
        await user.type(screen.getByLabelText('Name *'), ' East');
        expect(screen.getByLabelText('Slug')).toHaveValue('wack-east');
    });

    it("leaves an existing course's slug alone: its links already use it", async () => {
        const user = userEvent.setup();
        form({ course: existing });
        await user.type(screen.getByLabelText('Name *'), ' Golf');
        expect(screen.getByLabelText('Slug')).toHaveValue('wack-wack');
    });

    it('sends what the API expects', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        form({ onSubmit });
        await user.type(screen.getByLabelText('Name *'), 'Sky72');
        await user.type(screen.getByLabelText('City *'), 'Incheon');
        await user.type(screen.getByLabelText('Country *'), 'South Korea');
        await user.selectOptions(screen.getByLabelText('Holes *'), '27');
        await user.type(screen.getByLabelText('Par'), '108');
        await user.type(screen.getByLabelText('Green fee from'), '150000');
        await user.clear(screen.getByLabelText('Currency'));
        await user.type(screen.getByLabelText('Currency'), 'krw');
        await user.type(screen.getByLabelText(/Image URLs/), 'https://a.example/1.jpg{Enter}{Enter} https://a.example/2.jpg ');
        await user.click(screen.getByLabelText('Caddies'));
        await user.selectOptions(screen.getByLabelText('Time zone'), 'Asia/Seoul');
        await user.clear(screen.getByLabelText('Booking window (days)'));
        await user.type(screen.getByLabelText('Booking window (days)'), '30');
        await user.click(screen.getByRole('button', { name: 'Create' }));

        expect(onSubmit).toHaveBeenCalledWith({
            slug: 'sky72-incheon', name: 'Sky72', country: 'South Korea', city: 'Incheon', address: null,
            description: '', holes: 27, par: 108, greenFeeFrom: 150000, currency: 'KRW',
            imageUrls: ['https://a.example/1.jpg', 'https://a.example/2.jpg'], amenities: ['caddie'],
            timezone: 'Asia/Seoul', bookingWindowDays: 30, freeCancelHours: 48,
        });
    });

    it('starts a new course with no time zone and a sixty-day window', async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();
        form({ onSubmit });
        expect(screen.getByLabelText('Time zone')).toHaveValue('');
        expect(screen.getByLabelText('Booking window (days)')).toHaveValue(60);
        await user.click(screen.getByRole('button', { name: 'Create' }));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ timezone: null, bookingWindowDays: 60 }));
    });

    it('locks the time zone and currency while the course has tee-time schedules', () => {
        form({ course: { ...existing, scheduleCount: 2 } });
        expect(screen.getByLabelText('Time zone')).toBeDisabled();
        expect(screen.getByLabelText('Currency')).toBeDisabled();
        expect(screen.getByText('Locked while this course has tee-time schedules.')).toBeInTheDocument();
    });

    it('leaves both open for a course without schedules', () => {
        form({ course: { ...existing, scheduleCount: 0, bookable: false } });
        expect(screen.getByLabelText('Time zone')).toBeEnabled();
        expect(screen.getByLabelText('Currency')).toBeEnabled();
    });

    it("shows the server's complaint beside the field it is about", () => {
        form({ errors: { slug: ['Another golf course already uses the slug "sky72".'] } });
        expect(screen.getByText('Another golf course already uses the slug "sky72".')).toBeInTheDocument();
    });

    it('takes how long before a tee time a customer may cancel for free', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        form({ course: existing, onSubmit });
        const field = screen.getByLabelText('Free cancellation (hours before tee time)');
        expect(field).toHaveValue(72);
        await user.clear(field);
        await user.type(field, '24');
        await user.click(screen.getByRole('button', { name: /Save/ }));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ freeCancelHours: 24 }));
    });

    it('defaults a new course to 48 hours, and shows what is wrong with the field', () => {
        form({ errors: { freeCancelHours: ['At most 720 hours'] } });
        expect(screen.getByLabelText('Free cancellation (hours before tee time)')).toHaveValue(48);
        expect(screen.getByText('At most 720 hours')).toBeInTheDocument();
    });
});

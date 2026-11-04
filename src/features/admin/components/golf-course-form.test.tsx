import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { GolfCourseForm } from '@/features/admin/components/golf-course-form';
import type { GolfCourse } from '@/features/golf/types';

const existing: GolfCourse = {
    id: '1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 85, currency: 'USD', imageUrls: [], amenities: ['cart'],
    status: 'draft', createdAt: '', updatedAt: '',
};

const form = (props: Partial<React.ComponentProps<typeof GolfCourseForm>> = {}) =>
    renderWithIntl(<GolfCourseForm saving={false} errors={{}} onSubmit={vi.fn()} onCancel={vi.fn()} {...props} />);

describe('GolfCourseForm', () => {
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
        await user.click(screen.getByRole('button', { name: 'Create' }));

        expect(onSubmit).toHaveBeenCalledWith({
            slug: 'sky72-incheon', name: 'Sky72', country: 'South Korea', city: 'Incheon', address: null,
            description: '', holes: 27, par: 108, greenFeeFrom: 150000, currency: 'KRW',
            imageUrls: ['https://a.example/1.jpg', 'https://a.example/2.jpg'], amenities: ['caddie'],
        });
    });

    it("shows the server's complaint beside the field it is about", () => {
        form({ errors: { slug: ['Another golf course already uses the slug "sky72".'] } });
        expect(screen.getByText('Another golf course already uses the slug "sky72".')).toBeInTheDocument();
    });
});

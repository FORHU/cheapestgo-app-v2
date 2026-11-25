/**
 * Covers: course search + country filtering, the price breakdown on a confirmed booking, the
 * cancellable flag gating the Cancel button, and the Golf Services panel (product/appointment/
 * inquiry booking modes, shown once a course is selected). `golfMockApi` is mocked throughout —
 * this is a UI test, the real HTTP flow already has its own coverage in api-v2's
 * `mockGolf.routes.test.ts` and `mockGolfServices.routes.test.ts`.
 */
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GolfApiDemoView } from './golf-api-demo-view';

const api = vi.hoisted(() => ({
    listCourses: vi.fn(), getCourse: vi.fn(), getTeeTimes: vi.fn(),
    hold: vi.fn(), book: vi.fn(), getBooking: vi.fn(), cancelBooking: vi.fn(),
    getScenario: vi.fn(), setScenario: vi.fn(),
    listServices: vi.fn(), bookService: vi.fn(), getServiceBooking: vi.fn(), cancelServiceBooking: vi.fn(),
}));
vi.mock('@/features/golf-api-demo/api/golfMockApi.client', () => ({ golfMockApi: api }));

const COURSE = { id: 'c1', slug: 'crescent-ridge', name: 'Crescent Ridge', country: 'Philippines', city: 'Tagaytay', holes: 18, greenFeeFrom: 85, currency: 'USD' };
const OTHER_COURSE = { id: 'c2', slug: 'siam-dunes', name: 'Siam Dunes', country: 'Thailand', city: 'Hua Hin', holes: 18, greenFeeFrom: 95, currency: 'USD' };
const TEE_TIME = { id: 'tt1', startsAt: '2026-12-01T22:00:00.000Z', localTime: '06:00', spotsLeft: 4, pricePerPlayer: 85, currency: 'USD' };
const HOLD = { holdId: 'h1', reference: 'MG-TEST01', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), spotsHeld: 2, pricePerPlayer: 85, currency: 'USD', greenFeeTotal: 170, extrasTotal: 0, total: 175.1, status: 'held' as const };

const SERVICES = [
    { id: 'equip-glove', category: 'equipment' as const, bookingMode: 'product' as const, name: 'Golf Glove', description: 'A glove.', price: 15, currency: 'USD', unit: 'per item' },
    { id: 'lesson-private-coaching', category: 'lesson' as const, bookingMode: 'appointment' as const, name: 'Private 1-on-1 Coaching', description: 'A lesson.', price: 75, currency: 'USD', unit: 'per hour' },
    { id: 'membership-family', category: 'membership' as const, bookingMode: 'inquiry' as const, name: 'Family Membership', description: 'A membership.', price: 2000, currency: 'USD', unit: 'per year' },
    { id: 'event-corporate-outing', category: 'event' as const, bookingMode: 'inquiry' as const, name: 'Corporate Golf Outing', description: 'An outing.', price: null, currency: 'USD', unit: 'quote' },
];

function listResult(courses: typeof COURSE[], countries: string[]) {
    return { data: { courses, total: courses.length, countries }, status: 200 };
}

beforeEach(() => {
    vi.clearAllMocks();
    api.listCourses.mockResolvedValue(listResult([COURSE, OTHER_COURSE], ['Philippines', 'Thailand']));
    api.getScenario.mockResolvedValue({ data: { scenario: null }, status: 200 });
    api.getTeeTimes.mockResolvedValue({ data: { courseId: 'c1', timezone: 'Asia/Manila', date: '2026-12-01', players: 2, teeTimes: [TEE_TIME] }, status: 200 });
    api.listServices.mockResolvedValue({ data: { services: SERVICES, total: SERVICES.length }, status: 200 });
});

describe('course search and country filter', () => {
    it('lists the countries returned by the API in the filter dropdown', async () => {
        render(<GolfApiDemoView />);
        await waitFor(() => expect(api.listCourses).toHaveBeenCalled());
        expect(await screen.findByText('Crescent Ridge')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Thailand' })).toBeInTheDocument();
    });

    it('re-queries with a query param after typing in the search box (debounced)', async () => {
        render(<GolfApiDemoView />);
        await waitFor(() => expect(api.listCourses).toHaveBeenCalledTimes(1));

        await userEvent.type(screen.getByPlaceholderText('Search courses by name or city'), 'Crescent');

        await waitFor(() => {
            const last = api.listCourses.mock.calls.at(-1)?.[0];
            expect(last).toEqual({ query: 'Crescent', country: undefined });
        }, { timeout: 2000 });
    });

    it('re-queries with a country param when a country is picked', async () => {
        render(<GolfApiDemoView />);
        await waitFor(() => expect(api.listCourses).toHaveBeenCalledTimes(1));

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Country' }), 'Thailand');

        await waitFor(() => {
            const last = api.listCourses.mock.calls.at(-1)?.[0];
            expect(last).toEqual({ query: undefined, country: 'Thailand' });
        }, { timeout: 2000 });
    });
});

describe('price breakdown and cancellable gating on a confirmed booking', () => {
    async function bookCourse(cancellable: boolean) {
        api.hold.mockResolvedValue({ data: HOLD, status: 201 });
        api.book.mockResolvedValue({
            data: {
                bookingId: 'h1', reference: HOLD.reference, status: 'confirmed', courseId: 'c1', teeTimeId: 'tt1',
                startsAt: TEE_TIME.startsAt, players: 2, leadName: 'J. Rivera', contactEmail: 'demo@cheapestgo.com',
                currency: 'USD', total: 175.1, greenFeeTotal: 170, extrasTotal: 0, serviceFee: 5.1, cancellable,
            },
            status: 201,
        });

        render(<GolfApiDemoView />);
        await userEvent.click(await screen.findByText('Crescent Ridge'));
        await userEvent.click(await screen.findByText('06:00'));
        await userEvent.click(await screen.findByText('Confirm booking'));
        await screen.findByText('Booking confirmed');
    }

    it('shows the green fee and service fee once confirmed', async () => {
        await bookCourse(true);
        expect(screen.getByText('Green fee')).toBeInTheDocument();
        expect(screen.getByText('Service fee')).toBeInTheDocument();
        expect(screen.getByText('$170.00')).toBeInTheDocument();
    });

    it('shows the Cancel button when the booking is cancellable', async () => {
        await bookCourse(true);
        expect(screen.getByText('Cancel booking')).toBeInTheDocument();
    });

    it('hides the Cancel button and explains why when the booking is not cancellable', async () => {
        await bookCourse(false);
        expect(screen.queryByText('Cancel booking')).not.toBeInTheDocument();
        expect(screen.getByText('This booking can no longer be cancelled.')).toBeInTheDocument();
    });
});

describe('Golf Services', () => {
    function rowFor(name: string): HTMLElement {
        const row = screen.getByText(name).closest('div.p-2\\.5');
        if (!row) throw new Error(`no service row for "${name}"`);
        return row as HTMLElement;
    }

    it('is hidden until a course is selected, then shows every category', async () => {
        render(<GolfApiDemoView />);
        await waitFor(() => expect(api.listCourses).toHaveBeenCalled());
        expect(screen.queryByText('Golf Services')).not.toBeInTheDocument();

        await userEvent.click(await screen.findByText('Crescent Ridge'));
        expect(await screen.findByText('Golf Services')).toBeInTheDocument();
        expect(screen.getByText('Golf Glove')).toBeInTheDocument();
        expect(screen.getByText('Private 1-on-1 Coaching')).toBeInTheDocument();
        expect(screen.getByText('Family Membership')).toBeInTheDocument();
        expect(screen.getByText('Corporate Golf Outing')).toBeInTheDocument();
    });

    it('buys a product with the chosen quantity and shows the confirmed total', async () => {
        api.bookService.mockResolvedValue({
            data: { id: 's1', reference: 'MGS-ABC123', serviceId: 'equip-glove', category: 'equipment', bookingMode: 'product', name: 'Golf Glove', leadName: 'J. Rivera', contactEmail: 'demo@cheapestgo.com', currency: 'USD', unitPrice: 15, total: 30, status: 'confirmed', createdAt: new Date().toISOString() },
            status: 201,
        });
        render(<GolfApiDemoView />);
        await userEvent.click(await screen.findByText('Crescent Ridge'));
        await screen.findByText('Golf Services');

        const row = rowFor('Golf Glove');
        await userEvent.click(within(row).getByRole('button', { name: 'Buy' }));
        const quantityInput = within(row).getByRole('spinbutton');
        await userEvent.clear(quantityInput);
        await userEvent.type(quantityInput, '2');
        await userEvent.click(within(row).getByRole('button', { name: 'Buy now' }));

        await waitFor(() => expect(api.bookService).toHaveBeenCalledWith('equip-glove', expect.objectContaining({ quantity: 2, courseId: 'c1' })));
        expect(await within(row).findByText('$30.00')).toBeInTheDocument();
        expect(within(row).getByText('MGS-ABC123')).toBeInTheDocument();
    });

    it('books an appointment against a preferred date', async () => {
        api.bookService.mockResolvedValue({
            data: { id: 's2', reference: 'MGS-DEF456', serviceId: 'lesson-private-coaching', category: 'lesson', bookingMode: 'appointment', name: 'Private 1-on-1 Coaching', leadName: 'J. Rivera', contactEmail: 'demo@cheapestgo.com', currency: 'USD', unitPrice: 75, total: 75, status: 'confirmed', createdAt: new Date().toISOString() },
            status: 201,
        });
        render(<GolfApiDemoView />);
        await userEvent.click(await screen.findByText('Crescent Ridge'));
        await screen.findByText('Golf Services');

        const row = rowFor('Private 1-on-1 Coaching');
        await userEvent.click(within(row).getByRole('button', { name: 'Book' }));
        const dateInput = row.querySelector('input[type="date"]') as HTMLInputElement;
        fireEvent.change(dateInput, { target: { value: '2026-12-05' } });
        await userEvent.click(within(row).getByRole('button', { name: 'Book now' }));

        await waitFor(() => expect(api.bookService).toHaveBeenCalledWith('lesson-private-coaching', expect.objectContaining({ preferredDate: '2026-12-05' })));
        expect(await within(row).findByText('$75.00')).toBeInTheDocument();
    });

    it('requests a quote-based service and shows "Quote pending" instead of a total', async () => {
        api.bookService.mockResolvedValue({
            data: { id: 's3', reference: 'MGS-GHI789', serviceId: 'event-corporate-outing', category: 'event', bookingMode: 'inquiry', name: 'Corporate Golf Outing', leadName: 'J. Rivera', contactEmail: 'demo@cheapestgo.com', currency: 'USD', unitPrice: null, total: null, status: 'confirmed', createdAt: new Date().toISOString() },
            status: 201,
        });
        render(<GolfApiDemoView />);
        await userEvent.click(await screen.findByText('Crescent Ridge'));
        await screen.findByText('Golf Services');

        const row = rowFor('Corporate Golf Outing');
        await userEvent.click(within(row).getByRole('button', { name: 'Request' }));
        await userEvent.click(within(row).getByRole('button', { name: 'Request now' }));

        await waitFor(() => expect(api.bookService).toHaveBeenCalledWith('event-corporate-outing', expect.anything()));
        expect(await within(row).findByText('Quote pending')).toBeInTheDocument();
    });

    it('cancels a confirmed service booking', async () => {
        api.bookService.mockResolvedValue({
            data: { id: 's1', reference: 'MGS-ABC123', serviceId: 'equip-glove', category: 'equipment', bookingMode: 'product', name: 'Golf Glove', leadName: 'J. Rivera', contactEmail: 'demo@cheapestgo.com', currency: 'USD', unitPrice: 15, total: 15, status: 'confirmed', createdAt: new Date().toISOString() },
            status: 201,
        });
        api.cancelServiceBooking.mockResolvedValue({
            data: { id: 's1', reference: 'MGS-ABC123', serviceId: 'equip-glove', category: 'equipment', bookingMode: 'product', name: 'Golf Glove', leadName: 'J. Rivera', contactEmail: 'demo@cheapestgo.com', currency: 'USD', unitPrice: 15, total: 15, status: 'cancelled', createdAt: new Date().toISOString(), cancelledAt: new Date().toISOString() },
            status: 200,
        });
        render(<GolfApiDemoView />);
        await userEvent.click(await screen.findByText('Crescent Ridge'));
        await screen.findByText('Golf Services');

        const row = rowFor('Golf Glove');
        await userEvent.click(within(row).getByRole('button', { name: 'Buy' }));
        await userEvent.click(within(row).getByRole('button', { name: 'Buy now' }));
        await within(row).findByText('MGS-ABC123');

        await userEvent.click(within(row).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(api.cancelServiceBooking).toHaveBeenCalledWith('MGS-ABC123'));
        await waitFor(() => expect(within(row).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument());
        expect(within(row).getByText('cancelled')).toBeInTheDocument();
    });
});

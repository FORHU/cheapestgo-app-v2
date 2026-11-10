import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvidencePack, PaymentListItem, PaymentRecordItem, PaymentSourceItem } from '@/features/admin/api/payments.api';

const api = vi.hoisted(() => ({ list: vi.fn(), evidence: vi.fn(), exportPdf: vi.fn(), webhooks: vi.fn() }));
vi.mock('@/features/admin/api/payments.api', () => ({ adminPaymentsApi: api }));

import { PaymentsView } from '@/features/admin/components/payments-view';

const record = (over: Partial<PaymentRecordItem> = {}): PaymentRecordItem => ({
    source: 'hotel_bookings', internalId: 'hb-1',
    bookingReference: 'CG-ABC123', bookingStatus: 'CONFIRMED', ...over,
});

const payment = (over: Partial<PaymentListItem> = {}): PaymentListItem => ({
    paymentIntentId: 'pi_1', product: 'hotel',
    bookingReference: 'CG-ABC123', supplierReference: '31489968',
    provider: 'travelgatex', customerEmail: 'juan@example.com', customerName: 'Juan dela Cruz',
    amount: '8557.36', currency: 'PHP', createdAt: '2026-10-26T09:14:00.000Z',
    records: [record()], ...over,
});

const sourceRow = (over: Partial<PaymentSourceItem> = {}): PaymentSourceItem => ({
    paymentIntentId: 'pi_1', source: 'hotel_bookings', internalId: 'hb-1', product: 'hotel',
    bookingReference: 'CG-ABC123', bookingStatus: 'CONFIRMED', supplierReference: '31489968',
    provider: 'travelgatex', customerEmail: 'juan@example.com', customerName: 'Juan dela Cruz',
    amount: '8557.36', currency: 'PHP', createdAt: '2026-10-26T09:14:00.000Z', ...over,
});

const pack = (over: Partial<EvidencePack> = {}): EvidencePack => ({
    paymentIntentId: 'pi_1',
    generatedAt: '2026-11-09T10:00:00.000Z',
    sources: [sourceRow()],
    items: [
        { key: 'pi_status', label: 'Payment status at Stripe', provenance: 'verified', value: 'succeeded', observedAt: '2026-11-09T10:00:00.000Z' },
        { key: 'supplier_ref_hotel_bookings', label: 'Supplier reference (travelgatex)', provenance: 'provider_recorded', value: '31489968', observedAt: '2026-10-26T09:14:00.000Z', note: 'Not re-checked: the hotel supplier offers no booking-read.' },
        { key: 'status_hotel_bookings', label: 'Our record (hotel_bookings)', provenance: 'internal', value: 'CONFIRMED', observedAt: '2026-10-26T09:14:00.000Z' },
        { key: 'email', label: 'Confirmation email', provenance: 'unavailable', value: null, observedAt: null, note: 'No email was logged against this booking reference.' },
    ],
    timeline: [{ at: '2026-10-26T09:14:00.000Z', source: 'supplier', kind: 'supplier_book', label: 'travelgatex book — ok', reference: '31489968' }],
    limitations: ['Hotel reservations cannot be re-checked with the supplier.'],
    ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue({ items: [payment()], total: 1, page: 1, limit: 25 });
    api.evidence.mockResolvedValue(pack());
});

describe('the payments table', () => {
    it('shows money exactly as the server sent it, never reformatted', async () => {
        render(<PaymentsView />);
        expect(await screen.findByText('8557.36 PHP')).toBeInTheDocument();
    });

    /**
     * ADR-0003, corrected. A hotel booking lives in two tables by design — the lifecycle attempt
     * and the sale it became — so showing a row per record put every healthy stay on the page
     * twice, each flagged as a duplicate. A warning that is always on is one nobody reads.
     */
    it('shows a payment held in two tables as one row, listing both', async () => {
        api.list.mockResolvedValue({
            items: [payment({ records: [
                record({ source: 'hotel_bookings', internalId: 'hb-1', bookingStatus: 'CONFIRMED' }),
                record({ source: 'bookings', internalId: 'b-1', bookingStatus: 'confirmed' }),
            ] })],
            total: 1, page: 1, limit: 25,
        });
        render(<PaymentsView />);

        await waitFor(() => expect(screen.getAllByText('Juan dela Cruz')).toHaveLength(1));
        expect(screen.getByText('hotel_bookings')).toBeInTheDocument();
        expect(screen.getByText('bookings')).toBeInTheDocument();
    });

    /** The ordinary pair must not look like a finding. */
    it('raises no warning for a stay recorded as an attempt and a sale', async () => {
        api.list.mockResolvedValue({
            items: [payment({ records: [record({ source: 'hotel_bookings' }), record({ source: 'bookings', internalId: 'b-1' })] })],
            total: 1, page: 1, limit: 25,
        });
        render(<PaymentsView />);

        await screen.findByText('CG-ABC123');
        expect(screen.queryByText(/more than one booking/)).toBeNull();
        expect(screen.queryByText(/recorded twice/)).toBeNull();
    });

    /** What a genuine double-write looks like: one payment against two different bookings. */
    it('warns when one payment carries more than one booking', async () => {
        api.list.mockResolvedValue({
            items: [payment({ anomaly: 'multiple_references' })], total: 1, page: 1, limit: 25,
        });
        render(<PaymentsView />);

        expect(await screen.findByText(/more than one booking on this payment/)).toBeInTheDocument();
    });

    it('warns when one table holds the same payment twice', async () => {
        api.list.mockResolvedValue({
            items: [payment({ anomaly: 'repeated_source' })], total: 1, page: 1, limit: 25,
        });
        render(<PaymentsView />);

        expect(await screen.findByText(/recorded twice in the same table/)).toBeInTheDocument();
    });

    /** A payment nobody wrote a booking for is the row most worth finding. */
    it('calls out a payment with no booking rather than leaving the cell blank', async () => {
        api.list.mockResolvedValue({ items: [payment({ bookingReference: null })], total: 1, page: 1, limit: 25 });
        render(<PaymentsView />);
        expect(await screen.findByText('no booking')).toBeInTheDocument();
    });

    it('says plainly when a search matches nothing', async () => {
        api.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 25 });
        render(<PaymentsView />);
        await userEvent.type(await screen.findByLabelText('Search payments'), 'nothing-here');
        await userEvent.click(screen.getByRole('button', { name: 'Search' }));
        expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
    });
});

describe('the evidence panel', () => {
    const open = async () => {
        render(<PaymentsView />);
        await userEvent.click(await screen.findByRole('button', { name: 'Evidence' }));
        return screen.findByRole('dialog');
    };

    /**
     * The pack is read by a card network. A captured payment is evidence that money moved, never
     * that a stay was honoured — and the screen has to say so where it cannot be missed.
     */
    it('states that nothing here claims a service was delivered', async () => {
        const panel = await open();
        expect(within(panel).getByText(/does not say a service was delivered/i)).toBeInTheDocument();
    });

    it('labels each fact with how it is known', async () => {
        const panel = await open();
        expect(within(panel).getByText('Verified now')).toBeInTheDocument();
        expect(within(panel).getByText('Provider, at the time')).toBeInTheDocument();
        expect(within(panel).getByText('Our own record')).toBeInTheDocument();
        expect(within(panel).getByText('Not available')).toBeInTheDocument();
    });

    it('never labels a hotel supplier reference as verified', async () => {
        const panel = await open();
        const row = within(panel).getByText('Supplier reference (travelgatex)').closest('li')!;
        expect(within(row).getByText('Provider, at the time')).toBeInTheDocument();
        expect(within(row).queryByText('Verified now')).toBeNull();
    });

    it('shows a missing item as missing instead of hiding it', async () => {
        const panel = await open();
        expect(within(panel).getByText('not available')).toBeInTheDocument();
        expect(within(panel).getByText(/No email was logged/)).toBeInTheDocument();
    });

    it('warns loudly when no internal record references the payment', async () => {
        api.evidence.mockResolvedValue(pack({ sources: [] }));
        const panel = await open();
        expect(within(panel).getByText(/never written down/i)).toBeInTheDocument();
    });
});

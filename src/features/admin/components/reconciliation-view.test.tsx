import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RebuildDraft, ReconciliationReport, UnrecordedReservation } from '@/features/admin/api/reconciliation.api';

const api = vi.hoisted(() => ({ report: vi.fn(), draft: vi.fn(), rebuild: vi.fn() }));
vi.mock('@/features/admin/api/reconciliation.api', () => ({ adminReconciliationApi: api }));

import { ReconciliationView, stripeMoney } from '@/features/admin/components/reconciliation-view';

const item = (over: Partial<UnrecordedReservation> = {}): UnrecordedReservation => ({
    product: 'hotel', bookingReference: 'CG-ABC123', hasReference: true, paymentIntentId: 'pi_h',
    amount: 855736, currency: 'php', created: '2026-11-01T09:14:00.000Z', holderEmail: 'juan@example.com',
    brand: 'CheapestGo', description: 'CG: Hotel Naru — Twin', refunded: false, lookup: {},
    attempt: { status: 'CONFIRMED', supplierReference: '31489968', checkIn: '2026-12-01', checkOut: '2026-12-03', propertyName: 'Hotel Naru' },
    ...over,
});

const report = (over: Partial<ReconciliationReport> = {}): ReconciliationReport => ({
    ok: true, scanned: 12, windowDays: 30, warnings: [],
    unrecorded: [item()], missingBrand: { total: 0, items: [] }, ...over,
});

const draft: RebuildDraft = {
    paymentIntentId: 'pi_h', bookingReference: 'CG-ABC123', userId: 'u-1', amount: '8557.36', currency: 'PHP',
    paidAt: '2026-11-01T09:14:00.000Z', amountRefunded: '0', suggestedStatus: 'confirmed', brand: 'CheapestGo',
    provider: 'travelgatex', attempt: { status: 'CONFIRMED', reference: 'CG-ABC123' }, hasCancellationTerms: true,
    fields: {
        propertyName: 'Hotel Naru', roomName: 'Twin', checkIn: '2026-12-01', checkOut: '2026-12-03', adults: 2, children: 0,
        holderFirstName: 'Juan', holderLastName: 'dela Cruz', holderEmail: 'juan@example.com', supplierReference: '',
    },
    provenance: {
        propertyName: 'attempt', roomName: 'attempt', checkIn: 'attempt', checkOut: 'attempt', adults: 'attempt', children: 'attempt',
        holderFirstName: 'attempt', holderLastName: 'attempt', holderEmail: 'attempt', supplierReference: 'missing',
    },
};

beforeEach(() => {
    vi.clearAllMocks();
    api.report.mockResolvedValue(report());
    api.draft.mockResolvedValue({ draft });
    api.rebuild.mockResolvedValue({ bookingId: 'CG-ABC123', id: 'row-1' });
});

describe('stripeMoney', () => {
    it('does not divide a zero-decimal currency by a hundred', () => {
        expect(stripeMoney(1_250_000, 'krw')).toBe('1,250,000 KRW');
        expect(stripeMoney(855736, 'php')).toBe('8,557.36 PHP');
    });
});

describe('ReconciliationView', () => {
    it('lists a paid hotel stay with no booking, and what the attempt knows', async () => {
        render(<ReconciliationView />);

        const row = (await screen.findByText('CG-ABC123')).closest('tr')!;
        expect(within(row).getByText('8,557.36 PHP')).toBeInTheDocument();
        expect(within(row).getByText('CONFIRMED')).toBeInTheDocument();
        expect(within(row).getByRole('button', { name: /rebuild/i })).toBeInTheDocument();
    });

    it('shows where to look for a flight, and offers no rebuild', async () => {
        api.report.mockResolvedValue(report({ unrecorded: [item({
            product: 'flight', bookingReference: '(no reference — pi_f)', hasReference: false, paymentIntentId: 'pi_f',
            lookup: { bookingSessionId: 'sess_9' }, attempt: null,
        })] }));

        render(<ReconciliationView />);

        const row = (await screen.findByText('pi_f')).closest('tr')!;
        expect(within(row).getByText(/Duffel \(checkout session sess_9\)/)).toBeInTheDocument();
        expect(within(row).queryByRole('button', { name: /rebuild/i })).not.toBeInTheDocument();
    });

    it('says a refused run was not checked, rather than showing an empty list', async () => {
        api.report.mockResolvedValue(report({ ok: false, refusedReason: 'Stripe key belongs to acct_test', unrecorded: [] }));

        render(<ReconciliationView />);

        expect(await screen.findByRole('alert')).toHaveTextContent(/Not checked\..*acct_test/);
        expect(screen.queryByText(/Every captured payment/)).not.toBeInTheDocument();
    });

    it('rebuilds from the pre-filled form and reloads the list', async () => {
        const user = userEvent.setup();
        render(<ReconciliationView />);

        await user.click(await screen.findByRole('button', { name: /rebuild/i }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('not recorded — fill in')).toBeInTheDocument();

        await user.type(within(dialog).getByLabelText(/supplier reference/i), '31489968');
        await user.type(within(dialog).getByLabelText(/why/i), 'Supplier dashboard shows it confirmed.');
        api.report.mockResolvedValue(report({ unrecorded: [] }));
        await user.click(within(dialog).getByRole('button', { name: 'Record booking' }));

        await waitFor(() => expect(api.rebuild).toHaveBeenCalledWith('pi_h', expect.objectContaining({
            supplierReference: '31489968', status: 'confirmed', reason: 'Supplier dashboard shows it confirmed.', adults: 2,
        })));
        expect(await screen.findByRole('status')).toHaveTextContent('Booking CG-ABC123 recorded.');
        expect(api.report).toHaveBeenCalledTimes(2);
    });

    it('keeps the form open with the reason when the rebuild is refused', async () => {
        const user = userEvent.setup();
        api.rebuild.mockRejectedValue(new Error('Booking CG-ABC123 already records this payment.'));
        render(<ReconciliationView />);

        await user.click(await screen.findByRole('button', { name: /rebuild/i }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/why/i), 'Supplier dashboard shows it confirmed.');
        await user.click(within(dialog).getByRole('button', { name: 'Record booking' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('already records this payment');
    });
});

import { http } from '@/shared/lib/http';

/**
 * The payment back office's API client.
 *
 * Every call is a read. Refunding lives where it already did, on the Stripe page, so that exactly
 * one screen in this admin moves money — see ADR-0003 in api-v2.
 */

const query = (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
    const s = qs.toString();
    return s ? `?${s}` : '';
};

/** Where a fact came from, which the UI shows beside it rather than flattening away. */
export type Provenance = 'verified' | 'provider_recorded' | 'internal' | 'unavailable';

export type PaymentSource = 'bookings' | 'hotel_bookings' | 'flight_bookings' | 'booking_sessions';

/** One of the records behind a payment: which table holds it, and what that table says. */
export interface PaymentRecordItem {
    source: PaymentSource;
    internalId: string;
    bookingReference: string | null;
    bookingStatus: string | null;
}

/**
 * One row is one PaymentIntent — the grain the back office counts in.
 *
 * It used to be one row per internal record, which showed every healthy hotel booking twice: the
 * lifecycle attempt and the sale it became live in two tables on purpose. Both rows carried a
 * duplicate warning, so the warning was always on and told a reader nothing.
 */
export interface PaymentListItem {
    paymentIntentId: string;
    product: 'hotel' | 'flight' | 'unknown';
    bookingReference: string | null;
    supplierReference: string | null;
    provider: string | null;
    customerEmail: string | null;
    customerName: string | null;
    /** A string, always. Money that has been through a JS number is not evidence. */
    amount: string | null;
    currency: string | null;
    createdAt: string;
    /** Every record behind this payment, oldest first. Normally one or two. */
    records: PaymentRecordItem[];
    /**
     * A disagreement the ordinary attempt-and-sale pair cannot produce: two different booking
     * references on one payment, or two records from the same table. Absent on a healthy row.
     */
    anomaly?: 'multiple_references' | 'repeated_source';
}

/** A record as the detail panel receives it, which is still one row per table. */
export interface PaymentSourceItem extends PaymentRecordItem {
    paymentIntentId: string;
    product: 'hotel' | 'flight' | 'unknown';
    supplierReference: string | null;
    provider: string | null;
    customerEmail: string | null;
    customerName: string | null;
    amount: string | null;
    currency: string | null;
    createdAt: string;
}

export interface EvidenceItem {
    key: string;
    label: string;
    provenance: Provenance;
    value: string | null;
    observedAt: string | null;
    note?: string;
}

export interface TimelineEvent {
    at: string;
    source: 'internal' | 'supplier' | 'email' | 'refund';
    kind: string;
    label: string;
    reference: string | null;
}

export interface EvidencePack {
    paymentIntentId: string;
    generatedAt: string;
    sources: PaymentSourceItem[];
    items: EvidenceItem[];
    timeline: TimelineEvent[];
    limitations: string[];
}

export interface PaymentFilters {
    search?: string;
    product?: string;
    currency?: string;
    provider?: string;
    page?: number;
}

export const adminPaymentsApi = {
    list: (f: PaymentFilters) =>
        http.get<{ items: PaymentListItem[]; total: number; page: number; limit: number }>(
            `/admin/payments${query({
                search: f.search, product: f.product, currency: f.currency,
                provider: f.provider, page: f.page ? String(f.page) : undefined,
            })}`,
        ),

    evidence: (paymentIntentId: string) =>
        http.get<EvidencePack>(`/admin/payments/${encodeURIComponent(paymentIntentId)}/evidence`),

    exportPdf: (paymentIntentId: string) =>
        http.post<{ url: string; generatedAt: string }>(
            `/admin/payments/${encodeURIComponent(paymentIntentId)}/evidence/export`, {},
        ),

    webhooks: (opts: { stuck?: boolean; reference?: string } = {}) =>
        http.get<{ items: Array<{
            eventId: string; eventType: string | null; paymentIntentId: string | null;
            bookingReference: string | null; receivedAt: string; completedAt: string | null;
            deliveryCount: number; errorMessage: string | null; stuck: boolean;
        }>; total: number }>(
            `/admin/payment-webhooks${query({
                stuck: opts.stuck ? 'true' : undefined, reference: opts.reference,
            })}`,
        ),
};

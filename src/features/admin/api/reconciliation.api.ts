import { http } from '@/shared/lib/http';

/**
 * Reconciliation's API client: what Stripe sold that no booking table records (ADR-0026 in the
 * v1 repo, carried into api-v2's `lib/admin/reconciliation.ts`).
 *
 * The list is derived on every read, so an item leaves it the moment its booking exists. The one
 * write is the hotel rebuild, which records the booking a person has checked against the supplier.
 */

export type UnrecordedProduct = 'hotel' | 'flight' | 'golf';

export interface UnrecordedReservation {
    product:          UnrecordedProduct;
    bookingReference: string;
    hasReference:     boolean;
    paymentIntentId:  string;
    /** Minor units, as Stripe reports them; zero-decimal currencies have none. */
    amount:           number;
    currency:         string;
    created:          string;
    holderEmail:      string | null;
    brand:            string | null;
    description:      string | null;
    refunded:         boolean;
    lookup:           { bookingSessionId?: string; golfBookingId?: string };
    attempt:          { status: string; supplierReference: string | null; checkIn: string | null; checkOut: string | null; propertyName: string | null } | null;
}

export interface MissingBrandRow {
    bookingReference: string;
    paymentIntentId:  string | null;
    status:           string | null;
    createdAt:        string | null;
}

export interface ReconciliationReport {
    ok:             boolean;
    refusedReason?: string;
    scanned:        number;
    windowDays:     number;
    unrecorded:     UnrecordedReservation[];
    warnings:       string[];
    missingBrand:   { total: number; items: MissingBrandRow[] };
}

export type RebuildProvenance = 'stripe' | 'attempt' | 'missing';
export type RebuildStatus = 'confirmed' | 'refunded' | 'cancelled';

export interface RebuildFields {
    propertyName:      string;
    roomName:          string;
    checkIn:           string;
    checkOut:          string;
    adults:            number;
    children:          number;
    holderFirstName:   string;
    holderLastName:    string;
    holderEmail:       string;
    supplierReference: string;
}

export interface RebuildDraft {
    paymentIntentId:      string;
    bookingReference:     string;
    userId:               string;
    amount:               string;
    currency:             string;
    paidAt:               string;
    amountRefunded:       string;
    suggestedStatus:      RebuildStatus;
    brand:                string | null;
    provider:             string;
    fields:               RebuildFields;
    provenance:           Record<keyof RebuildFields, RebuildProvenance>;
    attempt:              { status: string; reference: string } | null;
    hasCancellationTerms: boolean;
}

export const adminReconciliationApi = {
    report: (windowDays = 30) =>
        http.get<ReconciliationReport>(`/admin/reconciliation?windowDays=${windowDays}`),

    draft: (paymentIntentId: string) =>
        http.get<{ draft: RebuildDraft }>(`/admin/reconciliation/${encodeURIComponent(paymentIntentId)}/rebuild`),

    rebuild: (paymentIntentId: string, body: RebuildFields & { status: RebuildStatus; reason: string }) =>
        http.post<{ bookingId: string; id: string }>(
            `/admin/reconciliation/${encodeURIComponent(paymentIntentId)}/rebuild`, body,
        ),
};
